import { execFileSync } from 'node:child_process';
import { lstat, readdir, readFile, rm } from 'node:fs/promises';
import { basename, relative, resolve, sep } from 'node:path';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const json = args.has('--json');

const repositoryRoot = resolve(
  execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  }).trim(),
);
const worktreePaths = await discoverWorktrees(repositoryRoot);
const entries = [];

for (const worktreePath of worktreePaths) {
  for (const relativePath of ['.cache/ghsl']) {
    const path = resolve(worktreePath, relativePath);
    if (await exists(path)) {
      entries.push(await inspectEntry(repositoryRoot, worktreePath, path));
    }
  }
}

if (apply) {
  await prune(entries, { apply });
}

if (json) {
  console.log(JSON.stringify({ repositoryRoot, entries }, null, 2));
} else {
  printReport(repositoryRoot, entries, { apply });
}

async function discoverWorktrees(root) {
  const paths = new Set([root]);
  const directory = resolve(root, '.worktrees');
  if (!(await exists(directory))) return [...paths];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) paths.add(resolve(directory, entry.name));
  }
  return [...paths];
}

async function inspectEntry(root, worktreePath, path) {
  const files = [];
  let bytes = 0;
  await walk(path, async (filePath, stats) => {
    if (!stats.isFile()) return;
    const size = stats.size;
    bytes += size;
    files.push({
      path: relative(root, filePath).split(sep).join('/'),
      bytes: size,
    });
  });

  const pidFiles = files.filter((file) => basename(file.path).endsWith('.pid'));
  const pids = [];
  for (const file of pidFiles) {
    const pidPath = resolve(root, file.path);
    const value = (await readFile(pidPath, 'utf8')).trim();
    if (/^\d+$/.test(value)) {
      pids.push({
        path: file.path,
        pid: Number(value),
        active: isProcessAlive(Number(value)),
      });
    }
  }

  return {
    path: relative(root, path).split(sep).join('/'),
    worktree: relative(root, worktreePath).split(sep).join('/') || '.',
    registered: isRegisteredWorktree(root, worktreePath),
    bytes,
    files: files.length,
    generatedBytes: bytes,
    pids,
  };
}

async function walk(path, onFile) {
  const stats = await lstat(path);
  if (stats.isSymbolicLink()) return;
  if (stats.isFile()) {
    await onFile(path, stats);
    return;
  }
  if (!stats.isDirectory()) return;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    await walk(resolve(path, entry.name), onFile);
  }
}

async function prune(entries, { apply: shouldApply }) {
  for (const entry of entries) {
    console.log(`skip protected evidence ${entry.path}`);
    if (entry.pids.some((pid) => pid.active)) {
      throw new Error(`Refusing to prune active cache: ${entry.path}`);
    }
    const root = resolve(repositoryRoot, entry.path);
    const disposable = [];
    await collectDisposable(root, disposable);
    for (const path of disposable) {
      console.log(
        `${shouldApply ? 'remove' : 'would remove'} ${relative(repositoryRoot, path)}`,
      );
      if (shouldApply) await rm(path, { recursive: true, force: true });
    }
  }
}

async function collectDisposable(path, output) {
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    const child = resolve(path, entry.name);
    if (entry.isDirectory()) {
      if (/^current-run-\d+$/.test(entry.name)) {
        output.push(child);
      }
      continue;
    }
    if (
      entry.isFile() &&
      (entry.name.endsWith('.pid') || entry.name.endsWith('.log'))
    ) {
      output.push(child);
    }
  }
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function isRegisteredWorktree(root, worktreePath) {
  const listing = execFileSync('git', ['worktree', 'list', '--porcelain'], {
    cwd: root,
    encoding: 'utf8',
  });
  return listing
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .some(
      (line) =>
        resolve(line.slice('worktree '.length)) === resolve(worktreePath),
    );
}

function printReport(root, inspected, options) {
  console.log(`Local cache root: ${root}`);
  if (inspected.length === 0) {
    console.log('No known research cache directories found.');
    return;
  }
  for (const entry of inspected) {
    const active = entry.pids.filter((pid) => pid.active).map((pid) => pid.pid);
    console.log(
      `${entry.path}: ${formatBytes(entry.bytes)} in ${entry.files} files; ` +
        `${formatBytes(entry.generatedBytes)} generated; ` +
        `worktree=${entry.worktree} registered=${entry.registered} ` +
        `activePids=${active.length ? active.join(',') : 'none'}`,
    );
  }
  if (!options.apply) {
    console.log(
      'Dry run only. Use --apply to remove logs, pid files, and completed current-run directories.',
    );
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes;
  for (const unit of units) {
    value /= 1024;
    if (value < 1024 || unit === units.at(-1))
      return `${value.toFixed(1)} ${unit}`;
  }
  return `${bytes} B`;
}

async function exists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}
