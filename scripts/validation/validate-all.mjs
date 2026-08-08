import { spawnSync } from 'node:child_process';
const scripts = [
  'scripts/validation/validate-manifests.mjs',
  'scripts/validation/validate-build-gates.mjs',
  'scripts/validation/validate-build-state.mjs',
  'scripts/validation/validate-day2-source-integrity.mjs',
  'scripts/validation/validate-day3-source-integrity.mjs',
  'scripts/validation/validate-day4-launch-control-source-integrity.mjs'
];
for (const script of scripts) {
  const result = spawnSync(process.execPath, [script], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('bootstrap-validation: PASS');
