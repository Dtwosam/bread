import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BREAD_LAUNCH_TOKEN_DECIMALS } from '../../packages/protocol-sdk/src/index.js';

const root = resolve(import.meta.dirname, '../..');

describe('Day 7 Task 5 launch token decimals authority', () => {
  it('keeps the SDK consumer constant tied to the canonical LaunchToken ERC20 implementation', () => {
    const source = readFileSync(resolve(root, 'contracts/src/core/BreadLaunchToken.sol'), 'utf8');

    expect(source).toContain('is ERC20');
    expect(source).not.toMatch(/function\s+decimals\s*\(/);
    expect(BREAD_LAUNCH_TOKEN_DECIMALS).toBe(18);
  });
});
