import { describe, expect, it } from 'vitest';

import {
  estimateBuyTradeReview,
  estimateSellTradeReview,
} from '../../packages/protocol-sdk/src/trade-review.js';

const baseSnapshot = {
  quoteReserve: 1_000_000n,
  tokenReserve: 2_000_000n,
  reservedTokens: 0n,
  tradeFeeBps: 100,
  creatorTaxBps: 50,
  openingTaxBps: 0,
} as const;

describe('Day 7 Task 5 canonical SDK trade review', () => {
  it('estimates an ordinary buy with exact accepted fee order and slippage minimum', () => {
    const review = estimateBuyTradeReview({
      quoteIn: 10_000n,
      slippageBps: 50,
      snapshot: baseSnapshot,
    });

    expect(review).toEqual({
      action: 'BUY',
      inputAmount: 10_000n,
      spentAmount: 10_000n,
      refundAmount: 0n,
      expectedOutput: 19_507n,
      minimumOutput: 19_409n,
      baseFee: 100n,
      creatorTax: 50n,
      openingTaxBps: 0,
      openingTax: 0n,
      netCurveInput: 9_850n,
      priceImpactBps: 97,
      slippageBps: 50,
    });
  });

  it('estimates opening protection after base fee and creator tax rather than before them', () => {
    const review = estimateBuyTradeReview({
      quoteIn: 10_000n,
      slippageBps: 100,
      snapshot: { ...baseSnapshot, openingTaxBps: 9_900 },
    });

    expect(review.baseFee).toBe(100n);
    expect(review.creatorTax).toBe(50n);
    expect(review.openingTax).toBe(9_751n);
    expect(review.netCurveInput).toBe(99n);
    expect(review.openingTaxBps).toBe(9_900);
  });

  it('mirrors the final-buy clamp with actual spent quote and refund', () => {
    const review = estimateBuyTradeReview({
      quoteIn: 10_000n,
      slippageBps: 50,
      snapshot: { ...baseSnapshot, reservedTokens: 1_990_000n },
    });

    expect(review.expectedOutput).toBe(10_000n);
    expect(review.spentAmount).toBe(5_103n);
    expect(review.refundAmount).toBe(4_897n);
    expect(review.baseFee).toBe(51n);
    expect(review.creatorTax).toBe(25n);
    expect(review.netCurveInput).toBe(5_027n);
  });

  it('estimates sell fees from gross quote output and returns the slippage minimum', () => {
    const review = estimateSellTradeReview({
      tokensIn: 10_000n,
      slippageBps: 50,
      snapshot: baseSnapshot,
    });

    expect(review).toEqual({
      action: 'SELL',
      inputAmount: 10_000n,
      grossOutput: 4_975n,
      expectedOutput: 4_902n,
      minimumOutput: 4_877n,
      baseFee: 49n,
      creatorTax: 24n,
      openingTaxBps: 0,
      openingTax: 0n,
      priceImpactBps: 50,
      slippageBps: 50,
    });
  });

  it('fails closed on invalid slippage, fee bounds, zero amounts or unseeded liquidity', () => {
    expect(() =>
      estimateBuyTradeReview({ quoteIn: 0n, slippageBps: 50, snapshot: baseSnapshot }),
    ).toThrow(/positive input/i);
    expect(() =>
      estimateSellTradeReview({ tokensIn: 1n, slippageBps: 10_000, snapshot: baseSnapshot }),
    ).toThrow(/slippage/i);
    expect(() =>
      estimateBuyTradeReview({
        quoteIn: 1n,
        slippageBps: 50,
        snapshot: { ...baseSnapshot, tradeFeeBps: 9_900, creatorTaxBps: 100 },
      }),
    ).toThrow(/fee/i);
    expect(() =>
      estimateBuyTradeReview({
        quoteIn: 1n,
        slippageBps: 50,
        snapshot: { ...baseSnapshot, quoteReserve: 0n },
      }),
    ).toThrow(/liquidity/i);
  });
});
