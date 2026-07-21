import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const verifier = resolve('scripts/verify-pages-artifact.mjs');

async function createArtifact({
  javascript = '',
  stylesheet = '',
  notices = '## react@19\n\nMIT license text\n',
} = {}) {
  const root = await mkdtemp(join(tmpdir(), 'mundus-pages-'));
  await mkdir(join(root, 'assets'));
  await Promise.all([
    writeFile(
      join(root, 'index.html'),
      '<title>Mundus · 交互式三维地球实验室</title><div id="root"></div><script src="./assets/app.js"></script><link href="./assets/app.css" rel="stylesheet">',
    ),
    writeFile(
      join(root, 'favicon.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg"/>',
    ),
    writeFile(join(root, 'LICENSE'), 'MIT'),
    writeFile(join(root, 'THIRD_PARTY_LICENSES.md'), '# Third-party licenses'),
    writeFile(join(root, 'THIRD_PARTY_NOTICES.md'), notices),
    writeFile(join(root, 'assets/app.js'), javascript),
    writeFile(join(root, 'assets/app.css'), stylesheet),
    writeFile(
      join(root, 'assets/natural-earth-vector-globe-110m-test.mvg'),
      '110m',
    ),
    writeFile(
      join(root, 'assets/natural-earth-vector-globe-50m-test.mvg'),
      '50m',
    ),
  ]);
  return root;
}

async function verifyFailure(root, expectedMessage) {
  await assert.rejects(
    execFileAsync(process.execPath, [verifier, root]),
    (error) => error.stderr.includes(expectedMessage),
  );
}

test('rejects root-relative references in JavaScript', async () => {
  const root = await createArtifact({ javascript: "fetch('/data.json')" });
  await verifyFailure(root, 'Root-relative asset breaks project Pages');
});

test('rejects root-relative references in CSS', async () => {
  const root = await createArtifact({
    stylesheet: "body{background:url('/image.png')}",
  });
  await verifyFailure(root, 'Root-relative asset breaks project Pages');
});

test('rejects an empty bundled notices file', async () => {
  const root = await createArtifact({ notices: '' });
  await verifyFailure(root, 'Bundled dependency notices are empty');
});

test('rejects a missing vector globe resolution', async () => {
  const root = await createArtifact();
  await import('node:fs/promises').then(({ rm }) =>
    rm(join(root, 'assets/natural-earth-vector-globe-50m-test.mvg')),
  );
  await verifyFailure(root, 'Missing 50m vector globe asset');
});

test('Pages workflow serializes the complete production deployment', async () => {
  const workflow = await import('node:fs/promises').then(({ readFile }) =>
    readFile(resolve('.github/workflows/pages.yml'), 'utf8'),
  );
  const workflowConcurrency = workflow.indexOf('\nconcurrency:');
  const jobs = workflow.indexOf('\njobs:');

  assert.ok(workflowConcurrency > 0 && workflowConcurrency < jobs);
  assert.match(workflow, /github-pages-production/);
  assert.match(workflow, /github-pages-pr-\{0\}/);
  assert.match(workflow, /github\.event\.pull_request\.number/);
  assert.match(workflow, /cancel-in-progress: true/);
});
