import { describe, expect, it } from 'vitest';

import {
  recoverPersistedTransactions,
} from '../../apps/web/lib/transactions/controller.js';
import {
  loadRecoverableTransactions,
  persistSubmittedTransaction,
} from '../../apps/web/lib/transactions/storage.js';

const address = (byte: string) => `0x${byte.repeat(40)}` as `0x${string}`;
const hash = (byte: string) => `0x${byte.repeat(64)}` as `0x${string}`;

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

function record(overrides: Partial<{
  chainId: number;
  hash: `0x${string}`;
  status: 'SUBMITTED' | 'CONFIRMING' | 'UNKNOWN';
}> = {}) {
  return {
    chainId: overrides.chainId ?? 5042002,
    hash: overrides.hash ?? hash('1'),
    action: 'BUY' as const,
    tokenAddress: address('a'),
    submittedAt: '2026-08-10T12:00:00.000Z',
    status: overrides.status ?? 'SUBMITTED',
  };
}

describe('Day 7 Task 5 persisted transaction recovery', () => {
  it('resumes a submitted hash after reload and reconciles confirmed state', async () => {
    const storage = memoryStorage();
    persistSubmittedTransaction(storage, record());
    const seen: string[] = [];
    const confirmed: string[] = [];
    const client = {
      async waitForTransactionReceipt() { return { status: 'success' as const }; },
    } as never;

    const recovered = await recoverPersistedTransactions({
      client,
      storage,
      chainId: 5042002,
      onStateChange: (state) => seen.push(state.status),
      onConfirmed: async (entry) => confirmed.push(entry.hash),
    });

    expect(seen).toContain('CONFIRMING');
    expect(recovered[0]?.status).toBe('CONFIRMED');
    expect(confirmed).toEqual([hash('1')]);
    expect(loadRecoverableTransactions(storage)).toEqual([]);
  });

  it('does not consume a recoverable transaction from another chain runtime', async () => {
    const storage = memoryStorage();
    persistSubmittedTransaction(storage, record({ chainId: 1 }));
    let waits = 0;
    const client = {
      async waitForTransactionReceipt() { waits += 1; return { status: 'success' as const }; },
    } as never;

    const recovered = await recoverPersistedTransactions({ client, storage, chainId: 5042002 });

    expect(recovered).toEqual([]);
    expect(waits).toBe(0);
    expect(loadRecoverableTransactions(storage)).toHaveLength(1);
  });

  it('keeps transport failure UNKNOWN and recoverable instead of inventing a failed receipt', async () => {
    const storage = memoryStorage();
    persistSubmittedTransaction(storage, record({ status: 'UNKNOWN' }));
    const client = {
      async waitForTransactionReceipt() { throw new Error('rpc unavailable'); },
    } as never;

    const recovered = await recoverPersistedTransactions({ client, storage, chainId: 5042002 });

    expect(recovered[0]?.status).toBe('UNKNOWN');
    expect(loadRecoverableTransactions(storage)).toEqual([
      expect.objectContaining({ hash: hash('1'), status: 'UNKNOWN' }),
    ]);
  });

  it('persists a replacement hash before continuing confirmation and reconciles the replacement', async () => {
    const storage = memoryStorage();
    persistSubmittedTransaction(storage, record());
    const replacementHash = hash('2');
    const seen: Array<{ status: string; hash?: string }> = [];
    const confirmed: string[] = [];
    const client = {
      async waitForTransactionReceipt(request: { onReplaced?: (replacement: unknown) => void }) {
        request.onReplaced?.({ transaction: { hash: replacementHash } });
        expect(loadRecoverableTransactions(storage)).toEqual([
          expect.objectContaining({ hash: replacementHash, status: 'CONFIRMING' }),
        ]);
        return { status: 'success' as const };
      },
    } as never;

    const recovered = await recoverPersistedTransactions({
      client,
      storage,
      chainId: 5042002,
      onStateChange: (state) => seen.push({ status: state.status, hash: state.hash }),
      onConfirmed: async (entry) => confirmed.push(entry.hash),
    });

    expect(seen).toContainEqual({ status: 'REPLACED', hash: replacementHash });
    expect(recovered[0]).toMatchObject({ status: 'CONFIRMED', hash: replacementHash });
    expect(confirmed).toEqual([replacementHash]);
    expect(loadRecoverableTransactions(storage)).toEqual([]);
  });
});
