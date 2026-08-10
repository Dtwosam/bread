import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const webBuildPath = path.join(repoRoot, 'apps/web/.next');
const manifestPaths = [
  path.join(repoRoot, 'config/deployments/arc-testnet.day5.json'),
  path.join(repoRoot, 'config/networks/arc-testnet.json'),
];
const markerPath = process.env.BREAD_DAY9_BROWSER_RECOVERY_MARKER;

function fail(message) {
  console.error(`day9-browser-recovery: FAIL: ${message}`);
  process.exitCode = 1;
}

function gitHead() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error(`git rev-parse HEAD failed\n${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  }
  return String(result.stdout).trim();
}

function runCanonicalBrowserHarness() {
  const env = { ...process.env };
  delete env.NODE_ENV;
  const result = spawnSync('pnpm', ['--filter', '@bread/web', 'test:e2e'], {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'inherit', 'inherit'],
    timeout: 720_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `canonical Day-7 Playwright harness failed with status ${String(result.status)} signal=${String(result.signal)}`,
    );
  }
}

if (!markerPath) {
  fail('BREAD_DAY9_BROWSER_RECOVERY_MARKER is required');
} else {
  const originals = new Map();
  let browserPassed = false;

  try {
    for (const manifestPath of manifestPaths) {
      originals.set(manifestPath, await readFile(manifestPath));
    }

    // The browser proof must start from the same clean generated-web state as
    // the dedicated Day-7 Playwright workflow. This script runs directly from
    // the CI shell, not under Vitest, and removes only the generated Next tree.
    await rm(webBuildPath, { recursive: true, force: true });
    runCanonicalBrowserHarness();
    browserPassed = true;
  } catch (error) {
    fail(error instanceof Error ? error.stack ?? error.message : String(error));
  } finally {
    try {
      for (const [manifestPath, original] of originals) {
        await writeFile(manifestPath, original);
        const restored = await readFile(manifestPath);
        if (!restored.equals(original)) {
          throw new Error(`manifest restoration mismatch: ${path.relative(repoRoot, manifestPath)}`);
        }
      }
    } catch (error) {
      browserPassed = false;
      fail(error instanceof Error ? error.stack ?? error.message : String(error));
    }
  }

  if (browserPassed) {
    const commit = gitHead();
    await mkdir(path.dirname(markerPath), { recursive: true });
    const proof = {
      status: 'PASS',
      commit,
      evidenceKind: 'EXECUTED_TEST',
      evidence:
        'same-job canonical Day-7 Playwright harness; apps/web/e2e/specs/transaction-recovery.spec.ts included; Day-9 outer manifest restoration PASS',
      transactionRecoverySpecIncluded: true,
      manifestRestoration: 'PASS',
    };
    await writeFile(markerPath, `${JSON.stringify(proof)}\n`, 'utf8');
    console.log(`DAY9_BROWSER_RECOVERY_DRILL_PASS commit=${commit}`);
  }
}
