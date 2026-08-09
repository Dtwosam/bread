import type { Address, Hex32 } from '../../../packages/types/src/index.js';
import type { ProtocolContext } from '../../../packages/protocol-sdk/src/index.js';

import type { RpcLog } from './discovery.js';

export type NormalizedTrade = Readonly<{
  id: Readonly<{ chainId: number; transactionHash: Hex32; logIndex: number }>;
  side: 'BUY' | 'SELL';
  token: Address;
  curve: Address;
  actor: Address;
  recipient: Address;
  offeredQuote: bigint;
  quoteAmount: bigint;
  tokenAmount: bigint;
  baseFee: bigint;
  creatorTax: bigint;
  openingTaxBps: bigint;
  openingTax: bigint;
  launchBuyExempt: boolean;
  refund: bigint;
  netCurveInput: bigint;
  netQuoteOut: bigint;
  grossCurveQuoteOut: bigint;
  executionPriceNumerator: bigint;
  executionPriceDenominator: bigint;
  blockNumber: bigint;
  blockHash: Hex32;
  blockTimestamp: bigint;
  transactionIndex: number;
}>;

export type KnownTradeLaunch = Readonly<{
  tokenAddress: string;
  curveAddress: string;
}>;

function address(value: unknown, label: string): Address {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${label} is not an address`);
  }
  return value.toLowerCase() as Address;
}

function uint(value: unknown, label: string): bigint {
  if (typeof value === 'bigint' && value >= 0n) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  throw new Error(`${label} is not an exact unsigned integer`);
}

function transactionHash(log: RpcLog): Hex32 {
  if (!/^0x[0-9a-fA-F]{64}$/.test(log.transactionHash)) throw new Error('trade transactionHash is not bytes32');
  return log.transactionHash.toLowerCase() as Hex32;
}

function blockHash(log: RpcLog): Hex32 {
  if (!/^0x[0-9a-fA-F]{64}$/.test(log.blockHash)) throw new Error('trade blockHash is not bytes32');
  return log.blockHash.toLowerCase() as Hex32;
}

function sortLogs(logs: readonly RpcLog[]): RpcLog[] {
  return [...logs].sort((left, right) => {
    if (left.blockNumber !== right.blockNumber) return left.blockNumber < right.blockNumber ? -1 : 1;
    if (left.transactionIndex !== right.transactionIndex) return left.transactionIndex - right.transactionIndex;
    return left.logIndex - right.logIndex;
  });
}

type PendingRefund = Readonly<{ buyer: Address; refund: bigint; logIndex: number }>;
type PendingOpening = Readonly<{
  buyer: Address;
  recipient: Address;
  taxBps: bigint;
  taxAmount: bigint;
  launchBuyExempt: boolean;
  logIndex: number;
}>;

type TransactionState = {
  refunds: PendingRefund[];
  openings: PendingOpening[];
};

function txCurveKey(log: RpcLog): string {
  return `${log.transactionHash.toLowerCase()}:${log.address.toLowerCase()}`;
}

function exactlyOne<T>(items: readonly T[], label: string): T {
  if (items.length === 0) throw new Error(`missing ${label}`);
  if (items.length > 1) throw new Error(`ambiguous ${label}`);
  return items[0]!;
}

function curveTokenMap(knownLaunches: readonly KnownTradeLaunch[]): Map<string, Address> {
  const result = new Map<string, Address>();
  for (const launch of knownLaunches) {
    const token = address(launch.tokenAddress, 'known launch token');
    const curve = address(launch.curveAddress, 'known launch curve');
    const previous = result.get(curve);
    if (previous && previous !== token) throw new Error(`curve ${curve} maps to multiple launch tokens`);
    result.set(curve, token);
  }
  return result;
}

export function correlateCanonicalTrades(input: Readonly<{
  context: ProtocolContext;
  knownLaunches: readonly KnownTradeLaunch[];
  logs: readonly RpcLog[];
  blockTimestamps: ReadonlyMap<bigint, bigint>;
}>): readonly NormalizedTrade[] {
  const tokenByCurve = curveTokenMap(input.knownLaunches);
  const stateByTxCurve = new Map<string, TransactionState>();
  const trades: NormalizedTrade[] = [];

  for (const log of sortLogs(input.logs)) {
    const curve = log.address.toLowerCase() as Address;
    const token = tokenByCurve.get(curve);
    if (!token) continue;
    const eventName = log.eventName;
    const args = log.args ?? {};
    const key = txCurveKey(log);
    const state = stateByTxCurve.get(key) ?? { refunds: [], openings: [] };
    stateByTxCurve.set(key, state);

    if (eventName === 'CurveBuyRefunded') {
      state.refunds.push({
        buyer: address(args.buyer, 'CurveBuyRefunded.buyer'),
        refund: uint(args.refund, 'CurveBuyRefunded.refund'),
        logIndex: log.logIndex,
      });
      continue;
    }

    if (eventName === 'OpeningProtectionApplied') {
      state.openings.push({
        buyer: address(args.buyer, 'OpeningProtectionApplied.buyer'),
        recipient: address(args.recipient, 'OpeningProtectionApplied.recipient'),
        taxBps: uint(args.taxBps, 'OpeningProtectionApplied.taxBps'),
        taxAmount: uint(args.taxAmount, 'OpeningProtectionApplied.taxAmount'),
        launchBuyExempt: Boolean(args.launchBuyExempt),
        logIndex: log.logIndex,
      });
      continue;
    }

    const timestamp = input.blockTimestamps.get(log.blockNumber);
    if (timestamp === undefined) throw new Error(`missing exact block timestamp for ${log.blockNumber}`);

    if (eventName === 'CurveBuy') {
      const actor = address(args.buyer, 'CurveBuy.buyer');
      const recipient = address(args.recipient, 'CurveBuy.recipient');
      const openingMatches = state.openings.filter(
        (candidate) => candidate.buyer === actor && candidate.recipient === recipient && candidate.logIndex < log.logIndex,
      );
      const opening = exactlyOne(openingMatches, 'OpeningProtectionApplied context');
      state.openings = state.openings.filter((candidate) => candidate !== opening);

      const refundMatches = state.refunds.filter(
        (candidate) => candidate.buyer === actor && candidate.logIndex < log.logIndex,
      );
      if (refundMatches.length > 1) throw new Error('ambiguous CurveBuyRefunded context');
      const refund = refundMatches[0];
      if (refund) state.refunds = state.refunds.filter((candidate) => candidate !== refund);

      const spent = uint(args.quoteIn, 'CurveBuy.quoteIn');
      const tokenAmount = uint(args.tokensOut, 'CurveBuy.tokensOut');
      const baseFee = uint(args.fee, 'CurveBuy.fee');
      const creatorTax = uint(args.tax, 'CurveBuy.tax');
      const netCurveInput = spent - baseFee - creatorTax - opening.taxAmount;
      if (netCurveInput < 0n) throw new Error('CurveBuy charges exceed spent quote');
      if (tokenAmount === 0n) throw new Error('CurveBuy token amount must be positive');

      trades.push({
        id: { chainId: input.context.chainId, transactionHash: transactionHash(log), logIndex: log.logIndex },
        side: 'BUY',
        token,
        curve,
        actor,
        recipient,
        offeredQuote: spent + (refund?.refund ?? 0n),
        quoteAmount: spent,
        tokenAmount,
        baseFee,
        creatorTax,
        openingTaxBps: opening.taxBps,
        openingTax: opening.taxAmount,
        launchBuyExempt: opening.launchBuyExempt,
        refund: refund?.refund ?? 0n,
        netCurveInput,
        netQuoteOut: 0n,
        grossCurveQuoteOut: 0n,
        executionPriceNumerator: netCurveInput,
        executionPriceDenominator: tokenAmount,
        blockNumber: log.blockNumber,
        blockHash: blockHash(log),
        blockTimestamp: timestamp,
        transactionIndex: log.transactionIndex,
      });
      continue;
    }

    if (eventName === 'CurveSell') {
      const actor = address(args.seller, 'CurveSell.seller');
      const recipient = address(args.recipient, 'CurveSell.recipient');
      const tokenAmount = uint(args.tokensIn, 'CurveSell.tokensIn');
      const netQuoteOut = uint(args.quoteOut, 'CurveSell.quoteOut');
      const baseFee = uint(args.fee, 'CurveSell.fee');
      const creatorTax = uint(args.tax, 'CurveSell.tax');
      const gross = netQuoteOut + baseFee + creatorTax;
      if (tokenAmount === 0n) throw new Error('CurveSell token amount must be positive');

      trades.push({
        id: { chainId: input.context.chainId, transactionHash: transactionHash(log), logIndex: log.logIndex },
        side: 'SELL',
        token,
        curve,
        actor,
        recipient,
        offeredQuote: 0n,
        quoteAmount: gross,
        tokenAmount,
        baseFee,
        creatorTax,
        openingTaxBps: 0n,
        openingTax: 0n,
        launchBuyExempt: false,
        refund: 0n,
        netCurveInput: 0n,
        netQuoteOut,
        grossCurveQuoteOut: gross,
        executionPriceNumerator: gross,
        executionPriceDenominator: tokenAmount,
        blockNumber: log.blockNumber,
        blockHash: blockHash(log),
        blockTimestamp: timestamp,
        transactionIndex: log.transactionIndex,
      });
    }
  }

  for (const [key, state] of stateByTxCurve) {
    if (state.openings.length > 0) throw new Error(`unconsumed OpeningProtectionApplied context in ${key}`);
    if (state.refunds.length > 0) throw new Error(`unconsumed CurveBuyRefunded context in ${key}`);
  }

  return trades;
}
