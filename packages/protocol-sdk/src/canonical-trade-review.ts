import type { PublicClient } from 'viem';

import type { Address } from '../../types/src/index.js';
import type { ProtocolContext } from './context.js';
import {
  estimateBuyTradeReview,
  estimateSellTradeReview,
  readTradeReviewSnapshot,
  type BuyTradeReview,
  type SellTradeReview,
} from './trade-review.ts';
import {
  resolveCanonicalTradeRoute,
  type CanonicalTradeRoute,
} from './trade-route.ts';
import {
  readV3TradeReview,
  type V3TradeReview,
} from './v3-trading.ts';

export type CanonicalTradeAction = 'BUY' | 'SELL';
export type CanonicalTradeReview =
  | BuyTradeReview
  | SellTradeReview
  | V3TradeReview;

export type CanonicalTradeReviewResult = Readonly<{
  route: CanonicalTradeRoute;
  review: CanonicalTradeReview;
}>;

export type ReadCanonicalTradeReviewInput = Readonly<{
  token: Address;
  action: CanonicalTradeAction;
  inputAmount: bigint;
  slippageBps: number;
}>;

/**
 * Resolves fresh canonical chain state before reading transaction-critical
 * review values. This surface is intentionally review-only: it produces no
 * allowance, prepared transaction, account, signer or wallet state.
 */
export async function readCanonicalTradeReview(
  client: PublicClient,
  context: ProtocolContext,
  input: ReadCanonicalTradeReviewInput,
): Promise<CanonicalTradeReviewResult> {
  const route = await resolveCanonicalTradeRoute(
    client,
    context,
    input.token,
  );

  if (route.kind === 'V3_POOL') {
    const review = await readV3TradeReview(
      client,
      route,
      input.action,
      input.inputAmount,
      input.slippageBps,
    );

    return { route, review };
  }

  const snapshot = await readTradeReviewSnapshot(
    client,
    route.curve,
  );

  if (input.action === 'BUY') {
    return {
      route,
      review: estimateBuyTradeReview({
        quoteIn: input.inputAmount,
        slippageBps: input.slippageBps,
        snapshot,
      }),
    };
  }

  return {
    route,
    review: estimateSellTradeReview({
      tokensIn: input.inputAmount,
      slippageBps: input.slippageBps,
      snapshot,
    }),
  };
}
