import type { Abi, PublicClient } from 'viem';

import type { Address, Hex32 } from '../../types/src/index.js';
import type { ProtocolContext } from './context.js';
import { breadAbiRegistry } from './abi/generated.ts';

export type AllowanceRequirement = Readonly<{
  token: Address;
  spender: Address;
  amount: bigint;
}>;

export type TradeBuilderContext = Readonly<{
  quoteAsset: Address;
}>;

/**
 * Signer-free transaction preparation contract. Account/signing state is
 * intentionally absent; callers pass an account only to chain simulation and
 * later hand this request to their wallet of choice.
 */
export type PreparedBreadTransaction = Readonly<{
  to: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
  value: 0n;
  allowance?: AllowanceRequirement;
}>;

export type LaunchParams = Readonly<{
  name: string;
  symbol: string;
  logo: string;
  description: string;
  twitter: string;
  telegram: string;
  discord: string;
  website: string;
  farcaster: string;
  creatorFeeRecipient: Address;
  creatorTaxBps: bigint;
  expectedEconomics: Hex32;
}>;

export type GraduationPhase = 'NOT_GRADUATED' | 'SWEPT' | 'POOL_CREATED' | 'RESCUED';

export type RetryGraduationResult =
  | Readonly<{
      kind: 'TRANSACTION';
      stage: 'SWEEP' | 'CREATE_POOL';
      transaction: PreparedBreadTransaction;
    }>
  | Readonly<{ kind: 'TERMINAL'; status: 'ALREADY_COMPLETE' | 'RESCUED' }>;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;
const ZERO = BigInt(0);

function positive(name: string, value: bigint): bigint {
  if (value <= ZERO) throw new Error(`${name} must be greater than zero`);
  return value;
}

function nonNegative(name: string, value: bigint): bigint {
  if (value < ZERO) throw new Error(`${name} must not be negative`);
  return value;
}

function prepared(
  to: Address,
  abi: Abi,
  functionName: string,
  args: readonly unknown[],
  allowance?: AllowanceRequirement,
): PreparedBreadTransaction {
  return {
    to,
    abi,
    functionName,
    args,
    value: BigInt(0),
    ...(allowance === undefined ? {} : { allowance }),
  } as PreparedBreadTransaction;
}

function graduationPhase(record: unknown): number {
  const phase =
    Array.isArray(record)
      ? record[0]
      : typeof record === 'object' && record !== null && 'phase' in record
        ? (record as { phase: unknown }).phase
        : undefined;
  if (typeof phase !== 'number' && typeof phase !== 'bigint') {
    throw new Error('invalid canonical graduation record');
  }
  const numeric = Number(phase);
  if (!Number.isSafeInteger(numeric) || numeric < 0 || numeric > 3) {
    throw new Error(`unsupported graduation phase: ${String(phase)}`);
  }
  return numeric;
}

function launchCurve(record: unknown): Address {
  const curve =
    Array.isArray(record)
      ? record[1]
      : typeof record === 'object' && record !== null && 'curve' in record
        ? (record as { curve: unknown }).curve
        : undefined;
  if (typeof curve !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(curve) || curve.toLowerCase() === ZERO_ADDRESS) {
    throw new Error('canonical launch record has no curve');
  }
  return curve as Address;
}

/**
 * Prepares the canonical Factory launch call. When the caller already read the
 * current canonical launch fee it may supply it here so a direct-wallet
 * consumer can satisfy exactly the required USDC allowance before simulation.
 */
export function prepareLaunch(
  context: ProtocolContext,
  params: LaunchParams,
  launchFeeUsdc: bigint = ZERO,
): PreparedBreadTransaction {
  nonNegative('launchFeeUsdc', launchFeeUsdc);
  return prepared(
    context.addresses.factory,
    breadAbiRegistry.factory,
    'launchToken',
    [params],
    launchFeeUsdc === ZERO
      ? undefined
      : { token: context.quoteAsset, spender: context.addresses.factory, amount: launchFeeUsdc },
  );
}

