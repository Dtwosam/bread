import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

import type { Address, Hex } from '../../packages/types/src/index.js';
import { breadAbiRegistry } from '../../packages/protocol-sdk/src/abi/generated.js';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';

const requireFromSdk = createRequire(new URL('../../packages/protocol-sdk/package.json', import.meta.url));
const { encodeErrorResult } = requireFromSdk('viem') as {
  encodeErrorResult: (input: { abi: readonly unknown[]; errorName: string }) => Hex;
};

const address = (byte: string) => `0x${byte.repeat(40)}` as Address;

const user = address('1');
const curve = address('2');
const token = address('3');

const context: ProtocolContext = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'verified-stack-a',
  factoryAddress: address('4'),
  quoteAsset: address('5'),
  quoteDecimals: 6,
  deploymentStartBlock: 123n,
  addresses: {
    factory: address('4'),
    deployer: address('6'),
    feePolicy: address('7'),
    feeEscrow: address('8'),
    emergencyController: address('9'),
    locker: address('a'),
    coordinator: address('b'),
    graduationAdapter: address('c'),
  },
};

const launchParams = {
  name: 'Bread Test',
  symbol: 'BREADT',
  logo: 'ipfs://logo',
  description: 'test token',
  twitter: '',
  telegram: '',
  discord: '',
  website: '',
  farcaster: '',
  creatorFeeRecipient: user,
  creatorTaxBps: 100n,
  expectedEconomics: `0x${'11'.repeat(32)}` as const,
};

