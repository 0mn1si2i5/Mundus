import { randomUUID } from 'node:crypto';
import {
  access,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, join, resolve, sep } from 'node:path';

export async function publishAssetSet(entries, operations = {}) {
  const lock = await acquireAssetSetLock(
    entries.map((entry) => entry.path),
    operations,
  );
  let publicationError;
  try {
    await publishAssetSetUnlocked(entries, operations, lock);
  } catch (error) {
    publicationError = error;
  }
  if (publicationError?.recoveryRequired) throw publicationError;
  try {
    await lock.release();
  } catch (releaseError) {
    if (publicationError) {
      throw new AggregateError(
        [publicationError, releaseError],
        `Asset publication and lock release failed: ${publicationError.message}; ${releaseError.message}`,
      );
    }
    throw releaseError;
  }
  if (publicationError) throw publicationError;
}

async function publishAssetSetUnlocked(entries, operations, lock) {
  const move = operations.rename ?? rename;
  const restore = operations.rollbackRename ?? rename;
  const token = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const stagingDirectory = join(
    commonDirectory(entries.map((entry) => entry.path)),
    `.vector-stage-${token}`,
  );
  await mkdir(stagingDirectory, { recursive: false });
  const staged = entries.map((entry, index) => ({
    ...entry,
    temporary: join(stagingDirectory, `${index}-${basename(entry.path)}.new`),
    backup: join(stagingDirectory, `${index}-${basename(entry.path)}.old`),
    hadPrior: false,
    backedUp: false,
    published: false,
  }));
  let preserveRecovery = false;
  try {
    await Promise.all(
      staged.map((entry) => writeFile(entry.temporary, entry.bytes)),
    );
    for (const entry of staged) {
      entry.hadPrior = await exists(entry.path);
      if (entry.hadPrior) {
        await move(entry.path, entry.backup);
        entry.backedUp = true;
      }
    }
    for (const entry of staged) {
      await move(entry.temporary, entry.path);
      entry.published = true;
    }
  } catch (error) {
    const recoveryPaths = {
      stagingDirectory,
      backups: staged
        .filter((entry) => entry.backedUp)
        .map((entry) => ({ destination: entry.path, backup: entry.backup })),
    };
    try {
      await markRecoverySentinels(lock, recoveryPaths, operations);
      if (operations.afterRecoverySentinel) {
        await operations.afterRecoverySentinel(lock, recoveryPaths);
      }
    } catch (sentinelError) {
      preserveRecovery = true;
      const aggregate = new AggregateError(
        [error, sentinelError],
        `Asset publication failed before rollback: ${error.message}; ${sentinelError.message}`,
      );
      aggregate.recoveryRequired = true;
      aggregate.recoveryPaths = recoveryPaths;
      throw aggregate;
    }
    const rollbackErrors = [];
    for (const entry of [...staged].reverse()) {
      if (entry.published) {
        try {
          await rm(entry.path, { force: true });
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
      if (entry.backedUp) {
        try {
          await restore(entry.backup, entry.path);
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
    }
    if (rollbackErrors.length) {
      preserveRecovery = true;
      const errors = [error, ...rollbackErrors];
      try {
        await markLockRecoveryRequired(lock, recoveryPaths);
      } catch (metadataError) {
        errors.push(metadataError);
      }
      const aggregate = new AggregateError(
        errors,
        errors.map((failure) => failure.message).join('; '),
      );
      aggregate.recoveryRequired = true;
      aggregate.recoveryPaths = recoveryPaths;
      throw aggregate;
    }
    await clearRecoverySentinels(lock);
    throw error;
  } finally {
    if (!preserveRecovery) {
      await Promise.all(
        staged.flatMap((entry) => [
          rm(entry.temporary, { force: true }),
          rm(entry.backup, { force: true }),
        ]),
      );
      await rm(stagingDirectory, { recursive: true, force: true });
    }
  }
}

export function assetSetLockPath(paths) {
  const first = normalizedDestinations(paths)[0];
  if (!first) throw new Error('Asset publication requires a destination');
  return `${first}.mundus-publish-lock`;
}

export async function acquireAssetSetLock(paths, operations = {}) {
  const destinations = normalizedDestinations(paths);
  if (!destinations.length)
    throw new Error('Asset publication requires a destination');
  const owner = {
    pid: process.pid,
    processStartedAt: new Date(
      Date.now() - Math.floor(process.uptime() * 1000),
    ).toISOString(),
    acquiredAt: new Date((operations.now ?? Date.now)()).toISOString(),
    ownerId: randomUUID(),
    destinations,
    publicationActive: true,
  };
  const acquired = [];
  try {
    for (const destination of destinations) {
      const path = `${destination}.mundus-publish-lock`;
      await acquireLockDirectory(path, owner, operations);
      acquired.push(path);
    }
  } catch (error) {
    await releaseOwnedLocks(acquired, owner);
    throw error;
  }
  return {
    path: acquired[0],
    paths: acquired,
    owner,
    release: () => releaseOwnedLocks(acquired, owner),
  };
}

async function acquireLockDirectory(path, owner, operations) {
  const pollMs = operations.lockPollMs ?? 50;
  const waitMs = operations.lockWaitMs ?? 30_000;
  const now = operations.now ?? Date.now;
  const started = now();
  let lastOwner = null;
  while (now() - started <= waitMs) {
    try {
      await mkdir(path);
      try {
        await writeFile(
          join(path, 'owner.json'),
          `${JSON.stringify(owner, null, 2)}\n`,
          { flag: 'wx' },
        );
        await writeFile(join(path, 'publication-active'), '', { flag: 'wx' });
      } catch (error) {
        await rm(path, { recursive: true, force: true });
        throw error;
      }
      return;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }

    lastOwner = await readLockOwner(path);
    await new Promise((resolveWait) => setTimeout(resolveWait, pollMs));
  }
  const blockingSentinel = await lockSentinel(path);
  if (blockingSentinel) {
    if (blockingSentinel === 'recovery-required') {
      throw new Error(
        `Timed out waiting for asset publication lock ${path}; recovery required and manual recovery must complete before publication`,
      );
    }
    throw new Error(
      `Timed out waiting for asset publication lock ${path}; publication active for owner pid ${String(lastOwner?.pid ?? 'unknown')}; interrupted owners require manual recovery`,
    );
  }
  if (lastOwner?.publicationActive) {
    throw new Error(
      `Timed out waiting for asset publication lock ${path}; publication active for owner pid ${String(lastOwner.pid ?? 'unknown')}; interrupted owners require manual recovery`,
    );
  }
  throw new Error(
    `Timed out waiting for asset publication lock ${path}; owner pid ${String(lastOwner?.pid ?? 'unknown')}, acquired ${String(lastOwner?.acquiredAt ?? 'unknown')}; manual inspection is required`,
  );
}

async function markRecoverySentinels(lock, recoveryPaths, operations) {
  const write = operations.writeRecoverySentinel ?? writeFile;
  const move = operations.renameRecoverySentinel ?? rename;
  const completed = [];
  try {
    for (const path of lock.paths) {
      const temporary = join(
        path,
        `recovery-required.new-${lock.owner.ownerId}`,
      );
      await write(
        temporary,
        `${JSON.stringify({ ownerId: lock.owner.ownerId, recoveryPaths }, null, 2)}\n`,
        { flag: 'wx' },
      );
      await move(temporary, join(path, 'recovery-required'));
      completed.push(path);
    }
  } catch (error) {
    // publication-active remains in every lock, including partially transitioned locks.
    throw error;
  }
}

async function clearRecoverySentinels(lock) {
  for (const path of lock.paths) {
    await rm(join(path, 'recovery-required'), { force: true });
  }
}

async function lockSentinel(path) {
  for (const name of ['recovery-required', 'publication-active']) {
    try {
      await access(join(path, name));
      return name;
    } catch {}
  }
  return null;
}

async function markLockRecoveryRequired(lock, recoveryPaths) {
  const errors = [];
  for (const path of lock.paths) {
    const temporary = join(path, `owner.json.recovery-${lock.owner.ownerId}`);
    try {
      const current = await readLockOwner(path);
      if (current?.ownerId !== lock.owner.ownerId) {
        throw new Error(`Asset publication lock ownership changed: ${path}`);
      }
      const metadata = {
        ...current,
        recoveryRequired: true,
        recoveryMarkedAt: new Date().toISOString(),
        recoveryPaths,
      };
      await writeFile(temporary, `${JSON.stringify(metadata, null, 2)}\n`, {
        flag: 'wx',
      });
      await rename(temporary, join(path, 'owner.json'));
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length) {
    throw new AggregateError(
      errors,
      errors.map((error) => error.message).join('; '),
    );
  }
}

async function releaseOwnedLocks(paths, owner) {
  const errors = [];
  for (const path of [...paths].reverse()) {
    const releasePath = `${path}.release-${owner.ownerId}`;
    try {
      await rename(path, releasePath);
      const current = await readLockOwner(releasePath);
      if (current?.ownerId !== owner.ownerId) {
        await rename(releasePath, path);
        throw new Error(`Asset publication lock ownership changed: ${path}`);
      }
      await rm(releasePath, { recursive: true });
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length) {
    throw new AggregateError(
      errors,
      errors.map((error) => error.message).join('; '),
    );
  }
}

async function readLockOwner(path) {
  try {
    return JSON.parse(await readFile(join(path, 'owner.json'), 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    return null;
  }
}

function normalizedDestinations(paths) {
  return [...new Set(paths.map((path) => resolve(path)))].sort((a, b) =>
    a.localeCompare(b, 'und'),
  );
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function commonDirectory(paths) {
  const parts = paths.map((path) => resolve(dirname(path)).split(sep));
  const shared = [];
  for (let index = 0; index < parts[0].length; index += 1) {
    const value = parts[0][index];
    if (!parts.every((part) => part[index] === value)) break;
    shared.push(value);
  }
  return shared.join(sep) || sep;
}
