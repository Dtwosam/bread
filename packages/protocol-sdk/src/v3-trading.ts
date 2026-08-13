import { parseAbi, type PublicClient } from 'viem';

import type { Address } from '../../types/src/index.js';
import type { CanonicalTradeRoute } from './trade-route.js';

const ZERO = BigInt(0) as 0n;
const BPS = BigInt(10_000);
const Q96 = BigInt(1) << BigInt(96);
const Q192 = Q96 * Q96;

const quoterV1Abi = parseAbi([
  'function quoteExactInputSingle(address tokenIn,address tokenOut,uint24 fee,uint256 amountIn,uint160 sqrtPriceLimitX96) returns (uint256 amountOut)',
]);

const quoterV2Abi = parseAbi([
  'function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)',
]);

const poolSlot0Abi = parseAbi([
  'function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16 observationIndex,uint16 observationCardinality,uint16 observationCardinalityNext,uint8 feeProtocol,bool unlocked)',
]);

export type V3TradeRoute = Extract<CanonicalTradeRoute, { kind: 'V3_POOL' }>;

export type V3TradeReview = Readonly<{
  action: 'BUY' | 'SELL';
  route: 'V3_POOL';
  inputAmount: bigint;
  expectedOutput: bigint;
  minimumOutput: bigint;
  venueFee: number;
  baseFee: 0n;
  creatorTax: 0n;
  openingTaxBps: 0;
  openingTax: 0n;
  priceImpactBps: number;
  slippageBps: number;
}>;

function requirePositiveInput(inputAmount: bigint): void {
  if (inputAmount <= ZERO) throw new Error('V3 trade requires a positive input amount.');
}

function requireSlippage(slippageBps: number): void {
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps >= 10_000) {
    throw new Error('Slippage must be an integer from 0 to 9999 bps.');
  }
}

function tradeTokens(route: V3TradeRoute, action: 'BUY' | 'SELL') {
  return action === 'BUY'
    ? { tokenIn: route.quoteAsset, tokenOut: route.token }
    : { tokenIn: route.token, tokenOut: route.quoteAsset };
}

function canonicalBigInt(value: unknown, label: string): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  throw new Error(`invalid canonical ${label}`);
}

function quoteAmountOut(result: unknown, kind: V3TradeRoute['quoterKind']): bigint {
  if (kind === 'V3_QUOTER') return canonicalBigInt(result, 'V3 quote');
  if (kind === 'V3_QUOTER_V2') {
    if (!Array.isArray(result) || result.length < 1) throw new Error('invalid canonical V3 quote');
    return canonicalBigInt(result[0], 'V3 quote');
  }
  throw new Error('unsupported V3 quoter kind');
}

function slot0SqrtPrice(result: unknown): bigint {
  const value = Array.isArray(result)
    ? result[0]
    : typeof result === 'object' && result !== null && 'sqrtPriceX96' in result
      ? (result as { sqrtPriceX96: unknown }).sqrtPriceX96
      : undefined;
  const sqrtPriceX96 = canonicalBigInt(value, 'V3 pool sqrt price');
  if (sqrtPriceX96 <= ZERO) throw new Error('invalid canonical V3 pool sqrt price');
  return sqrtPriceX96;
}

function addressBefore(left: Address, right: Address): boolean {
  return BigInt(left) < BigInt(right);
}

function rawSpotOutput(
  inputAmount: bigint,
  tokenIn: Address,
  tokenOut: Address,
  sqrtPriceX96: bigint,
): bigint {
  const priceX192 = sqrtPriceX96 * sqrtPriceX96;
  return addressBefore(tokenIn, tokenOut)
    ? (inputAmount * priceX192) / Q192
    : (inputAmount * Q192) / priceX192;
}

function priceImpactBps(spotOutput: bigint, expectedOutput: bigint): number {
  if (spotOutput <= ZERO || expectedOutput >= spotOutput) return 0;
  return Number(((spotOutput - expectedOutput) * BPS) / spotOutput);
}

export async function readV3TradeReview(
  client: PublicClient,
  route: V3TradeRoute,
  action: 'BUY' | 'SELL',
  inputAmount: bigint,
  slippageBps: number,
): Promise<V3TradeReview> {
  requirePositiveInput(inputAmount);
  requireSlippage(slippageBps);
  const { tokenIn, tokenOut } = tradeTokens(route, action);

  const quoteRequest = route.quoterKind === 'V3_QUOTER_V2'
    ? {
        address: route.quoter,
        abi: quoterV2Abi,
        functionName: 'quoteExactInputSingle',
        args: [{ tokenIn, tokenOut, amountIn: inputAmount, fee: route.fee, sqrtPriceLimitX96: ZERO }],
      }
    : route.quoterKind === 'V3_QUOTER'
      ? {
          address: route.quoter,
          abi: quoterV1Abi,
          functionName: 'quoteExactInputSingle',
          args: [tokenIn, tokenOut, route.fee, inputAmount, ZERO],
        }
      : undefined;
  if (quoteRequest === undefined) throw new Error('unsupported V3 quoter kind');

  const [quote, slot0] = await Promise.all([
    client.readContract(quoteRequest as never),
    client.readContract({ address: route.pool, abi: poolSlot0Abi, functionName: 'slot0' } as never),
  ]);

  const expectedOutput = quoteAmountOut(quote, route.quoterKind);
  if (expectedOutput <= ZERO) throw new Error('V3 quote returned no output');
  const sqrtPriceX96 = slot0SqrtPrice(slot0);
  const spotOutput = rawSpotOutput(inputAmount, tokenIn, tokenOut, sqrtPriceX96);
  const minimumOutput = (expectedOutput * BigInt(10_000 - slippageBps)) / BPS;

  return {
    action,
    route: 'V3_POOL',
    inputAmount,
    expectedOutput,
    minimumOutput,
    venueFee: route.fee,
    baseFee: ZERO,
    creatorTax: ZERO,
    openingTaxBps: 0,
    openingTax: ZERO,
    priceImpactBps: priceImpactBps(spotOutput, expectedOutput),
    slippageBps,
  };
}
