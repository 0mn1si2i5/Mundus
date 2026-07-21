import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { publishAssetSet } from './publish-asset-set.mjs';

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
  });
}
