import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { licenseNoticeOverrides } from './license-notice-overrides.mjs';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'dist');

await mkdir(output, { recursive: true });
await Promise.all(
  ['LICENSE', 'THIRD_PARTY_LICENSES.md'].map((file) =>
    copyFile(resolve(root, file), resolve(output, file)),
  ),
);

const bundledNoticesPath = resolve(output, 'THIRD_PARTY_NOTICES.md');
let bundledNotices = await readFile(bundledNoticesPath, 'utf8');

for (const [title, notice] of Object.entries(licenseNoticeOverrides)) {
  const emptyEntry = `## ${title}\n\n`;
  if (!bundledNotices.includes(emptyEntry)) {
    throw new Error(`Missing empty Vite license entry for override: ${title}`);
  }
  bundledNotices = bundledNotices.replace(
    emptyEntry,
    `${emptyEntry}${notice}\n\n`,
  );
}

const emptyEntries = [...bundledNotices.matchAll(/^## (.+)\n\n(?=## |$)/gm)];
if (emptyEntries.length > 0) {
  throw new Error(
    `Bundled dependencies without license text: ${emptyEntries.map((match) => match[1]).join(', ')}`,
  );
}

await writeFile(bundledNoticesPath, bundledNotices);

console.log(
  'Completed release license inventory and bundled notices in dist/.',
);
