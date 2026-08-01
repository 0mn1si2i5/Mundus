import assert from 'node:assert/strict';
import {
  access,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';
import {
  acquireAssetSetLock,
  assetSetLockPath,
  publishAssetSet,
} from './publish-asset-set.mjs';

test('serializes separate processes so B publishes only after failed A rolls back', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'mundus-publish-processes-'));
  const paths = ['one.bin', 'two.bin', 'manifest.json'].map((name) =>
    join(root, name),
  );
  await Promise.all(paths.map((path) => writeFile(path, 'old')));
  const worker = join(import.meta.dirname, 'publish-asset-set.worker.mjs');
  const a = spawn(process.execPath, [worker, root, 'A', 'pause-fail'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  context.after(() => a.kill());
  const aResultPromise = waitForChild(a);
  await waitForPath(join(root, 'a-paused'));
  const b = spawn(process.execPath, [worker, root, 'B'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  context.after(() => b.kill());
  const bResultPromise = waitForChild(b);
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(b.exitCode, null);
  await writeFile(join(root, 'release-a'), '');
  const [aResult, bResult] = await Promise.all([
    aResultPromise,
    bResultPromise,
  ]);
  assert.notEqual(aResult.code, 0);
  assert.match(aResult.stderr, /A publication failed/);
  assert.equal(bResult.code, 0, bResult.stderr);
  assert.deepEqual(
    await Promise.all(paths.map((path) => readFile(path, 'utf8'))),
    ['B', 'B', 'B'],
  );
});

test('serializes overlapping publications so B waits for failed A then publishes all B', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mundus-publish-contention-'));
  const paths = ['one.bin', 'two.bin', 'manifest.json'].map((name) =>
    join(root, name),
  );
  await Promise.all(paths.map((path) => writeFile(path, 'old')));
  const { rename } = await import('node:fs/promises');
  let releaseA;
  let aPaused;
  const paused = new Promise((resolve) => {
    aPaused = resolve;
  });
  let aRenames = 0;
  let bRenames = 0;

  const a = publishAssetSet(
    paths.map((path) => ({ path, bytes: 'A' })),
    {
      async rename(from, to) {
        aRenames += 1;
        if (aRenames === 4) {
          aPaused();
          await new Promise((resolve) => {
            releaseA = resolve;
          });
          throw new Error('A publication failed');
        }
        await rename(from, to);
      },
      lockPollMs: 5,
      lockWaitMs: 1_000,
    },
  );
  await paused;
  const b = publishAssetSet(
    paths.map((path) => ({ path, bytes: 'B' })),
    {
      async rename(from, to) {
        bRenames += 1;
        await rename(from, to);
      },
      lockPollMs: 5,
      lockWaitMs: 1_000,
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(bRenames, 0);
  releaseA();
  await assert.rejects(a, /A publication failed/);
  await b;

  assert.deepEqual(
    await Promise.all(paths.map((path) => readFile(path, 'utf8'))),
    ['B', 'B', 'B'],
  );
});

test('times out without stealing a demonstrably live owner lock', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mundus-publish-live-lock-'));
  const paths = [join(root, 'asset.bin'), join(root, 'manifest.json')];
  const lockPath = assetSetLockPath(paths);
  const lock = await acquireAssetSetLock(paths, {
    lockPollMs: 5,
    lockWaitMs: 50,
  });

  await assert.rejects(
    acquireAssetSetLock(paths, {
      lockPollMs: 5,
      lockWaitMs: 30,
    }),
    /Timed out waiting for asset publication lock.*pid/u,
  );
  await access(lockPath);
  await lock.release();
});

test('lock identity is deterministic regardless of destination order', () => {
  const paths = ['/tmp/z-manifest.json', '/tmp/a-asset.bin'];
  assert.equal(assetSetLockPath(paths), assetSetLockPath([...paths].reverse()));
});

test('fails closed on malformed lock ownership instead of stealing it', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mundus-publish-unknown-lock-'));
  const paths = [join(root, 'asset.bin'), join(root, 'manifest.json')];
  const lockPath = assetSetLockPath(paths);
  await (await import('node:fs/promises')).mkdir(lockPath);
  await writeFile(join(lockPath, 'owner.json'), 'not-json');

  await assert.rejects(
    acquireAssetSetLock(paths, {
      lockPollMs: 5,
      lockWaitMs: 20,
    }),
    /Timed out waiting for asset publication lock/,
  );
  await access(lockPath);
});

test('fails closed in the owner-metadata to active-sentinel crash window', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mundus-publish-active-window-'));
  const paths = [join(root, 'asset.bin'), join(root, 'manifest.json')];
  const lock = await acquireAssetSetLock(paths);
  await rm(join(lock.path, 'publication-active'));
  await writeFile(
    join(lock.path, 'owner.json'),
    `${JSON.stringify({
      ...lock.owner,
      pid: 999_999,
      acquiredAt: '2020-01-01T00:00:00.000Z',
    })}\n`,
  );

  await assert.rejects(
    acquireAssetSetLock(paths, {
      lockPollMs: 5,
      lockWaitMs: 20,
    }),
    /publication active.*manual recovery/u,
  );
  await access(lock.path);
});

