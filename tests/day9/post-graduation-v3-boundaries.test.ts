import { describe, expect, it, vi } from 'vitest';

import type { Address } from '../../packages/types/src/index.js';
import type { CanonicalTradeRoute } from '../../packages/protocol-sdk/src/trade-route.js';
import {
  prepareV3ExactInputTrade,
  readV3TradeReview,
} from '../../packages/protocol-sdk/src/v3-trading.js';

const address = (byte: string) => `0x${byte.repeat(40)}` as Address;
const Q96 = 1n << 96n;
const MAX_UINT256 = (1n << 256n) - 1n;

const token = address('1');
const quoteAsset = address('2');
const pool = address('3');
const router = address('6');
const quoter = address('7');
const recipient = address('8');

const route: Extract<CanonicalTradeRoute, { kind: 'V3_POOL' }> = {
  kind: 'V3_POOL',
  token,
  quoteAsset,
  pool,
  fee: 3000,
  factory: address('4'),
  positionManager: address('5'),
  swapRouter: router,
  swapRouterKind: 'V3_SWAP_ROUTER_02',
  quoter,
  quoterKind: 'V3_QUOTER_V2',
};

function quoteClient({
  expectedOutput,
  sqrtPriceX96 = Q96,
}: Readonly<{
  expectedOutput: bigint;
  sqrtPriceX96?: bigint;
}>) {
  const readContract = vi.fn(async (request: { address: Address; functionName: string }) => {
    if (request.address === pool && request.functionName === 'slot0') {
      return [sqrtPriceX96, 0, 0, 1, 1, 0, true];
    }
    if (request.address === quoter && request.functionName === 'quoteExactInputSingle') {
      return [expectedOutput, sqrtPriceX96, 0, 123_456n];
    }
    throw new Error(`unexpected read ${request.address} ${request.functionName}`);
  });
  return { readContract };
}

describe('Day 9 graduated V3 adversarial amount and pricing boundaries', () => {
  it('preserves a one-unit exact-input quote with zero slippage instead of rounding it away', async () => {
    const review = await readV3TradeReview(
      quoteClient({ expectedOutput: 1n }) as never,
      route,
      'BUY',
      1n,
      0,
    );

    expect(review).toMatchObject({
      inputAmount: 1n,
      expectedOutput: 1n,
      minimumOutput: 1n,
      priceImpactBps: 0,
      slippageBps: 0,
    });
  });

  it('floors slippage deterministically at a 6-decimal-USDC rounding boundary', async () => {
    const review = await readV3TradeReview(
      quoteClient({ expectedOutput: 999_999n }) as never,
      route,
      'BUY',
      1_000_001n,
      25,
    );

    expect(review.expectedOutput).toBe(999_999n);
    expect(review.minimumOutput).toBe(997_499n);
  });

  it('preserves the maximum valid uint256 exact input without bigint overflow', async () => {
    const expectedOutput = MAX_UINT256 - 123n;
    const review = await readV3TradeReview(
      quoteClient({ expectedOutput }) as never,
      route,
      'BUY',
      MAX_UINT256,
      1,
    );

    expect(review.inputAmount).toBe(MAX_UINT256);
    expect(review.expectedOutput).toBe(expectedOutput);
    expect(review.minimumOutput).toBe((expectedOutput * 9_999n) / 10_000n);

    const prepared = prepareV3ExactInputTrade(route, {
      action: 'BUY',
      inputAmount: MAX_UINT256,
      minimumOutput: review.minimumOutput,
      recipient,
    });
    expect(prepared.allowance).toEqual({
      token: quoteAsset,
      spender: router,
      amount: MAX_UINT256,
    });
    expect(prepared.args).toEqual([expect.objectContaining({ amountIn: MAX_UINT256 })]);
  });

  it('uses V3 token ordering correctly when the current pool price is not 1:1', async () => {
    const sqrtPriceX96 = 2n * Q96;

    const buy = await readV3TradeReview(
      quoteClient({ expectedOutput: 200n, sqrtPriceX96 }) as never,
      route,
      'BUY',
      1_000n,
      0,
    );
    const sell = await readV3TradeReview(
      quoteClient({ expectedOutput: 3_200n, sqrtPriceX96 }) as never,
      route,
      'SELL',
      1_000n,
      0,
    );

    expect(buy.priceImpactBps).toBe(2_000);
    expect(sell.priceImpactBps).toBe(2_000);
  });

  it('represents a near-total execution-price impact without overflow or sign inversion', async () => {
    const review = await readV3TradeReview(
      quoteClient({ expectedOutput: 1n }) as never,
      route,
      'BUY',
      1_000n,
      0,
    );

    expect(review.priceImpactBps).toBe(9_990);
  });

  it('fails closed when the authoritative quote or pool sqrt price is non-positive', async () => {
    await expect(readV3TradeReview(
      quoteClient({ expectedOutput: 0n }) as never,
      route,
      'BUY',
      1n,
      0,
    )).rejects.toThrow(/quote returned no output/i);

    await expect(readV3TradeReview(
      quoteClient({ expectedOutput: 1n, sqrtPriceX96: 0n }) as never,
      route,
      'BUY',
      1n,
      0,
    )).rejects.toThrow(/pool sqrt price/i);
  });

  it('fails closed for a negative minimum output and a non-positive classic-router deadline', () => {
    expect(() => prepareV3ExactInputTrade(route, {
      action: 'BUY',
      inputAmount: 1n,
      minimumOutput: -1n,
      recipient,
    })).toThrow(/minimum output/i);

    expect(() => prepareV3ExactInputTrade(
      { ...route, swapRouterKind: 'V3_SWAP_ROUTER' },
      {
        action: 'BUY',
        inputAmount: 1n,
        minimumOutput: 0n,
        recipient,
        deadline: 0n,
      },
    )).toThrow(/deadline must be positive/i);
  });
});
