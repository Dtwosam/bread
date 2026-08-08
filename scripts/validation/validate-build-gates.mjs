import { readFile } from 'node:fs/promises';
const data = JSON.parse(await readFile('config/protocol/build-gates.json', 'utf8'));
const required = new Map([
  ['CURRENT_PONS_FACTORY_SOURCE_PARITY', 'BLOCKED'],
  ['EXACT_SNIPE_IMPLEMENTATION', 'BLOCKED'],
  ['LAUNCH_AND_BUY_SOURCE', 'BLOCKED'],
  ['FEE_ESCROW_SOURCE', 'BLOCKED'],
  ['LIVE_RUNTIME_CONFIG', 'BLOCKED'],
  ['PONS_AUDIT_FINDINGS', 'MONITOR'],
  ['ARC_MAINNET_VALUES', 'EXPECTED_UNRESOLVED']
]);
const seen = new Map(data.gates.map((g) => [g.id, g.status]));
for (const [id, expected] of required) {
  if (seen.get(id) !== expected) throw new Error(`${id} expected ${expected}, got ${seen.get(id)}`);
}
console.log('build-gates-validation: PASS');
