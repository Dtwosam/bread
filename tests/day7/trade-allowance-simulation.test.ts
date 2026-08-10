import { describe, expect, it } from 'vitest';

import {
  loadRecoverableAllowanceTransactions,
} from '../../apps/web/lib/transactions/allowance-storage.js';
import { executeTradeLifecycle } from '../../apps/web/lib/transactions/controller.js';
import { createTradeWalletAdapter } from '../../apps/web/lib/transactions/wallet-adapter.js';
import { estimateBuyTradeReview } from '../../packages/protocol-sdk/src/trade-review.js';

const address = (byte: string) => `0x${byte.repeat(40)}` as `0x${string}`;
const hash = (byte: string) => `0x${byte.repeat(64)}` as `0x${string}`;

const context = {
  chainId: 5_042_002,
  quoteAsset: address('2'),
  quoteDecimals: 6,
} as const;

const tokenAddress = address('a');
const curveAddress = address('9');
const account = address('b');
const inputAmount = 10_000n;

const baseSnapshot = {
  quoteReserve: 1_000_000n,
  tokenReserve: 2_000_000n,
  reservedTokens: 0n,
  tradeFeeBps: 100,
  creatorTaxBps: 50,
  openingTaxBps: 0,
} as const;

const approvedReview = estimateBuyTradeReview({
  quoteIn: inputAmount,
  slippageBps: 50,
  snapshot: baseSnapshot,
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

function harness({
  approvalReceipt = 'success' as const,
  approvalWaitError,
  changedAfterApproval = false,
}: Readonly<{
  approvalReceipt?: 'success' | 'reverted';
  approvalWaitError?: Error;
  changedAfterApproval?: boolean;
}> = {}) {
  let approvalConfirmed = false;
  const order: string[] = [];
  const writes: string[] = [];
  const storage = memoryStorage();

  const publicClient = {
    async readContract(request: { functionName: string }) {
      if (request.functionName === 'allowance') {
        order.push('allowance-read');
        return approvalConfirmed ? inputAmount : 0n;
      }

      order.push(`finance:${request.functionName}`);
      const changed = changedAfterApproval && approvalConfirmed;
      switch (request.functionName) {
        case 'getReserves':
          return changed ? [1_100_000n, 2_000_000n] as const : [baseSnapshot.quoteReserve, baseSnapshot.tokenReserve] as const;
        case 'reservedTokens':
          return baseSnapshot.reservedTokens;
        case 'tradeFeeBps':
          return BigInt(baseSnapshot.tradeFeeBps);
        case 'creatorTaxBps':
          return BigInt(baseSnapshot.creatorTaxBps);
        case 'currentSnipeTaxBps':
          return BigInt(baseSnapshot.openingTaxBps);
        default:
          throw new Error(`unexpected read ${request.functionName}`);
      }
    },
    async simulateContract() {
      order.push('simulate');
      if (!approvalConfirmed) throw new Error('trade simulated before approval confirmation');
      return { request: {} };
    },
    async waitForTransactionReceipt({ hash: transactionHash }: { hash: `0x${string}` }) {
      if (transactionHash === hash('1')) {
        order.push('approval-receipt');
        if (approvalWaitError) throw approvalWaitError;
        if (approvalReceipt === 'success') approvalConfirmed = true;
        return { status: approvalReceipt };
      }
      order.push('trade-receipt');
      return { status: 'success' as const };
    },
  } as never;

  const walletClient = {
    async writeContract(request: { functionName: string }) {
      writes.push(request.functionName);
      if (request.functionName === 'approve') {
        order.push('approval-write');
        return hash('1');
      }
      order.push('trade-write');
      return hash('2');
    },
  } as never;

  const wallet = createTradeWalletAdapter({
    publicClient,
    walletClient,
    account,
    chainId: context.chainId,
    storage,
  });

  return { publicClient, wallet, storage, order, writes };
}

const trade = {
  context,
  action: 'BUY' as const,
  tokenAddress,
  curveAddress,
  inputAmount,
  slippageBps: 50,
  approvedReview,
};

describe('Day 7 post-Task-5 allowance-before-simulation continuity repair', () => {
  it('confirms exact allowance before final canonical reread, simulation and trade broadcast', async () => {
    const test = harness();

    const result = await executeTradeLifecycle({
      ...trade,
      client: test.publicClient,
      wallet: test.wallet,
      storage: test.storage,
    });

    expect(result.state.status).toBe('CONFIRMED');
    expect(result.reviewChanged).toBe(false);
    expect(test.writes).toEqual(['approve', 'buy']);
    expect(loadRecoverableAllowanceTransactions(test.storage)).toEqual([]);

    const approvalReceiptIndex = test.order.indexOf('approval-receipt');
    const firstFinanceIndex = test.order.findIndex((entry) => entry.startsWith('finance:'));
    const simulationIndex = test.order.indexOf('simulate');
    const tradeWriteIndex = test.order.indexOf('trade-write');

    expect(approvalReceiptIndex).toBeGreaterThan(-1);
    expect(firstFinanceIndex).toBeGreaterThan(approvalReceiptIndex);
    expect(simulationIndex).toBeGreaterThan(firstFinanceIndex);
    expect(tradeWriteIndex).toBeGreaterThan(simulationIndex);
  });

  it('fails closed on a mined approval revert without simulating or broadcasting the trade', async () => {
    const test = harness({ approvalReceipt: 'reverted' });

    const result = await executeTradeLifecycle({
      ...trade,
      client: test.publicClient,
      wallet: test.wallet,
      storage: test.storage,
    });

    expect(result.state.status).toBe('REVERTED');
    expect(test.writes).toEqual(['approve']);
    expect(loadRecoverableAllowanceTransactions(test.storage)).toEqual([]);
    expect(test.order).not.toContain('simulate');
    expect(test.order).not.toContain('trade-write');
  });

  it('keeps an uncertain approval hash recoverable and never broadcasts a duplicate approval', async () => {
    const test = harness({ approvalWaitError: new Error('network lost after approval broadcast') });

    const first = await executeTradeLifecycle({
      ...trade,
      client: test.publicClient,
      wallet: test.wallet,
      storage: test.storage,
    });

    expect(first.state.status).toBe('UNKNOWN');
    expect(first.state.hash).toBe(hash('1'));
    expect(test.writes).toEqual(['approve']);
    expect(loadRecoverableAllowanceTransactions(test.storage)).toEqual([
      expect.objectContaining({ hash: hash('1'), status: 'UNKNOWN' }),
    ]);
    expect(test.order).not.toContain('simulate');
    expect(test.order).not.toContain('trade-write');

    const second = await executeTradeLifecycle({
      ...trade,
      inputAmount: 5_000n,
      client: test.publicClient,
      wallet: test.wallet,
      storage: test.storage,
    });

    expect(second.state.status).toBe('UNKNOWN');
    expect(second.state.hash).toBe(hash('1'));
    expect(test.writes).toEqual(['approve']);
  });

  it('rechecks economics after approval and blocks trade signing when the approved review changed', async () => {
    const test = harness({ changedAfterApproval: true });

    const result = await executeTradeLifecycle({
      ...trade,
      client: test.publicClient,
      wallet: test.wallet,
      storage: test.storage,
    });

    expect(result.reviewChanged).toBe(true);
    expect(result.prepared?.review).toBeDefined();
    expect(result.prepared?.review.expectedOutput).not.toBe(approvedReview.expectedOutput);
    expect(test.writes).toEqual(['approve']);
    expect(test.order).toContain('simulate');
    expect(test.order).not.toContain('trade-write');
  });
});
