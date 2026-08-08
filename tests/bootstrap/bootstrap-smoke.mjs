import { access, readFile } from 'node:fs/promises';

const requiredPaths = [
  'contracts/foundry.toml',
  'apps/web/package.json',
  'apps/api/package.json',
  'apps/indexer/package.json',
  'apps/operator/package.json',
  'packages/config/package.json',
  'packages/protocol-sdk/package.json',
  'packages/db/package.json',
  'packages/ui/package.json',
  'packages/types/package.json',
  'packages/observability/package.json',
  'config/networks/arc-testnet.json',
  'config/networks/arc-mainnet.json',
  'config/protocol/build-gates.json',
  'docs/current-build-state.yaml',
  'scripts/load/hot-launch-smoke.mjs'
];
for (const path of requiredPaths) await access(path);
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
if (pkg.packageManager !== 'pnpm@11.15.1') throw new Error('pnpm version not pinned');
console.log('bootstrap-smoke: PASS');
