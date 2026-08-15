import { describe, expect, it, vi } from 'vitest';

import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';
import {
  executeGraduationRetryLifecycle,
  readGraduationRetryReview,
  recoverGraduationRetryTransactions,
} from '../../apps/web/lib/transactions/graduation-controller.js';
import { persistSubmittedTransaction } from '../../apps/web/lib/transactions/storage.js';

const address = (byte: string) => `0x${byte.repeat(40)}` as `0x${string}`;
const hash = (byte: string) => `0x${byte.repeat(64)}` as `0x${string}`;
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

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('Day 9 graduation retry wallet recovery', () => {
  it('derives a SWEEP retry only from canonical coordinator/factory/curve reads', async () => {
    const readContract = vi
      .fn()
      .mockResolvedValueOnce({ phase: 0 })
      .mockResolvedValueOnce({ curve })
      .mockResolvedValueOnce(true);

    const review = await readGraduationRetryReview(
      { readContract } as never,
      context,
      token,
    );

    expect(readContract).toHaveBeenCalledTimes(3);
    expect(review).toMatchObject({ kind: 'TRANSACTION', stage: 'SWEEP' });
    expect(review.transaction?.functionName).toBe('sweep');
  });

  it('maps SWEPT to CREATE_POOL and terminal completion without caller-supplied phase flags', async () => {
    const swept = await readGraduationRetryReview(
      { readContract: vi.fn().mockResolvedValue({ phase: 1 }) } as never,
      context,
      token,
    );
    expect(swept).toMatchObject({ kind: 'TRANSACTION', stage: 'CREATE_POOL' });
    expect(swept.transaction?.functionName).toBe('createPool');

    const complete = await readGraduationRetryReview(
      { readContract: vi.fn().mockResolvedValue({ phase: 2 }) } as never,
      context,
      token,
    );
    expect(complete).toEqual({ kind: 'TERMINAL', status: 'ALREADY_COMPLETE' });
  });

  it('simulates the authoritative retry immediately before one wallet submission and persists confirmation', async () => {
    const storage = new MemoryStorage();
    const sent: string[] = [];
    const readContract = vi
      .fn()
      .mockResolvedValueOnce({ phase: 0 })
      .mockResolvedValueOnce({ curve })
      .mockResolvedValueOnce(true);
    const simulateContract = vi.fn().mockResolvedValue({ result: undefined });
    const waitForTransactionReceipt = vi.fn().mockResolvedValue({ status: 'success' as const });
    const client = { readContract, simulateContract, waitForTransactionReceipt } as never;
    const wallet = {
      async getAccount() { return address('d'); },
      async getChainId() { return context.chainId; },
      async ensurePreparedTransactionAllowance() {},
      async sendPreparedTransaction(transaction: { functionName: string }) {
        sent.push(transaction.functionName);
        return hash('e');
      },
    } as never;

    const result = await executeGraduationRetryLifecycle({
      client,
      wallet,
      storage,
      context,
      tokenAddress: token,
      now: () => new Date('2026-08-13T09:00:00.000Z'),
    });

    expect(simulateContract).toHaveBeenCalledTimes(1);
    expect(sent).toEqual(['sweep']);
    expect(waitForTransactionReceipt).toHaveBeenCalledWith(expect.objectContaining({ hash: hash('e') }));
    expect(result.state).toMatchObject({
      action: 'GRADUATION',
      tokenAddress: token,
      status: 'CONFIRMED',
      hash: hash('e'),
    });
    expect(storage.getItem('bread:submitted-transactions:v1')).toContain('GRADUATION');
    expect(storage.getItem('bread:submitted-transactions:v1')).toContain('CONFIRMED');
  });

  it('treats an already-terminal canonical phase as confirmation without simulation or wallet submission', async () => {
    const simulateContract = vi.fn();
    const sendPreparedTransaction = vi.fn();
    const result = await executeGraduationRetryLifecycle({
      client: {
        readContract: vi.fn().mockResolvedValue({ phase: 2 }),
        simulateContract,
      } as never,
      wallet: {
        async getAccount() { return address('d'); },
        async getChainId() { return context.chainId; },
        async ensurePreparedTransactionAllowance() {},
        sendPreparedTransaction,
      } as never,
      storage: new MemoryStorage(),
      context,
      tokenAddress: token,
    });

    expect(result.review).toEqual({ kind: 'TERMINAL', status: 'ALREADY_COMPLETE' });
    expect(result.state).toMatchObject({ action: 'GRADUATION', tokenAddress: token, status: 'CONFIRMED' });
    expect(simulateContract).not.toHaveBeenCalled();
    expect(sendPreparedTransaction).not.toHaveBeenCalled();
  });

  it('recovers a submitted graduation retry after reload without rebroadcasting it', async () => {
    const storage = new MemoryStorage();
    const submittedHash = hash('f');
    persistSubmittedTransaction(storage, {
      chainId: context.chainId,
      hash: submittedHash,
      action: 'GRADUATION',
      tokenAddress: token,
      submittedAt: '2026-08-13T09:00:00.000Z',
      status: 'SUBMITTED',
    });
    const waitForTransactionReceipt = vi.fn().mockResolvedValue({ status: 'success' as const });
    const onConfirmed = vi.fn();

    const recovered = await recoverGraduationRetryTransactions({
      client: { waitForTransactionReceipt } as never,
      storage,
      chainId: context.chainId,
      tokenAddress: token,
      onConfirmed,
    });

    expect(waitForTransactionReceipt).toHaveBeenCalledTimes(1);
    expect(waitForTransactionReceipt).toHaveBeenCalledWith(expect.objectContaining({ hash: submittedHash }));
    expect(onConfirmed).toHaveBeenCalledTimes(1);
    expect(recovered).toHaveLength(1);
    expect(recovered[0]).toMatchObject({
      action: 'GRADUATION',
      tokenAddress: token,
      hash: submittedHash,
      status: 'CONFIRMED',
    });
    expect(storage.getItem('bread:submitted-transactions:v1')).toContain('CONFIRMED');
  });

  it('fails closed on the wrong chain before simulation or broadcast', async () => {
    const simulateContract = vi.fn();
    const sendPreparedTransaction = vi.fn();
    const result = await executeGraduationRetryLifecycle({
      client: { readContract: vi.fn(), simulateContract } as never,
      wallet: {
        async getAccount() { return address('d'); },
        async getChainId() { return 1; },
        async ensurePreparedTransactionAllowance() {},
        sendPreparedTransaction,
      } as never,
      storage: new MemoryStorage(),
      context,
      tokenAddress: token,
    });

    expect(result.state.status).toBe('REJECTED');
    expect(result.state.error).toMatch(/wrong network/i);
    expect(simulateContract).not.toHaveBeenCalled();
    expect(sendPreparedTransaction).not.toHaveBeenCalled();
  });
});
