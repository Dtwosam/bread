import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const e2eDirectory = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(e2eDirectory, '..');
const repositoryRoot = resolve(webRoot, '../..');
const deploymentPath = resolve(repositoryRoot, 'config/deployments/arc-testnet.day5.json');
const fixturePath = resolve(e2eDirectory, 'fixtures/protocol-deployment.json');

const originalDeployment = await readFile(deploymentPath);
const fixtureDeployment = await readFile(fixturePath);
let child = null;
let restored = false;
let interrupted = false;

async function restoreDeployment() {
  if (!restored) {
    await writeFile(deploymentPath, originalDeployment);
    restored = true;
  }
  const restoredBytes = await readFile(deploymentPath);
  if (!restoredBytes.equals(originalDeployment)) {
    throw new Error('Playwright E2E failed to restore the canonical Arc testnet deployment manifest byte-for-byte.');
  }
}

function forwardSignal(signal) {
  interrupted = true;
  if (child && child.exitCode === null && child.signalCode === null) child.kill(signal);
}

process.on('SIGINT', () => forwardSignal('SIGINT'));
process.on('SIGTERM', () => forwardSignal('SIGTERM'));

try {
  await writeFile(deploymentPath, fixtureDeployment);

  child = spawn(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['exec', 'playwright', 'test', '--config', 'playwright.config.ts'],
    {
      cwd: webRoot,
      env: { ...process.env, BREAD_E2E: '1' },
      stdio: 'inherit',
    },
  );

  const exitCode = await new Promise((resolveExit, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolveExit(code));
  });

  process.exitCode = interrupted ? 130 : (exitCode ?? 1);
} finally {
  await restoreDeployment();
}
