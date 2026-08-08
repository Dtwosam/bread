import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Day 2 frozen dependency integrity is part of bootstrap validation', async () => {
  const validateAll = await readFile('scripts/validation/validate-all.mjs', 'utf8');
  assert.match(validateAll, /validate-day2-source-integrity\.mjs/);
});
