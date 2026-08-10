import { describe, expect, it } from 'vitest';

import { estimateBuyTradeReview } from '../../packages/protocol-sdk/src/trade-review.js';
import { executeTradeLifecycle } from '../../apps/web/lib/transactions/controller.js';
import { loadRecoverableTransactions } from '../../apps/web/lib/transactions/storage.js';

const address = (byte: string) => `0x${byte.repeat(40)}` as `0x${string}`;
const hash = (byte: string) => `0x${byte.repeat(64)}` as `0x${string}`;

const context = {
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
} as const;

const approvedReview = estimateBuyTradeReview({
  quoteIn: 10_000n,
  slippageBps: 50,
  snapshot: {
    quoteReserve: 1_000_000n,
    tokenReserve: 2_000_000n,
    reservedTokens: 0n,
    tradeFeeBps: 100,
    creatorTaxBps: 50,
    openingTaxBps: 0,
  },
});

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

function executionHarness({
  wait = async () => ({ status: 'success' as const }),
  send = async () => hash('c'),
}: Readonly<{
  wait?: (storage: Storage) => Promise<{ status: 'success' | 'reverted' }>;
  send?: () => Promise<`0x${string}`>;
}> = {}) {
  const storage = memoryStorage();
  const states: string[] = [];
  const reconciled: string[] = [];
  const reads: string[] = [];
  const client = {
    async readContract(request: { functionName: string }) {
      reads.push(request.functionName);
      switch (request.functionName) {
        case 'getReserves':
          return [1_000_000n, 2_000_000n] as const;
        case 'reservedTokens':
          return 0n;
        case 'tradeFeeBps':
          return 100n;
        case 'creatorTaxBps':
          return 50n;
        case 'currentSnipeTaxBps':
          return 0n;
        default:
          throw new Error(`unexpected read ${request.functionName}`);
      }
    },
    async simulateContract() {
      return { request: {} };
    },
    async waitForTransactionReceipt() {
      return wait(storage);
    },
  } as never;
  const wallet = {
    async getAccount() {
      return address('b');
    },
    async getChainId() {
      return 5042002;
    },
    async sendPreparedTransaction() {
      return send();
    },
  };

  return { storage, states, reconciled, reads, client, wallet };
}

const trade = {
  context,
  action: 'BUY' as const,
  tokenAddress: address('a'),
  curveAddress: address('9'),
  inputAmount: 10_000n,
  slippageBps: 50,
  approvedReview,
};

describe('Day 7 Task 5 trade submission and recovery', () => {
  it('persists the trade hash before receipt waiting and confirms through the frozen state sequence', async () => {
    const harness = executionHarness({
      wait: async (storage) => {
        expect(loadRecoverableTransactions(storage)).toHaveLength(1);
        expect(loadRecoverableTransactions(storage)[0]?.hash).toBe(hash('c'));
        return { status: 'success' };
      },
    });

    const result = await executeTradeLifecycle({
      ...trade,
      client: harness.client,
      wallet: harness.wallet,
      storage: harness.storage,
      now: () => new Date('2026-08-10T12:00:00.000Z'),
      onStateChange: (state) => harness.states.push(state.status),
      onConfirmed: async (record) => harness.reconciled.push(record.hash),
    });

    expect(harness.states).toEqual([
      'VALIDATING',
      'PREPARING',
      'AWAITING_SIGNATURE',
      'SUBMITTED',
      'CONFIRMING',
      'CONFIRMED',
    ]);
    expect(result.reviewChanged).toBe(false);
    expect(result.state.status).toBe('CONFIRMED');
    expect(harness.reconciled).toEqual([hash('c')]);
    expect(loadRecoverableTransactions(harness.storage)).toEqual([]);
  });

  it('keeps wallet rejection distinct and never writes a fake submitted record', async () => {
    const rejected = Object.assign(new Error('User rejected request'), { code: 4001 });
    const harness = executionHarness({ send: async () => Promise.reject(rejected) });

    const result = await executeTradeLifecycle({
      ...trade,
      client: harness.client,
      wallet: harness.wallet,
      storage: harness.storage,
    });

    expect(result.state.status).toBe('REJECTED');
    expect(result.state.hash).toBeUndefined();
    expect(loadRecoverableTransactions(harness.storage)).toEqual([]);
  });

  it('marks a mined revert as REVERTED without calling confirmed reconciliation', async () => {
    const harness = executionHarness({ wait: async () => ({ status: 'reverted' }) });

    const result = await executeTradeLifecycle({
      ...trade,
      client: harness.client,
      wallet: harness.wallet,
      storage: harness.storage,
      onConfirmed: async (record) => harness.reconciled.push(record.hash),
    });

    expect(result.state.status).toBe('REVERTED');
    expect(harness.reconciled).toEqual([]);
    expect(loadRecoverableTransactions(harness.storage)).toEqual([]);
  });

  it('turns receipt transport loss into recoverable UNKNOWN with the hash intact', async () => {
    const harness = executionHarness({ wait: async () => Promise.reject(new Error('network lost')) });

    const result = await executeTradeLifecycle({
      ...trade,
      client: harness.client,
      wallet: harness.wallet,
      storage: harness.storage,
    });

    expect(result.state.status).toBe('UNKNOWN');
    expect(result.state.hash).toBe(hash('c'));
    expect(loadRecoverableTransactions(harness.storage)).toEqual([
      expect.objectContaining({ hash: hash('c'), status: 'UNKNOWN' }),
    ]);
  });

  it('fails before financial reads or wallet submission when account/network preconditions are invalid', async () => {
    const harness = executionHarness();
    const wrongWallet = { ...harness.wallet, getChainId: async () => 1 };

    const result = await executeTradeLifecycle({
      ...trade,
      client: harness.client,
      wallet: wrongWallet,
      storage: harness.storage,
    });

    expect(result.state.status).toBe('REJECTED');
    expect(harness.reads).toEqual([]);
  });
});
