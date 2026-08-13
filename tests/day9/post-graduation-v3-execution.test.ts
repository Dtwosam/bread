import { describe, expect, it, vi } from 'vitest';

import type { Address } from '../../packages/types/src/index.js';
import type { CanonicalTradeRoute } from '../../packages/protocol-sdk/src/trade-route.js';

const address = (byte: string) => `0x${byte.repeat(40)}` as Address;
const Q96 = 1n << 96n;

const token = address('1');
const quoteAsset = address('2');
const pool = address('3');
const factory = address('4');
const positionManager = address('5');
const router = address('6');
const quoter = address('7');
const recipient = address('8');

const route: Extract<CanonicalTradeRoute, { kind: 'V3_POOL' }> = {
  kind: 'V3_POOL',
  token,
  quoteAsset,
  pool,
  fee: 3000,
  factory,
  positionManager,
  swapRouter: router,
  swapRouterKind: 'V3_SWAP_ROUTER_02',
  quoter,
  quoterKind: 'V3_QUOTER_V2',
};

function quoteClient(expectedOutput = 900n) {
  const readContract = vi.fn(async (request: { address: Address; functionName: string; args?: readonly unknown[] }) => {
    if (request.address === pool && request.functionName === 'slot0') {
      return [Q96, 0, 0, 1, 1, 0, true];
    }
    if (request.address === quoter && request.functionName === 'quoteExactInputSingle') {
      return [expectedOutput, Q96, 0, 123_456n];
    }
    throw new Error(`unexpected read ${request.address} ${request.functionName}`);
  });
  return { readContract };
}

