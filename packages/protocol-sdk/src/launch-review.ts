import type { PublicClient } from 'viem';

import type { Address, Hex32 } from '../../types/src/index.js';
import {
  prepareLaunch,
  prepareLaunchAndBuy,
  type LaunchParams,
  type PreparedBreadTransaction,
} from './builders.ts';
import type { ProtocolContext } from './context.js';
import { breadAbiRegistry } from './abi/generated.ts';
import {
  estimateBuyTradeReview,
  type BuyTradeReview,
} from './trade-review.ts';

const ZERO = BigInt(0);
const BPS = 10_000;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HEX32 = /^0x[0-9a-fA-F]{64}$/;

export type LaunchReviewSnapshot = Readonly<{
  supply: bigint;
  phantomQuote: bigint;
  graduationThreshold: bigint;
  launchFeeUsdc: bigint;
  graduationAdapter: Address;
  graduationConfigHash: Hex32;
  enabled: true;
  configVersion: bigint;
  economicsDigest: Hex32;
  protocolFeeRecipient: Address;
  tradeFeeBps: number;
  protocolFeeShareBps: number;
  maxCreatorTaxBps: number;
}>;

export type CanonicalLaunchCreatorInput = Readonly<{
  name: string;
  symbol: string;
  logo: string;
  description: string;
  twitter: string;
  telegram: string;
  website: string;
  creatorFeeRecipient: Address;
  creatorTaxBps: bigint;
}>;

export type CanonicalLaunchReview = Readonly<{
  fixedSupply: bigint;
  quoteAsset: Address;
  quoteDecimals: 6;
  creatorTaxBps: number;
  buybackAvailable: false;
  initialBuyQuoteIn: bigint;
  launchFeeUsdc: bigint;
  graduationThreshold: bigint;
  creatorRevenueWallet: Address;
  permanentLiquidityLock: true;
  economicsDigest: Hex32;
  configVersion: bigint;
}>;

export type PreparedCanonicalLaunchReview = Readonly<{
  params: LaunchParams;
  transaction: PreparedBreadTransaction;
  review: CanonicalLaunchReview;
  initialBuyReview: BuyTradeReview | null;
}>;

function field(value: unknown, name: string, index: number): unknown {
  if (Array.isArray(value)) return value[index];
  if (typeof value === 'object' && value !== null && name in value) {
    return (value as Record<string, unknown>)[name];
  }
  return undefined;
}

function canonicalBigInt(label: string, value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  throw new Error(`Invalid canonical ${label}.`);
}

function nonNegative(label: string, value: unknown): bigint {
  const amount = canonicalBigInt(label, value);
  if (amount < ZERO) throw new Error(`Invalid canonical ${label}.`);
  return amount;
}

function positive(label: string, value: unknown): bigint {
  const amount = canonicalBigInt(label, value);
  if (amount <= ZERO) throw new Error(`Invalid canonical ${label}.`);
  return amount;
}

function canonicalBps(label: string, value: unknown): number {
  const number = Number(canonicalBigInt(label, value));
  if (!Number.isInteger(number) || number < 0 || number >= BPS) {
    throw new Error(`Invalid canonical ${label}.`);
  }
  return number;
}

function canonicalAddress(label: string, value: unknown): Address {
  if (typeof value !== 'string' || !ADDRESS.test(value)) {
    throw new Error(`Invalid canonical ${label}.`);
  }
  return value as Address;
}

function canonicalHex32(label: string, value: unknown): Hex32 {
  if (typeof value !== 'string' || !HEX32.test(value)) {
    throw new Error(`Invalid canonical ${label}.`);
  }
  return value as Hex32;
}

function launchConfigParts(raw: unknown) {
  const config = Array.isArray(raw) ? raw[0] : field(raw, 'config', 0);
  const version = Array.isArray(raw) ? raw[1] : field(raw, 'version', 1);
  if (!config || typeof config !== 'object') throw new Error('Invalid canonical launch config.');
  return { config, version } as const;
}

/**
 * Reads current launch-critical Factory/FeePolicy state directly from chain.
 * Indexed/API data remains useful for browse UX but never authorizes a launch.
 */