test('old dead-owner lock is never reclaimed automatically', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mundus-publish-stale-lock-'));
  const paths = [join(root, 'asset.bin'), join(root, 'manifest.json')];
  const lockPath = assetSetLockPath(paths);
  await writeFile(join(root, 'placeholder'), '');
  await (await import('node:fs/promises')).mkdir(lockPath);
  await writeFile(
    join(lockPath, 'owner.json'),
    JSON.stringify({
      pid: 999_999,
      processStartedAt: '2020-01-01T00:00:00.000Z',
      acquiredAt: '2020-01-01T00:00:00.000Z',
      ownerId: 'dead-owner',
    }),
  );

  const before = await snapshotTree(root);
  await assert.rejects(
    acquireAssetSetLock(paths, {
      lockPollMs: 5,
      lockWaitMs: 25,
    }),
    /manual inspection/u,
  );
  assert.deepEqual(await snapshotTree(root), before);
});

test('lock release is owner-verified and never removes another owner lock', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mundus-publish-owner-lock-'));
  const paths = [join(root, 'asset.bin'), join(root, 'manifest.json')];
  const lock = await acquireAssetSetLock(paths);
  await writeFile(
    join(lock.path, 'owner.json'),
    JSON.stringify({ ...lock.owner, ownerId: 'replacement-owner' }),
  );

  await assert.rejects(lock.release(), /ownership changed/);
  await access(lock.path);
  await rm(lock.path, { recursive: true, force: true });
});

test('recovery-required lock is never reclaimed even when old and owner is dead', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mundus-publish-recovery-lock-'));
  const paths = ['one.bin', 'two.bin', 'manifest.json'].map((name) =>
    join(root, name),
  );
  await Promise.all(
    paths.map((path, index) => writeFile(path, `old-${index}`)),
  );
  let forwardRenames = 0;
  let restoreRenames = 0;
  const { rename } = await import('node:fs/promises');

  await assert.rejects(
    publishAssetSet(
      paths.map((path) => ({ path, bytes: 'broken-generation' })),
      {
        async rename(from, to) {
          forwardRenames += 1;
          if (forwardRenames === 6) throw new Error('publication failed');
          await rename(from, to);
        },
        async rollbackRename(from, to) {
          restoreRenames += 1;
          if (restoreRenames === 1) throw new Error('rollback failed');
          await rename(from, to);
        },
      },
    ),
    /rollback failed/,
  );

  const lockPath = assetSetLockPath(paths);
  const metadataPath = join(lockPath, 'owner.json');
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
  assert.equal(metadata.recoveryRequired, true);
  assert.equal(typeof metadata.recoveryPaths?.stagingDirectory, 'string');
  await access(join(lockPath, 'recovery-required'));
  await writeFile(
    metadataPath,
    `${JSON.stringify({
      ...metadata,
      pid: 999_999,
      acquiredAt: '2020-01-01T00:00:00.000Z',
    })}\n`,
  );
  const before = await snapshotTree(root);

  await assert.rejects(
    publishAssetSet(
      paths.map((path) => ({ path, bytes: 'later-generation' })),
      {
        lockPollMs: 5,
        lockWaitMs: 25,
      },
    ),
    /recovery required.*manual recovery/u,
  );

  assert.deepEqual(await snapshotTree(root), before);
});