describe('Day 9 graduated V3 exact-input review and builder', () => {
  it('reads a BUY quote from verified QuoterV2 and derives slippage plus raw-unit price impact from current slot0', async () => {
    const sdk = await import('../../packages/protocol-sdk/src/index.ts');
    expect(sdk).toHaveProperty('readV3TradeReview');
    const readV3TradeReview = (sdk as Record<string, unknown>).readV3TradeReview as
      | ((client: { readContract: (request: never) => Promise<unknown> }, route: typeof route, action: 'BUY' | 'SELL', inputAmount: bigint, slippageBps: number) => Promise<Record<string, unknown>>)
      | undefined;

    const client = quoteClient();
    const review = await readV3TradeReview?.(client as never, route, 'BUY', 1_000n, 100);

    expect(client.readContract).toHaveBeenCalledWith(expect.objectContaining({
      address: quoter,
      functionName: 'quoteExactInputSingle',
      args: [{
        tokenIn: quoteAsset,
        tokenOut: token,
        amountIn: 1_000n,
        fee: 3000,
        sqrtPriceLimitX96: 0n,
      }],
    }));
    expect(client.readContract).toHaveBeenCalledWith(expect.objectContaining({
      address: pool,
      functionName: 'slot0',
    }));
    expect(review).toEqual({
      action: 'BUY',
      route: 'V3_POOL',
      inputAmount: 1_000n,
      expectedOutput: 900n,
      minimumOutput: 891n,
      venueFee: 3000,
      baseFee: 0n,
      creatorTax: 0n,
      openingTaxBps: 0,
      openingTax: 0n,
      priceImpactBps: 1000,
      slippageBps: 100,
    });
  });

  it('quotes SELL in the opposite TOKEN -> USDC direction without inventing Bread curve charges', async () => {
    const sdk = await import('../../packages/protocol-sdk/src/index.ts');
    const readV3TradeReview = (sdk as Record<string, unknown>).readV3TradeReview as
      | ((client: { readContract: (request: never) => Promise<unknown> }, route: typeof route, action: 'BUY' | 'SELL', inputAmount: bigint, slippageBps: number) => Promise<Record<string, unknown>>)
      | undefined;

    const client = quoteClient(800n);
    const review = await readV3TradeReview?.(client as never, route, 'SELL', 1_000n, 250);

    expect(client.readContract).toHaveBeenCalledWith(expect.objectContaining({
      address: quoter,
      functionName: 'quoteExactInputSingle',
      args: [{
        tokenIn: token,
        tokenOut: quoteAsset,
        amountIn: 1_000n,
        fee: 3000,
        sqrtPriceLimitX96: 0n,
      }],
    }));
    expect(review).toMatchObject({
      action: 'SELL',
      route: 'V3_POOL',
      inputAmount: 1_000n,
      expectedOutput: 800n,
      minimumOutput: 780n,
      venueFee: 3000,
      baseFee: 0n,
      creatorTax: 0n,
      openingTaxBps: 0,
      openingTax: 0n,
      priceImpactBps: 2000,
      slippageBps: 250,
    });
  });

  it('prepares Router02 BUY with exact USDC allowance, zero value and no classic-router deadline field', async () => {
    const sdk = await import('../../packages/protocol-sdk/src/index.ts');
    expect(sdk).toHaveProperty('prepareV3ExactInputTrade');
    const prepareV3ExactInputTrade = (sdk as Record<string, unknown>).prepareV3ExactInputTrade as
      | ((route: typeof route, input: Record<string, unknown>) => Record<string, unknown>)
      | undefined;

    const prepared = prepareV3ExactInputTrade?.(route, {
      action: 'BUY',
      inputAmount: 1_000n,
      minimumOutput: 891n,
      recipient,
    });

    expect(prepared).toMatchObject({
      to: router,
      functionName: 'exactInputSingle',
      value: 0n,
      allowance: { token: quoteAsset, spender: router, amount: 1_000n },
    });
    expect(prepared?.args).toEqual([{
      tokenIn: quoteAsset,
      tokenOut: token,
      fee: 3000,
      recipient,
      amountIn: 1_000n,
      amountOutMinimum: 891n,
      sqrtPriceLimitX96: 0n,
    }]);
  });

  it('prepares Router02 SELL with exact token allowance', async () => {
    const sdk = await import('../../packages/protocol-sdk/src/index.ts');
    const prepareV3ExactInputTrade = (sdk as Record<string, unknown>).prepareV3ExactInputTrade as
      | ((route: typeof route, input: Record<string, unknown>) => Record<string, unknown>)
      | undefined;

    const prepared = prepareV3ExactInputTrade?.(route, {
      action: 'SELL',
      inputAmount: 500n,
      minimumOutput: 400n,
      recipient,
    });

    expect(prepared?.allowance).toEqual({ token, spender: router, amount: 500n });
    expect(prepared?.args).toEqual([{
      tokenIn: token,
      tokenOut: quoteAsset,
      fee: 3000,
      recipient,
      amountIn: 500n,
      amountOutMinimum: 400n,
      sqrtPriceLimitX96: 0n,
    }]);
  });

  it('represents classic V3 SwapRouter explicitly and requires a caller-supplied deadline', async () => {
    const sdk = await import('../../packages/protocol-sdk/src/index.ts');
    const prepareV3ExactInputTrade = (sdk as Record<string, unknown>).prepareV3ExactInputTrade as
      | ((route: typeof route, input: Record<string, unknown>) => Record<string, unknown>)
      | undefined;
    const classic = { ...route, swapRouterKind: 'V3_SWAP_ROUTER' as const };

    expect(() => prepareV3ExactInputTrade?.(classic, {
      action: 'BUY',
      inputAmount: 1_000n,
      minimumOutput: 900n,
      recipient,
    })).toThrow('deadline is required for V3_SWAP_ROUTER');

    const prepared = prepareV3ExactInputTrade?.(classic, {
      action: 'BUY',
      inputAmount: 1_000n,
      minimumOutput: 900n,
      recipient,
      deadline: 1_900_000_000n,
    });
    expect(prepared?.args).toEqual([{
      tokenIn: quoteAsset,
      tokenOut: token,
      fee: 3000,
      recipient,
      deadline: 1_900_000_000n,
      amountIn: 1_000n,
      amountOutMinimum: 900n,
      sqrtPriceLimitX96: 0n,
    }]);
  });

  it('fails closed for non-positive input, invalid slippage and unsupported ABI-kind mismatches', async () => {
    const sdk = await import('../../packages/protocol-sdk/src/index.ts');
    const readV3TradeReview = (sdk as Record<string, unknown>).readV3TradeReview as
      | ((client: { readContract: (request: never) => Promise<unknown> }, route: typeof route, action: 'BUY' | 'SELL', inputAmount: bigint, slippageBps: number) => Promise<Record<string, unknown>>)
      | undefined;
    const prepareV3ExactInputTrade = (sdk as Record<string, unknown>).prepareV3ExactInputTrade as
      | ((route: typeof route, input: Record<string, unknown>) => Record<string, unknown>)
      | undefined;

    await expect(readV3TradeReview?.(quoteClient() as never, route, 'BUY', 0n, 100)).rejects.toThrow('positive input');
    await expect(readV3TradeReview?.(quoteClient() as never, route, 'BUY', 1n, 10_000)).rejects.toThrow('Slippage');
    expect(() => prepareV3ExactInputTrade?.(
      { ...route, swapRouterKind: 'UNKNOWN' } as never,
      { action: 'BUY', inputAmount: 1n, minimumOutput: 0n, recipient },
    )).toThrow('unsupported V3 swap router kind');
  });
});