export async function readLaunchReviewSnapshot(
  client: PublicClient,
  context: ProtocolContext,
): Promise<LaunchReviewSnapshot> {
  const rawConfig = await client.readContract({
    address: context.addresses.factory,
    abi: breadAbiRegistry.factory,
    functionName: 'currentLaunchConfig',
  } as never);
  const rawDigest = await client.readContract({
    address: context.addresses.factory,
    abi: breadAbiRegistry.factory,
    functionName: 'previewLaunchEconomics',
  } as never);
  const rawPolicy = await client.readContract({
    address: context.addresses.feePolicy,
    abi: breadAbiRegistry.feePolicy,
    functionName: 'currentFeePolicy',
  } as never);

  const { config, version } = launchConfigParts(rawConfig);
  const enabled = field(config, 'enabled', 6);
  if (enabled !== true) throw new Error('Canonical Factory launch configuration is disabled.');

  return {
    supply: positive('launch supply', field(config, 'supply', 0)),
    phantomQuote: positive('phantom quote', field(config, 'phantomQuote', 1)),
    graduationThreshold: positive('graduation threshold', field(config, 'graduationThreshold', 2)),
    launchFeeUsdc: nonNegative('launch fee', field(config, 'launchFeeUsdc', 3)),
    graduationAdapter: canonicalAddress('graduation adapter', field(config, 'graduationAdapter', 4)),
    graduationConfigHash: canonicalHex32('graduation config hash', field(config, 'graduationConfigHash', 5)),
    enabled: true,
    configVersion: nonNegative('config version', version),
    economicsDigest: canonicalHex32('launch economics digest', rawDigest),
    protocolFeeRecipient: canonicalAddress('protocol fee recipient', field(rawPolicy, 'protocolFeeRecipient', 0)),
    tradeFeeBps: canonicalBps('trade fee', field(rawPolicy, 'tradeFeeBps', 1)),
    protocolFeeShareBps: canonicalBps('protocol fee share', field(rawPolicy, 'protocolFeeShareBps', 2)),
    maxCreatorTaxBps: canonicalBps('maximum creator tax', field(rawPolicy, 'maxCreatorTaxBps', 3)),
  };
}

function creatorTaxBps(value: bigint, maximum: number): number {
  if (value < ZERO || value >= BigInt(BPS)) {
    throw new Error('Creator tax must be between 0 and 9999 bps.');
  }
  const numeric = Number(value);
  if (numeric > maximum) {
    throw new Error(`Creator tax exceeds the canonical current maximum of ${maximum} bps.`);
  }
  return numeric;
}

function reservedAtLaunch(snapshot: LaunchReviewSnapshot): bigint {
  const denominator = snapshot.phantomQuote + snapshot.graduationThreshold;
  const reserved = (snapshot.supply * snapshot.phantomQuote) / denominator;
  if (reserved <= ZERO || reserved >= snapshot.supply) {
    throw new Error('Canonical launch configuration produces invalid reserved token allocation.');
  }
  return reserved;
}

/**
 * Builds a deterministic, non-authoritative launch review from a canonical
 * chain snapshot. Launch+Buy output estimation intentionally reuses the same
 * SDK trade-review math as ordinary Buy; final contract simulation remains the
 * authority immediately before signature.
 */
export function prepareCanonicalLaunchReview({
  context,
  snapshot,
  creator,
  initialBuyQuoteIn,
  slippageBps,
}: Readonly<{
  context: ProtocolContext;
  snapshot: LaunchReviewSnapshot;
  creator: CanonicalLaunchCreatorInput;
  initialBuyQuoteIn: bigint;
  slippageBps: number;
}>): PreparedCanonicalLaunchReview {
  if (!snapshot.enabled) throw new Error('Canonical Factory launch configuration is disabled.');
  if (initialBuyQuoteIn < ZERO) throw new Error('Initial buy must not be negative.');
  const creatorTax = creatorTaxBps(creator.creatorTaxBps, snapshot.maxCreatorTaxBps);

  const params: LaunchParams = {
    name: creator.name,
    symbol: creator.symbol,
    logo: creator.logo,
    description: creator.description,
    twitter: creator.twitter,
    telegram: creator.telegram,
    discord: '',
    website: creator.website,
    farcaster: '',
    creatorFeeRecipient: creator.creatorFeeRecipient,
    creatorTaxBps: BigInt(creatorTax),
    expectedEconomics: snapshot.economicsDigest,
  };

  let transaction: PreparedBreadTransaction;
  let initialBuyReview: BuyTradeReview | null = null;

  if (initialBuyQuoteIn === ZERO) {
    transaction = prepareLaunch(context, params, snapshot.launchFeeUsdc);
  } else {
    initialBuyReview = estimateBuyTradeReview({
      quoteIn: initialBuyQuoteIn,
      slippageBps,
      snapshot: {
        quoteReserve: snapshot.phantomQuote,
        tokenReserve: snapshot.supply,
        reservedTokens: reservedAtLaunch(snapshot),
        tradeFeeBps: snapshot.tradeFeeBps,
        creatorTaxBps: creatorTax,
        openingTaxBps: 0,
      },
    });
    transaction = prepareLaunchAndBuy(context, {
      params,
      quoteIn: initialBuyQuoteIn,
      minTokensOut: initialBuyReview.minimumOutput,
      recipient: creator.creatorFeeRecipient,
      launchFeeUsdc: snapshot.launchFeeUsdc,
    });
  }

  return {
    params,
    transaction,
    initialBuyReview,
    review: {
      fixedSupply: snapshot.supply,
      quoteAsset: context.quoteAsset,
      quoteDecimals: context.quoteDecimals,
      creatorTaxBps: creatorTax,
      buybackAvailable: false,
      initialBuyQuoteIn,
      launchFeeUsdc: snapshot.launchFeeUsdc,
      graduationThreshold: snapshot.graduationThreshold,
      creatorRevenueWallet: creator.creatorFeeRecipient,
      permanentLiquidityLock: true,
      economicsDigest: snapshot.economicsDigest,
      configVersion: snapshot.configVersion,
    },
  };
}
