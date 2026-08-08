import { readFile } from 'node:fs/promises';
const text = await readFile('docs/current-build-state.yaml', 'utf8');
const required = [
  'project: Bread',
  'active_checkpoint: "7B"',
  'CURRENT_PONS_FACTORY_SOURCE_PARITY',
  'EXACT_SNIPE_IMPLEMENTATION',
  'LAUNCH_AND_BUY_SOURCE',
  'FEE_ESCROW_SOURCE',
  'ARC_MAINNET_VALUES',
  'next_action:'
];
for (const token of required) {
  if (!text.includes(token)) throw new Error(`current-build-state missing ${token}`);
}
if (/private[_ -]?key|seed phrase|api[_ -]?token\s*:/i.test(text)) {
  throw new Error('handoff may contain secret-bearing field names/values');
}
console.log('build-state-validation: PASS');
