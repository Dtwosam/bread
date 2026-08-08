import { readFile } from 'node:fs/promises';

const text = await readFile('docs/current-build-state.yaml', 'utf8');
const required = [
  'project: Bread',
  'active_checkpoint:',
  'active_lane:',
  'integration_baseline:',
  'working_branches:',
  'repository:',
  'verification:',
  'blockers:',
  'next_action:',
  'do_not_do:'
];

for (const token of required) {
  if (!text.includes(token)) throw new Error(`current-build-state missing ${token}`);
}

if (/active_checkpoint:\s*(?:""|null)\s*$/m.test(text)) {
  throw new Error('current-build-state active_checkpoint must be non-empty');
}
if (/private[_ -]?key|seed phrase|api[_ -]?token\s*:/i.test(text)) {
  throw new Error('handoff may contain secret-bearing field names/values');
}

console.log('build-state-validation: PASS');
