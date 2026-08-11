import { describe, expect, it } from 'vitest';

import { assessArcTestnetSmokeFunding } from '../../scripts/day9/arc-testnet-smoke-readiness-lib.mjs';

describe('Day 9 Arc Testnet smoke funding gate', () => {
  it('requires the explicit 12 USDC public-testnet funding floor', () => {
    expect(assessArcTestnetSmokeFunding(11_999_999n)).toEqual({
      ready: false,
      currentUsdc: '11999999',
      minimumUsdc: '12000000',
      missingUsdc: '1',
    });

    expect(assessArcTestnetSmokeFunding(12_000_000n)).toEqual({
      ready: true,
      currentUsdc: '12000000',
      minimumUsdc: '12000000',
      missingUsdc: '0',
    });
  });

  it('rejects negative balances', () => {
    expect(() => assessArcTestnetSmokeFunding(-1n)).toThrow(/negative/i);
  });
});