for (const failure of ['write', 'rename']) {
  test(`recovery sentinel ${failure} failure skips rollback and remains permanently blocking`, async () => {
    const root = await mkdtemp(
      join(tmpdir(), `mundus-publish-sentinel-${failure}-fail-`),
    );
    const paths = ['one.bin', 'two.bin', 'manifest.json'].map((name) =>
      join(root, name),
    );
    await Promise.all(paths.map((path) => writeFile(path, 'old')));
    let forwardRenames = 0;
    let restoreRenames = 0;
    const { rename } = await import('node:fs/promises');

    await assert.rejects(
      publishAssetSet(
        paths.map((path) => ({ path, bytes: 'new' })),
        {
          async rename(from, to) {
            forwardRenames += 1;
            if (forwardRenames === 6) throw new Error('publication failed');
            await rename(from, to);
          },
          async rollbackRename(from, to) {
            restoreRenames += 1;
            await rename(from, to);
          },
          ...(failure === 'write'
            ? {
                writeRecoverySentinel: async () => {
                  throw new Error('sentinel write failed');
                },
              }
            : {
                renameRecoverySentinel: async () => {
                  throw new Error('sentinel rename failed');
                },
              }),
        },
      ),
      new RegExp(`sentinel ${failure} failed`),
    );

    assert.equal(restoreRenames, 0);
    const lockPath = assetSetLockPath(paths);
    await access(join(lockPath, 'publication-active'));
    const before = await snapshotTree(root);
    await assert.rejects(
      publishAssetSet(
        paths.map((path) => ({ path, bytes: 'later' })),
        {
          lockPollMs: 5,
          lockWaitMs: 25,
        },
      ),
      /manual recovery/u,
    );
    assert.deepEqual(await snapshotTree(root), before);
  });
}

test('interruption after recovery sentinel creation and before rollback remains permanently blocking', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mundus-publish-before-rollback-'));
  const paths = ['one.bin', 'two.bin', 'manifest.json'].map((name) =>
    join(root, name),
  );
  await Promise.all(paths.map((path) => writeFile(path, 'old')));
  let forwardRenames = 0;
  let restoreRenames = 0;
  const { rename } = await import('node:fs/promises');

  await assert.rejects(
    publishAssetSet(
      paths.map((path) => ({ path, bytes: 'new' })),
      {
        async rename(from, to) {
          forwardRenames += 1;
          if (forwardRenames === 6) throw new Error('publication failed');
          await rename(from, to);
        },
        async rollbackRename(from, to) {
          restoreRenames += 1;
          await rename(from, to);
        },
        afterRecoverySentinel: async () => {
          throw new Error('interrupted before rollback');
        },
      },
    ),
    /interrupted before rollback/,
  );

  assert.equal(restoreRenames, 0);
  const lockPath = assetSetLockPath(paths);
  await access(join(lockPath, 'recovery-required'));
  const before = await snapshotTree(root);
  await assert.rejects(
    publishAssetSet(
      paths.map((path) => ({ path, bytes: 'later' })),
      {
        lockPollMs: 5,
        lockWaitMs: 25,
      },
    ),
    /recovery required.*manual recovery/u,
  );
  assert.deepEqual(await snapshotTree(root), before);
});

