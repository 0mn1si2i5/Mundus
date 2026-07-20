import { lstat, readFile, readdir } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] ?? 'dist');
const files = new Set();

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = resolve(directory, entry.name);
    const stats = await lstat(absolute);
    const path = relative(root, absolute).split(sep).join('/');

    if (stats.isSymbolicLink()) {
      throw new Error(`Pages artifact must not contain symlinks: ${path}`);
    }
    if (stats.isDirectory()) await walk(absolute);
    else if (stats.isFile()) files.add(path);
  }
}

await walk(root);

const required = [
  'index.html',
  'favicon.svg',
  'LICENSE',
  'THIRD_PARTY_LICENSES.md',
  'THIRD_PARTY_NOTICES.md',
];
for (const path of required) {
  if (!files.has(path)) throw new Error(`Missing release artifact: ${path}`);
}

const sourceMaps = [...files].filter((path) => /\.map$/i.test(path));
if (sourceMaps.length > 0) {
  throw new Error(
    `Production source maps are prohibited: ${sourceMaps.join(', ')}`,
  );
}

const index = await readFile(resolve(root, 'index.html'), 'utf8');
if (!index.includes('<title>Mundus · 交互式三维地球实验室</title>')) {
  throw new Error('Unexpected production document title.');
}
if (!index.includes('<div id="root"></div>')) {
  throw new Error('Production document is missing the application root.');
}

const references = [
  ...index.matchAll(/\b(?:href|src)=["']([^"'#?]+)["']/g),
].map((match) => match[1]);
for (const reference of references) {
  if (/^(?:[a-z]+:)?\/\//i.test(reference) || reference.startsWith('data:')) {
    continue;
  }
  if (reference.startsWith('/')) {
    throw new Error(`Root-relative asset breaks project Pages: ${reference}`);
  }
  const path = reference.replace(/^\.\//, '');
  if (!files.has(path))
    throw new Error(`Missing referenced asset: ${reference}`);
}

for (const sourcePath of [...files].filter((path) =>
  /\.(?:html|js|css)$/.test(path),
)) {
  const source = await readFile(resolve(root, sourcePath), 'utf8');
  if (/sourceMappingURL\s*=/.test(source)) {
    throw new Error(`Inline source-map reference in ${sourcePath}`);
  }
  const rootRelativeReferences = [
    ...source.matchAll(
      /["'(]((?:\/(?!\/))[^"'()`?#\s]+\.(?:js|css|svg|json|png|jpe?g|webp|avif|gif|ico|woff2?|ttf|otf|wasm))(?:[?#][^"'()`\s]*)?["')]/gi,
    ),
  ].map((match) => match[1]);
  if (rootRelativeReferences.length > 0) {
    throw new Error(
      `Root-relative asset breaks project Pages in ${sourcePath}: ${rootRelativeReferences.join(', ')}`,
    );
  }
  const relativeReferences = [
    ...source.matchAll(
      /(\.\.?\/[A-Za-z0-9_./-]+\.(?:js|css|svg|json|png|jpe?g|webp|avif|gif|ico|woff2?|ttf|otf|wasm))\b/gi,
    ),
  ].map((match) => match[1]);
  const sourceDirectory = resolve(root, sourcePath, '..');

  for (const reference of relativeReferences) {
    const target = relative(root, resolve(sourceDirectory, reference))
      .split(sep)
      .join('/');
    if (target.startsWith('../') || !files.has(target)) {
      throw new Error(`Broken asset reference in ${sourcePath}: ${reference}`);
    }
  }
}

if (![...files].some((path) => /^assets\/.+\.js$/.test(path))) {
  throw new Error('Pages artifact contains no JavaScript bundle.');
}
if (![...files].some((path) => /^assets\/.+\.css$/.test(path))) {
  throw new Error('Pages artifact contains no stylesheet bundle.');
}

const notices = await readFile(resolve(root, 'THIRD_PARTY_NOTICES.md'), 'utf8');
if (notices.trim().length === 0) {
  throw new Error('Bundled dependency notices are empty.');
}
const emptyNotices = [...notices.matchAll(/^## (.+)\n\n(?=## |$)/gm)];
if (emptyNotices.length > 0) {
  throw new Error(
    `Bundled dependencies without license text: ${emptyNotices
      .map((match) => match[1])
      .join(', ')}`,
  );
}

console.log(
  `Verified Pages artifact: ${files.size} files, ${references.length} document assets, 0 source maps.`,
);
