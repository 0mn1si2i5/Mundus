import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REQUIRED_NODE_VERSION = '22.23.1';

export function toolchainError(nodeVersion) {
  if (nodeVersion === REQUIRED_NODE_VERSION) return null;
  return `Mundus data gates require Node.js ${REQUIRED_NODE_VERSION}; received ${nodeVersion}. Select the pinned runtime before running pnpm data:verify or pnpm check.`;
}

export function assertToolchain(nodeVersion = process.versions.node) {
  const error = toolchainError(nodeVersion);
  if (error) throw new Error(error);
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  try {
    assertToolchain();
    console.log(
      `Node.js ${REQUIRED_NODE_VERSION} verified for Mundus data gates.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