test('publishes every file with the manifest last', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mundus-vector-publish-'));
  const paths = [
    join(root, '110.mvg'),
    join(root, '50.mvg'),
    join(root, 'manifest.json'),
  ];
  await Promise.all(
    paths.map((path, index) => writeFile(path, `old-${index}`)),
  );
  await publishAssetSet(
    paths.map((path, index) => ({ path, bytes: `new-${index}` })),
  );
  assert.deepEqual(
    await Promise.all(paths.map((path) => readFile(path, 'utf8'))),
    ['new-0', 'new-1', 'new-2'],
  );
});

for (let failAt = 1; failAt <= 6; failAt += 1) {
  test(`restores the prior complete set when rename ${failAt} fails`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'mundus-vector-rollback-'));
    const paths = [
      join(root, '110.mvg'),
      join(root, '50.mvg'),
      join(root, 'manifest.json'),
    ];
    await Promise.all(
      paths.map((path, index) => writeFile(path, `old-${index}`)),
    );
    let renameCount = 0;
    const { rename } = await import('node:fs/promises');
    await assert.rejects(
      publishAssetSet(
        paths.map((path, index) => ({ path, bytes: `new-${index}` })),
        {
          async rename(from, to) {
            renameCount += 1;
            if (renameCount === failAt)
              throw new Error(`injected rename ${failAt}`);
            await rename(from, to);
          },
        },
      ),
      /injected rename/,
    );
    assert.deepEqual(
      await Promise.all(paths.map((path) => readFile(path, 'utf8'))),
      ['old-0', 'old-1', 'old-2'],
    );
    assert.deepEqual((await readdir(root)).sort(), [
      '110.mvg',
      '50.mvg',
      'manifest.json',
    ]);
  });
}

for (let restoreFailAt = 1; restoreFailAt <= 3; restoreFailAt += 1) {
  test(`attempts every restore and preserves recovery files when restore ${restoreFailAt} fails`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'mundus-vector-restore-fail-'));
    const paths = [
      join(root, '110.mvg'),
      join(root, '50.mvg'),
      join(root, 'manifest.json'),
    ];
    await Promise.all(
      paths.map((path, index) => writeFile(path, `old-${index}`)),
    );
    let forwardRenames = 0;
    let restoreRenames = 0;
    const { rename } = await import('node:fs/promises');

    await assert.rejects(
      publishAssetSet(
        paths.map((path, index) => ({ path, bytes: `new-${index}` })),
        {
          async rename(from, to) {
            forwardRenames += 1;
            if (forwardRenames === 6) throw new Error('publication failed');
            await rename(from, to);
          },
          async rollbackRename(from, to) {
            restoreRenames += 1;
            if (restoreRenames === restoreFailAt) {
              throw new Error(`restore ${restoreFailAt} failed`);
            }
            await rename(from, to);
          },
        },
      ),
      (error) => {
        assert.equal(error instanceof AggregateError, true);
        assert.match(String(error), /publication failed/);
        assert.match(
          String(error),
          new RegExp(`restore ${restoreFailAt} failed`),
        );
        return true;
      },
    );

    assert.equal(restoreRenames, 3);
    const staging = (await readdir(root)).find((name) =>
      name.startsWith('.vector-stage-'),
    );
    assert.ok(staging);
    const recoveryFiles = await readdir(join(root, staging));
    assert.ok(recoveryFiles.some((name) => name.endsWith('.old')));
    await access(join(root, staging));
    await access(join(assetSetLockPath(paths), 'recovery-required'));
  });
}

async function waitForPath(path) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      await access(path);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }
  throw new Error(`Timed out waiting for ${path}`);
}

async function waitForChild(child) {
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  return { code, stdout, stderr };
}

async function snapshotTree(root, relative = '') {
  const current = join(root, relative);
  const entries = (await readdir(current, { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name, 'und'),
  );
  const snapshot = {};
  for (const entry of entries) {
    const path = relative ? join(relative, entry.name) : entry.name;
    snapshot[path] = entry.isDirectory()
      ? await snapshotTree(root, path)
      : await readFile(join(root, path), 'utf8');
  }
  return snapshot;
}
