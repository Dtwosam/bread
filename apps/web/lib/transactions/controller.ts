import {
  estimateBuyTradeReview,
  estimateSellTradeReview,
  prepareBuy,
  prepareSell,
  readTradeReviewSnapshot,
  simulatePreparedTransaction,
  type BuyTradeReview,
  type PreparedBreadTransaction,
  type ProtocolContext,
  type SellTradeReview,
} from '@bread/protocol-sdk';

type Address = `0x${string}`;
type TradePublicClient = Parameters<typeof readTradeReviewSnapshot>[0];

export type PreparedTradeForSignature = Readonly<{
  review: BuyTradeReview | SellTradeReview;
  transaction: PreparedBreadTransaction;
}>;

export async function prepareTradeForSignature({
  client,
  context,
  walletChainId,
  account,
  action,
  tokenAddress,
  curveAddress,
  inputAmount,
  slippageBps,
}: Readonly<{
  client: TradePublicClient;
  context: ProtocolContext;
  walletChainId: number;
  account: Address;
  action: 'BUY' | 'SELL';
  tokenAddress: Address;
  curveAddress: Address;
  inputAmount: bigint;
  slippageBps: number;
}>): Promise<PreparedTradeForSignature> {
  if (walletChainId !== context.chainId) {
    throw new Error(`Wrong network: wallet is on chain ${walletChainId}, expected ${context.chainId}.`);
  }

  const snapshot = await readTradeReviewSnapshot(client, curveAddress);

  if (action === 'BUY') {
    const review = estimateBuyTradeReview({ quoteIn: inputAmount, slippageBps, snapshot });
    const transaction = prepareBuy(context, {
      curve: curveAddress,
      quoteIn: inputAmount,
      minTokensOut: review.minimumOutput,
      recipient: account,
    });
    await simulatePreparedTransaction(client, transaction, account);
    return { review, transaction };
  }

  const review = estimateSellTradeReview({ tokensIn: inputAmount, slippageBps, snapshot });
  const transaction = prepareSell(context, {
    token: tokenAddress,
    curve: curveAddress,
    tokensIn: inputAmount,
    minQuoteOut: review.minimumOutput,
    recipient: account,
  });
  await simulatePreparedTransaction(client, transaction, account);
  return { review, transaction };
}
