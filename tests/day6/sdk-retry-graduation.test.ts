import { describe, expect, it, vi } from 'vitest';

import type { Address } from '../../packages/types/src/index.js';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';

const address = (byte: string) => `0x${byte.repeat(40)}` as Address;
const token = address('3');
const curve = address('2');

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

type ReadClient = { readContract: ReturnType<typeof vi.fn> };

describe('Day 6 Task 2 canonical RetryGraduation reads', () => {
  it('reads coordinator phase, factory launch record and curve readiness before preparing sweep', async () => {
    const sdk = await import('../../packages/protocol-sdk/src/index.ts');
    const prepareRetryGraduation = (sdk as Record<string, unknown>).prepareRetryGraduation as
      | ((client: ReadClient, context: ProtocolContext, input: { token: Address }) => Promise<Record<string, unknown>>)
      | undefined;
    expect(prepareRetryGraduation).toBeTypeOf('function');

    const readContract = vi
      .fn()
      .mockResolvedValueOnce({ phase: 0 })
      .mockResolvedValueOnce({ curve })
      .mockResolvedValueOnce(true);

    const result = await prepareRetryGraduation?.({ readContract }, context, { token });

    expect(readContract).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        address: context.addresses.coordinator,
        functionName: 'getGraduation',
        args: [token],
      }),
    );
    expect(readContract).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ address: context.addresses.factory, functionName: 'getLaunch', args: [token] }),
    );
    expect(readContract).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ address: curve, functionName: 'readyToGraduate', args: [] }),
    );
    expect(result).toMatchObject({ kind: 'TRANSACTION', stage: 'SWEEP' });
    expect((result?.transaction as Record<string, unknown> | undefined)?.functionName).toBe('sweep');
  });

  it('maps SWEPT and terminal phases from coordinator state without caller-supplied phase flags', async () => {
    const sdk = await import('../../packages/protocol-sdk/src/index.ts');
    const prepareRetryGraduation = (sdk as Record<string, unknown>).prepareRetryGraduation as
      | ((client: ReadClient, context: ProtocolContext, input: { token: Address }) => Promise<Record<string, unknown>>)
      | undefined;

    const sweptRead = vi.fn().mockResolvedValue({ phase: 1 });
    await expect(prepareRetryGraduation?.({ readContract: sweptRead }, context, { token })).resolves.toMatchObject({
      kind: 'TRANSACTION',
      stage: 'CREATE_POOL',
    });
    expect(sweptRead).toHaveBeenCalledTimes(1);

    const completeRead = vi.fn().mockResolvedValue({ phase: 2 });
    await expect(prepareRetryGraduation?.({ readContract: completeRead }, context, { token })).resolves.toEqual({
      kind: 'TERMINAL',
      status: 'ALREADY_COMPLETE',
    });

    const rescuedRead = vi.fn().mockResolvedValue({ phase: 3 });
    await expect(prepareRetryGraduation?.({ readContract: rescuedRead }, context, { token })).resolves.toEqual({
      kind: 'TERMINAL',
      status: 'RESCUED',
    });
  });

  it('refuses NOT_GRADUATED when the canonical curve readiness read is false', async () => {
    const sdk = await import('../../packages/protocol-sdk/src/index.ts');
    const prepareRetryGraduation = (sdk as Record<string, unknown>).prepareRetryGraduation as
      | ((client: ReadClient, context: ProtocolContext, input: { token: Address }) => Promise<Record<string, unknown>>)
      | undefined;

    const readContract = vi
      .fn()
      .mockResolvedValueOnce({ phase: 0 })
      .mockResolvedValueOnce({ curve })
      .mockResolvedValueOnce(false);

    await expect(prepareRetryGraduation?.({ readContract }, context, { token })).rejects.toThrow(/not ready/i);
  });
});
