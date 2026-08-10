import { describe, expect, it } from 'vitest';

import { prepareClaim } from '../../packages/protocol-sdk/src/builders.js';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';
import {
  executeClaimLifecycle,
  recoverClaimTransactions,
  type ClaimReview,
} from '../../apps/web/lib/transactions/claim-controller.js';
import {
  loadRecoverableTransactions,
  persistSubmittedTransaction,
} from '../../apps/web/lib/transactions/storage.js';

const address = (byte: string) => `0x${byte.repeat(40)}` as `0x${string}`;
const hash = (byte: string) => `0x${byte.repeat(64)}` as `0x${string}`;

const context: ProtocolContext = {
  network: 'arc-testnet',
  chainId: 5042002,
  stackVersion: 'test-stack',
  factoryAddress: address('1'),
  quoteAsset: address('2'),
  quoteDecimals: 6,
  deploymentStartBlock: 1n,
  addresses: {
    factory: address('1'),
    deployer: address('3'),
    feePolicy: address('4'),
    feeEscrow: address('5'),
    emergencyController: address('6'),
    locker: address('7'),
    coordinator: address('8'),
  },
};

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

function review(amount = 10n): ClaimReview {
  return {
    recipient: address('a'),
    claimableUsdc: amount,
    transaction: amount === 0n ? null : prepareClaim(context, { amount }),
  };
}

function wallet(events: string[] = []) {
  return {
    async getAccount() { return address('a'); },
    async getChainId() { return context.chainId; },
    async ensurePreparedTransactionAllowance() {
      throw new Error('claim must not request allowance');
    },
    async sendPreparedTransaction() {
      events.push('send');
      return hash('1');
    },
  };
}

describe('Day 7 Task 7 claim execution and recovery', () => {
  it('blocks signature when the authoritative FeeEscrow balance changed after Review', async () => {
    const storage = memoryStorage();
    let sends = 0;
    let simulations = 0;
    const client = {
      async readContract() { return 11n; },
      async simulateContract() { simulations += 1; return {}; },
      async waitForTransactionReceipt() { return { status: 'success' as const }; },
    } as never;
    const claimWallet = {
      ...wallet(),
      async sendPreparedTransaction() { sends += 1; return hash('1'); },
    };

    const result = await executeClaimLifecycle({
      client,
      wallet: claimWallet,
      storage,
      context,
      approved: review(10n),
    });

    expect(result.reviewChanged).toBe(true);
    expect(result.review.claimableUsdc).toBe(11n);
    expect(sends).toBe(0);
    expect(simulations).toBe(0);
    expect(loadRecoverableTransactions(storage, { actions: ['CLAIM'] })).toEqual([]);
  });

  it('simulates immediately before direct signing, persists hash before waiting and confirms', async () => {
    const storage = memoryStorage();
    const events: string[] = [];
    const client = {
      async readContract() { return 10n; },
      async simulateContract() { events.push('simulate'); return {}; },
      async waitForTransactionReceipt() {
        events.push('wait');
        expect(loadRecoverableTransactions(storage, { actions: ['CLAIM'] })).toEqual([
          expect.objectContaining({ action: 'CLAIM', hash: hash('1'), status: 'CONFIRMING' }),
        ]);
        return { status: 'success' as const };
      },
    } as never;
    const confirmed: string[] = [];

    const result = await executeClaimLifecycle({
      client,
      wallet: wallet(events),
      storage,
      context,
      approved: review(10n),
      onConfirmed: async (record) => confirmed.push(record.hash),
    });

    expect(events).toEqual(['simulate', 'send', 'wait']);
    expect(result.reviewChanged).toBe(false);
    expect(result.state.status).toBe('CONFIRMED');
    expect(confirmed).toEqual([hash('1')]);
    expect(loadRecoverableTransactions(storage, { actions: ['CLAIM'] })).toEqual([]);
  });

  it('keeps receipt transport loss UNKNOWN and recoverable instead of inventing a failed claim', async () => {
    const storage = memoryStorage();
    const client = {
      async readContract() { return 10n; },
      async simulateContract() { return {}; },
      async waitForTransactionReceipt() { throw new Error('rpc unavailable'); },
    } as never;

    const result = await executeClaimLifecycle({
      client,
      wallet: wallet(),
      storage,
      context,
      approved: review(10n),
    });

    expect(result.state.status).toBe('UNKNOWN');
    expect(loadRecoverableTransactions(storage, { actions: ['CLAIM'] })).toEqual([
      expect.objectContaining({
        action: 'CLAIM',
        claimRecipient: address('a'),
        hash: hash('1'),
        status: 'UNKNOWN',
      }),
    ]);
  });

  it('reload recovery consumes only CLAIM records and leaves trade recovery ownership intact', async () => {
    const storage = memoryStorage();
    persistSubmittedTransaction(storage, {
      chainId: context.chainId,
      hash: hash('1'),
      action: 'CLAIM',
      claimRecipient: address('a'),
      submittedAt: '2026-08-10T12:00:00.000Z',
      status: 'UNKNOWN',
    });
    persistSubmittedTransaction(storage, {
      chainId: context.chainId,
      hash: hash('2'),
      action: 'BUY',
      tokenAddress: address('b'),
      submittedAt: '2026-08-10T12:01:00.000Z',
      status: 'UNKNOWN',
    });
    const waited: string[] = [];
    const client = {
      async waitForTransactionReceipt({ hash: transactionHash }: { hash: string }) {
        waited.push(transactionHash);
        return { status: 'success' as const };
      },
    } as never;

    const recovered = await recoverClaimTransactions({
      client,
      storage,
      chainId: context.chainId,
    });

    expect(waited).toEqual([hash('1')]);
    expect(recovered[0]?.status).toBe('CONFIRMED');
    expect(loadRecoverableTransactions(storage, { actions: ['CLAIM'] })).toEqual([]);
    expect(loadRecoverableTransactions(storage)).toEqual([
      expect.objectContaining({ action: 'BUY', hash: hash('2'), status: 'UNKNOWN' }),
    ]);
  });
});
