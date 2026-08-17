import { describe, expect, it } from 'vitest';

import { readArcBuyMaxBalance } from '../../apps/web/lib/transactions/wallet-adapter.js';

const address = (byte: string) => `0x${byte.repeat(40)}` as `0x${string}`;

describe('Day 9 Buy MAX Arc gas reserve', () => {
  it('keeps the canonical ERC-20 balance visible while reserving a current Arc gas upper bound for MAX', async () => {
    const publicClient = {
      async readContract(request: { functionName: string }) {
        expect(request.functionName).toBe('balanceOf');
        return 25_000_000n;
      },
      async getBlock() {
        return { gasLimit: 30_000_000n };
      },
      async estimateFeesPerGas() {
        return {
          maxFeePerGas: 1_000_000_001n,
          maxPriorityFeePerGas: 1n,
        };
      },
    } as never;

    await expect(
      readArcBuyMaxBalance({
        publicClient,
        account: address('b'),
        quoteAsset: address('2'),
        quoteDecimals: 6,
      }),
    ).resolves.toEqual({
      balance: 25_000_000n,
      gasReserve: 60_001n,
      maxInput: 24_939_999n,
    });
  });

  it('fails closed to a zero MAX instead of draining the shared balance when the current reserve covers it', async () => {
    const publicClient = {
      async readContract() {
        return 50_000n;
      },
      async getBlock() {
        return { gasLimit: 30_000_000n };
      },
      async estimateFeesPerGas() {
        return { gasPrice: 1_000_000_000n };
      },
    } as never;

    await expect(
      readArcBuyMaxBalance({
        publicClient,
        account: address('b'),
        quoteAsset: address('2'),
        quoteDecimals: 6,
      }),
    ).resolves.toEqual({
      balance: 50_000n,
      gasReserve: 60_000n,
      maxInput: 0n,
    });
  });
});
