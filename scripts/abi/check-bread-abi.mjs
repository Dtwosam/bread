import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { generateBreadAbiSource } from './generate-bread-abi.mjs';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const outputPath = path.join(repoRoot, 'packages/protocol-sdk/src/abi/generated.ts');
const expected = await generateBreadAbiSource();
const actual = await readFile(outputPath, 'utf8');

if (actual !== expected) {
  console.error('bread-abi-check: FAIL: generated ABI registry is stale');
  console.error('Run `pnpm abi:generate` after `forge build` and commit the result.');
  console.error('--- BEGIN EXPECTED GENERATED ABI ---');
  console.error(expected);
  console.error('--- END EXPECTED GENERATED ABI ---');
  process.exit(1);
}

console.log('bread-abi-check: PASS');
