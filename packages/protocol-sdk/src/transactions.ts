import type { Abi, PublicClient } from 'viem';

import type { Address, Hex32 } from '../../types/src/index.js';
import type { ProtocolContext } from './context.js';
import { breadAbiRegistry } from './abi/generated.js';

export type AllowanceRequirement = Readonly<{
  token: Address;
  spender: Address;
  amount: bigint;
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

function positive(name: string, value: bigint): bigint {
  if (value <= 0n) throw new Error(`${name} must be greater than zero`);
  return value;
}

function nonNegative(name: string, value: bigint): bigint {
  if (value < 0n) throw new Error(`${name} must not be negative`);
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
    value: 0n,
    ...(allowance === undefined ? {} : { allowance }),
  };
}

export function prepareLaunch(context: ProtocolContext, params: LaunchParams): PreparedBreadTransaction {
  return prepared(context.addresses.factory, breadAbiRegistry.factory, 'launchToken', [params]);
}

export function prepareLaunchAndBuy(
  context: ProtocolContext,
  input: Readonly<{
    params: LaunchParams;
    quoteIn: bigint;
    minTokensOut: bigint;
    recipient: Address;
  }>,
): PreparedBreadTransaction {
  positive('quoteIn', input.quoteIn);
  nonNegative('minTokensOut', input.minTokensOut);
  return prepared(context.addresses.factory, breadAbiRegistry.factory, 'launchTokenAndBuy', [
    input.params,
    input.quoteIn,
    input.minTokensOut,
    input.recipient,
  ]);
}

export function prepareBuy(
  context: ProtocolContext,
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
  _context: ProtocolContext,
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

export function prepareRetryGraduation(
  context: ProtocolContext,
  input: Readonly<{
    token: Address;
    phase: GraduationPhase;
    readyToGraduate: boolean;
  }>,
): RetryGraduationResult {
  switch (input.phase) {
    case 'NOT_GRADUATED':
      if (!input.readyToGraduate) throw new Error('curve is not ready for graduation');
      return {
        kind: 'TRANSACTION',
        stage: 'SWEEP',
        transaction: prepared(context.addresses.coordinator, breadAbiRegistry.coordinator, 'sweep', [input.token]),
      };
    case 'SWEPT':
      return {
        kind: 'TRANSACTION',
        stage: 'CREATE_POOL',
        transaction: prepared(context.addresses.coordinator, breadAbiRegistry.coordinator, 'createPool', [input.token]),
      };
    case 'POOL_CREATED':
      return { kind: 'TERMINAL', status: 'ALREADY_COMPLETE' };
    case 'RESCUED':
      return { kind: 'TERMINAL', status: 'RESCUED' };
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
