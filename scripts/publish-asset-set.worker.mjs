import { access, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { publishAssetSet } from './publish-asset-set.mjs';

const [root, generation, mode = 'success'] = process.argv.slice(2);
const paths = ['one.bin', 'two.bin', 'manifest.json'].map((name) =>
  join(root, name),
);
let renameCount = 0;

await publishAssetSet(
  paths.map((path) => ({ path, bytes: generation })),
  {
    lockPollMs: 5,
    lockWaitMs: 5_000,
    async rename(from, to) {
      renameCount += 1;
      if (mode === 'pause-fail' && renameCount === 4) {
        await writeFile(join(root, 'a-paused'), '');
        while (!(await exists(join(root, 'release-a')))) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        throw new Error('A publication failed');
      }
      await rename(from, to);
    },
  },
);

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