export function prepareLaunchAndBuy(
  context: ProtocolContext,
  input: Readonly<{
    params: LaunchParams;
    quoteIn: bigint;
    minTokensOut: bigint;
    recipient: Address;
    launchFeeUsdc?: bigint;
  }>,
): PreparedBreadTransaction {
  positive('quoteIn', input.quoteIn);
  nonNegative('minTokensOut', input.minTokensOut);
  const launchFeeUsdc = nonNegative('launchFeeUsdc', input.launchFeeUsdc ?? ZERO);
  return prepared(
    context.addresses.factory,
    breadAbiRegistry.factory,
    'launchTokenAndBuy',
    [input.params, input.quoteIn, input.minTokensOut, input.recipient],
    {
      token: context.quoteAsset,
      spender: context.addresses.factory,
      amount: launchFeeUsdc + input.quoteIn,
    },
  );
}

export function prepareBuy(
  context: TradeBuilderContext,
  input: Readonly<{
    curve: Address;
    quoteIn: bigint;
    minTokensOut: bigint;
    recipient: Address;
  }>,
): PreparedBreadTransaction {
  positive('quoteIn', input.quoteIn);
  nonNegative('minTokensOut', input.minTokensOut);
  return prepared(
    input.curve,
    breadAbiRegistry.curve,
    'buy',
    [input.quoteIn, input.minTokensOut, input.recipient],
    { token: context.quoteAsset, spender: input.curve, amount: input.quoteIn },
  );
}

export function prepareSell(
  _context: TradeBuilderContext,
  input: Readonly<{
    token: Address;
    curve: Address;
    tokensIn: bigint;
    minQuoteOut: bigint;
    recipient: Address;
  }>,
): PreparedBreadTransaction {
  positive('tokensIn', input.tokensIn);
  nonNegative('minQuoteOut', input.minQuoteOut);
  return prepared(
    input.curve,
    breadAbiRegistry.curve,
    'sell',
    [input.tokensIn, input.minQuoteOut, input.recipient],
    { token: input.token, spender: input.curve, amount: input.tokensIn },
  );
}

export function prepareClaim(
  context: ProtocolContext,
  input?: Readonly<{ amount?: bigint }>,
): PreparedBreadTransaction {
  if (input?.amount === undefined) {
    return prepared(context.addresses.feeEscrow, breadAbiRegistry.feeEscrow, 'claim', []);
  }
  positive('claim amount', input.amount);
  return prepared(context.addresses.feeEscrow, breadAbiRegistry.feeEscrow, 'claim', [input.amount]);
}

/**
 * Reads the authoritative graduation phase before choosing a retry action.
 * Callers cannot supply or override phase/readiness. For NOT_GRADUATED, the
 * canonical Factory launch record identifies the curve and the curve itself
 * must report readyToGraduate() before a sweep transaction is prepared.
 */
export async function prepareRetryGraduation(
  client: PublicClient,
  context: ProtocolContext,
  input: Readonly<{ token: Address }>,
): Promise<RetryGraduationResult> {
  const record = await client.readContract({
    address: context.addresses.coordinator,
    abi: breadAbiRegistry.coordinator,
    functionName: 'getGraduation',
    args: [input.token],
  } as never);

  switch (graduationPhase(record)) {
    case 1:
      return {
        kind: 'TRANSACTION',
        stage: 'CREATE_POOL',
        transaction: prepared(context.addresses.coordinator, breadAbiRegistry.coordinator, 'createPool', [input.token]),
      };
    case 2:
      return { kind: 'TERMINAL', status: 'ALREADY_COMPLETE' };
    case 3:
      return { kind: 'TERMINAL', status: 'RESCUED' };
    case 0: {
      const launch = await client.readContract({
        address: context.addresses.factory,
        abi: breadAbiRegistry.factory,
        functionName: 'getLaunch',
        args: [input.token],
      } as never);
      const curve = launchCurve(launch);
      const ready = await client.readContract({
        address: curve,
        abi: breadAbiRegistry.curve,
        functionName: 'readyToGraduate',
        args: [],
      } as never);
      if (ready !== true) throw new Error('curve is not ready for graduation');
      return {
        kind: 'TRANSACTION',
        stage: 'SWEEP',
        transaction: prepared(context.addresses.coordinator, breadAbiRegistry.coordinator, 'sweep', [input.token]),
      };
    }
    default:
      throw new Error('unsupported graduation phase');
  }
}

export async function simulatePreparedTransaction(
  client: PublicClient,
  request: PreparedBreadTransaction,
  account: Address,
): Promise<unknown> {
  return client.simulateContract({
    address: request.to,
    abi: request.abi,
    functionName: request.functionName,
    args: request.args,
    value: request.value,
    account,
  } as never);
}
