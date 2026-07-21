import { access, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve, sep } from 'node:path';

export async function publishAssetSet(entries, operations = {}) {
  const move = operations.rename ?? rename;
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
    for (const entry of [...staged].reverse()) {
      if (entry.published) await rm(entry.path, { force: true });
      if (entry.backedUp) await rename(entry.backup, entry.path);
    }
    throw error;
  } finally {
    await Promise.all(
      staged.flatMap((entry) => [
        rm(entry.temporary, { force: true }),
        rm(entry.backup, { force: true }),
      ]),
    );
    await rm(stagingDirectory, { recursive: true, force: true });
  }
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