describe('Day 6 Task 2 direct-wallet SDK builders', () => {
  it('prepares Launch and Launch+Buy directly to Factory with zero native value', async () => {
    const sdk = await import('../../packages/protocol-sdk/src/index.ts');
    expect(sdk).toHaveProperty('prepareLaunch');
    expect(sdk).toHaveProperty('prepareLaunchAndBuy');

    const prepareLaunch = (sdk as Record<string, unknown>).prepareLaunch as
      | ((context: ProtocolContext, input: typeof launchParams) => Record<string, unknown>)
      | undefined;
    const prepareLaunchAndBuy = (sdk as Record<string, unknown>).prepareLaunchAndBuy as
      | ((context: ProtocolContext, input: Record<string, unknown>) => Record<string, unknown>)
      | undefined;

    const launch = prepareLaunch?.(context, launchParams);
    expect(launch?.to).toBe(context.addresses.factory);
    expect(launch?.value).toBe(0n);
    expect(launch?.functionName).toBe('launchToken');
    expect(launch?.args).toEqual([launchParams]);

    const launchAndBuy = prepareLaunchAndBuy?.(context, {
      params: launchParams,
      quoteIn: 1_000_000n,
      minTokensOut: 10n,
      recipient: user,
    });
    expect(launchAndBuy?.to).toBe(context.addresses.factory);
    expect(launchAndBuy?.value).toBe(0n);
    expect(launchAndBuy?.functionName).toBe('launchTokenAndBuy');
    expect(launchAndBuy?.args).toEqual([launchParams, 1_000_000n, 10n, user]);
  });

  it('prepares Buy/Sell directly to the launch curve and exposes exact allowance requirements', async () => {
    const sdk = await import('../../packages/protocol-sdk/src/index.ts');
    expect(sdk).toHaveProperty('prepareBuy');
    expect(sdk).toHaveProperty('prepareSell');

    const prepareBuy = (sdk as Record<string, unknown>).prepareBuy as
      | ((context: ProtocolContext, input: Record<string, unknown>) => Record<string, unknown>)
      | undefined;
    const prepareSell = (sdk as Record<string, unknown>).prepareSell as
      | ((context: ProtocolContext, input: Record<string, unknown>) => Record<string, unknown>)
      | undefined;

    const buy = prepareBuy?.(context, {
      curve,
      quoteIn: 1_000_000n,
      minTokensOut: 10n,
      recipient: user,
    });
    expect(buy?.to).toBe(curve);
    expect(buy?.value).toBe(0n);
    expect(buy?.functionName).toBe('buy');
    expect(buy?.args).toEqual([1_000_000n, 10n, user]);
    expect(buy?.allowance).toEqual({ token: context.quoteAsset, spender: curve, amount: 1_000_000n });

    const sell = prepareSell?.(context, {
      token,
      curve,
      tokensIn: 500n,
      minQuoteOut: 200n,
      recipient: user,
    });
    expect(sell?.to).toBe(curve);
    expect(sell?.value).toBe(0n);
    expect(sell?.functionName).toBe('sell');
    expect(sell?.args).toEqual([500n, 200n, user]);
    expect(sell?.allowance).toEqual({ token, spender: curve, amount: 500n });
  });

  it('prepares both FeeEscrow Claim overloads directly and contains no signer/key field', async () => {
    const sdk = await import('../../packages/protocol-sdk/src/index.ts');
    expect(sdk).toHaveProperty('prepareClaim');

    const prepareClaim = (sdk as Record<string, unknown>).prepareClaim as
      | ((context: ProtocolContext, input?: { amount?: bigint }) => Record<string, unknown>)
      | undefined;

    const fullClaim = prepareClaim?.(context);
    expect(fullClaim?.to).toBe(context.addresses.feeEscrow);
    expect(fullClaim?.functionName).toBe('claim');
    expect(fullClaim?.args).toEqual([]);

    const partialClaim = prepareClaim?.(context, { amount: 250_000n });
    expect(partialClaim?.to).toBe(context.addresses.feeEscrow);
    expect(partialClaim?.functionName).toBe('claim');
    expect(partialClaim?.args).toEqual([250_000n]);

    const prepared = partialClaim ?? {};
    expect(Object.keys(prepared)).not.toContain('account');
    expect(Object.keys(prepared)).not.toContain('privateKey');
    expect(Object.keys(prepared)).not.toContain('walletClient');
    expect(Object.keys(prepared)).not.toContain('signer');
  });

  it('maps RetryGraduation exactly by canonical phase and never collapses the two stages', async () => {
    const sdk = await import('../../packages/protocol-sdk/src/index.ts');
    expect(sdk).toHaveProperty('prepareRetryGraduation');

    const prepareRetryGraduation = (sdk as Record<string, unknown>).prepareRetryGraduation as
      | ((context: ProtocolContext, input: Record<string, unknown>) => Record<string, unknown>)
      | undefined;

    const sweep = prepareRetryGraduation?.(context, {
      token,
      phase: 'NOT_GRADUATED',
      readyToGraduate: true,
    });
    expect(sweep).toMatchObject({ kind: 'TRANSACTION', stage: 'SWEEP' });
    expect((sweep?.transaction as Record<string, unknown> | undefined)?.to).toBe(context.addresses.coordinator);
    expect((sweep?.transaction as Record<string, unknown> | undefined)?.functionName).toBe('sweep');
    expect((sweep?.transaction as Record<string, unknown> | undefined)?.args).toEqual([token]);

    const createPool = prepareRetryGraduation?.(context, {
      token,
      phase: 'SWEPT',
      readyToGraduate: true,
    });
    expect(createPool).toMatchObject({ kind: 'TRANSACTION', stage: 'CREATE_POOL' });
    expect((createPool?.transaction as Record<string, unknown> | undefined)?.functionName).toBe('createPool');

    expect(
      prepareRetryGraduation?.(context, { token, phase: 'POOL_CREATED', readyToGraduate: true }),
    ).toEqual({ kind: 'TERMINAL', status: 'ALREADY_COMPLETE' });
    expect(prepareRetryGraduation?.(context, { token, phase: 'RESCUED', readyToGraduate: true })).toEqual({
      kind: 'TERMINAL',
      status: 'RESCUED',
    });
    expect(() =>
      prepareRetryGraduation?.(context, { token, phase: 'NOT_GRADUATED', readyToGraduate: false }),
    ).toThrow(/not ready/i);
  });

  it('delegates simulation to a PublicClient without retaining or signing with the account', async () => {
    const sdk = await import('../../packages/protocol-sdk/src/index.ts');
    expect(sdk).toHaveProperty('prepareBuy');
    expect(sdk).toHaveProperty('simulatePreparedTransaction');

    const prepareBuy = (sdk as Record<string, unknown>).prepareBuy as
      | ((context: ProtocolContext, input: Record<string, unknown>) => Record<string, unknown>)
      | undefined;
    const simulatePreparedTransaction = (sdk as Record<string, unknown>).simulatePreparedTransaction as
      | ((client: { simulateContract: (input: unknown) => Promise<unknown> }, request: unknown, account: Address) => Promise<unknown>)
      | undefined;

    const request = prepareBuy?.(context, {
      curve,
      quoteIn: 1_000_000n,
      minTokensOut: 10n,
      recipient: user,
    });
    const simulateContract = vi.fn().mockResolvedValue({ request: { to: curve }, result: 123n });
    const result = await simulatePreparedTransaction?.({ simulateContract }, request, user);

    expect(simulateContract).toHaveBeenCalledTimes(1);
    expect(simulateContract).toHaveBeenCalledWith(expect.objectContaining({
      address: curve,
      functionName: 'buy',
      args: [1_000_000n, 10n, user],
      account: user,
    }));
    expect(result).toEqual({ request: { to: curve }, result: 123n });
    expect(request && Object.keys(request as Record<string, unknown>)).not.toContain('account');
  });

  it('decodes registered Bread custom errors and fails closed for unknown revert data', async () => {
    const sdk = await import('../../packages/protocol-sdk/src/index.ts');
    expect(sdk).toHaveProperty('decodeBreadError');

    const decodeBreadError = (sdk as Record<string, unknown>).decodeBreadError as
      | ((data: Hex, context: ProtocolContext) => Record<string, unknown>)
      | undefined;

    const noFeesData = encodeErrorResult({
      abi: breadAbiRegistry.feeEscrow,
      errorName: 'NoFeesToClaim',
    });
    expect(decodeBreadError?.(noFeesData, context)).toEqual({
      contractRole: 'FEE_ESCROW',
      errorName: 'NoFeesToClaim',
      args: [],
    });

    const unknown = '0xdeadbeef' as Hex;
    expect(decodeBreadError?.(unknown, context)).toEqual({
      errorName: 'UNKNOWN_REVERT',
      data: unknown,
    });
  });
});
