import { describe, expect, it } from 'vitest';

import { computeIndexedMarketCap } from '../../packages/db/src/repositories/trades';

describe('v1.6.1 canonical indexed market-cap authority', () => {
  it('uses exact bigint price ratio times snapshotted fixed supply', () => {
    expect(computeIndexedMarketCap(415n, 50n, 1_000n)).toBe(8_300n);
    expect(
      computeIndexedMarketCap(
        12_345_678_901_234_567_890n,
        1_000_000_000_000_000_000n,
        1_000_000_000_000_000_000_000_000n,
      ),
    ).toBe(12_345_678_901_234_567_890_000_000n);
  });

  it('rejects invalid rational price inputs instead of falling back to floating point', () => {
    expect(() => computeIndexedMarketCap(1n, 0n, 1_000n)).toThrow(/denominator/i);
    expect(() => computeIndexedMarketCap(-1n, 1n, 1_000n)).toThrow(/non-negative/i);
  });
});
