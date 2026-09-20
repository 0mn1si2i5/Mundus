import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertToolchain,
  REQUIRED_NODE_VERSION,
  toolchainError,
} from './verify-toolchain.mjs';

test('accepts the pinned Node.js runtime', () => {
  assert.equal(toolchainError(REQUIRED_NODE_VERSION), null);
  assert.doesNotThrow(() => assertToolchain(REQUIRED_NODE_VERSION));
});

test('rejects other Node.js versions before data verification', () => {
  const error = toolchainError('26.8.1');
  assert.match(error, /require Node\.js 22\.23\.1/u);
  assert.throws(() => assertToolchain('26.8.1'), /received 26\.8\.1/u);
});
