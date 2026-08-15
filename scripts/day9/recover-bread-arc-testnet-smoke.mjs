import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = process.cwd();
const smoke = join(ROOT, 'scripts', 'day9', 'smoke-bread-arc-testnet.mjs');
const verify = join(ROOT, 'packages', 'protocol-sdk', 'scripts', 'verify-day9-arc-smoke.mjs');

function run(path, timeout) {
  const result = spawnSync(process.execPath, [path], {
    cwd: ROOT,
    env: process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 128 * 1024 * 1024,
    timeout,
  });
  if (result.error) {
    console.error(`day9-arc-smoke-recovery: FAIL: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`day9-arc-smoke-recovery: FAIL: ${path} exited ${result.status}`);
    if (result.stdout) console.error(result.stdout.trim());
    if (result.stderr) console.error(result.stderr.trim());
    process.exit(result.status ?? 1);
  }
  return result.stdout.trim();
}

const smokeOutput = run(smoke, 600_000);
const verificationOutput = run(verify, 240_000);

console.log(JSON.stringify({
  status: 'BREAD_ARC_TESTNET_SMOKE_RECOVERY_AND_FINAL_VERIFY_PASS',
  execution: JSON.parse(smokeOutput),
  independentFinalVerification: JSON.parse(verificationOutput),
  productionMoneyClaim: false,
  privateKeysPrinted: false,
  nextAction: 'RECORD_DAY9_PUBLIC_ARC_EVIDENCE_AND_RUN_REMAINING_GATES',
}, null, 2));
