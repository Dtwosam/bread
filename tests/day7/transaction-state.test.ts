import { describe, expect, it } from 'vitest';

import {
  canSubmitTransactionAction,
  createTransactionState,
  transitionTransactionState,
} from '../../apps/web/lib/transactions/state.js';
import {
  loadRecoverableTransactions,
  persistSubmittedTransaction,
} from '../../apps/web/lib/transactions/storage.js';

type MemoryStorage = Storage & { dump: () => Record<string, string> };

function memoryStorage(seed: Record<string, string> = {}): MemoryStorage {
  const values = new Map(Object.entries(seed));
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    },
    dump() {
      return Object.fromEntries(values);
    },
  };
}

const submitted = {
  chainId: 5042002,
  hash: `0x${'11'.repeat(32)}` as const,
  action: 'BUY' as const,
  tokenAddress: `0x${'22'.repeat(20)}` as const,
  submittedAt: '2026-08-10T12:00:00.000Z',
  status: 'SUBMITTED' as const,
};

describe('Day 7 Task 5 transaction lifecycle', () => {
  it('allows only the frozen legal state transitions', () => {
    let state = createTransactionState('BUY', submitted.tokenAddress);
    expect(state.status).toBe('IDLE');

    state = transitionTransactionState(state, { type: 'VALIDATE' });
    expect(state.status).toBe('VALIDATING');
    state = transitionTransactionState(state, { type: 'PREPARE' });
    expect(state.status).toBe('PREPARING');
    state = transitionTransactionState(state, { type: 'AWAIT_SIGNATURE' });
    expect(state.status).toBe('AWAITING_SIGNATURE');
    state = transitionTransactionState(state, { type: 'SUBMIT', record: submitted });
    expect(state.status).toBe('SUBMITTED');
    expect(state.hash).toBe(submitted.hash);
    state = transitionTransactionState(state, { type: 'CONFIRM' });
    expect(state.status).toBe('CONFIRMING');
    state = transitionTransactionState(state, { type: 'CONFIRMED' });
    expect(state.status).toBe('CONFIRMED');

    expect(() => transitionTransactionState(state, { type: 'PREPARE' })).toThrow(/illegal transaction transition/i);
  });

  it('locks duplicate trade actions while wallet/signature, submission or replacement confirmation is unresolved', () => {
    const token = submitted.tokenAddress;
    const initial = createTransactionState('BUY', token);
    expect(canSubmitTransactionAction(initial)).toBe(true);

    const awaiting = transitionTransactionState(
      transitionTransactionState(transitionTransactionState(initial, { type: 'VALIDATE' }), { type: 'PREPARE' }),
      { type: 'AWAIT_SIGNATURE' },
    );
    expect(canSubmitTransactionAction(awaiting)).toBe(false);

    const sent = transitionTransactionState(awaiting, { type: 'SUBMIT', record: submitted });
    expect(canSubmitTransactionAction(sent)).toBe(false);
    const confirming = transitionTransactionState(sent, { type: 'CONFIRM' });
    expect(canSubmitTransactionAction(confirming)).toBe(false);

    const replacement = {
      ...submitted,
      hash: `0x${'55'.repeat(32)}` as const,
      status: 'CONFIRMING' as const,
    };
    const replaced = transitionTransactionState(confirming, { type: 'REPLACE', record: replacement });
    expect(replaced.status).toBe('REPLACED');
    expect(canSubmitTransactionAction(replaced)).toBe(false);
  });

  it('persists the transaction hash immediately in a bounded local recovery record', () => {
    const storage = memoryStorage();
    persistSubmittedTransaction(storage, submitted);

    const recovered = loadRecoverableTransactions(storage);
    expect(recovered).toEqual([submitted]);
    expect(JSON.stringify(storage.dump())).toContain(submitted.hash);
  });

  it('recovers submitted/confirming/unknown transactions after reload but not terminal records', () => {
    const storage = memoryStorage();
    persistSubmittedTransaction(storage, submitted);
    persistSubmittedTransaction(storage, {
      ...submitted,
      hash: `0x${'33'.repeat(32)}`,
      status: 'UNKNOWN',
      submittedAt: '2026-08-10T12:01:00.000Z',
    });
    persistSubmittedTransaction(storage, {
      ...submitted,
      hash: `0x${'44'.repeat(32)}`,
      status: 'CONFIRMED',
      submittedAt: '2026-08-10T12:02:00.000Z',
    });

    expect(loadRecoverableTransactions(storage).map((record) => record.status)).toEqual(['SUBMITTED', 'UNKNOWN']);
  });

  it('treats network-loss timeout as UNKNOWN rather than FAILED and preserves hash recovery', () => {
    let state = createTransactionState('BUY', submitted.tokenAddress);
    state = transitionTransactionState(state, { type: 'VALIDATE' });
    state = transitionTransactionState(state, { type: 'PREPARE' });
    state = transitionTransactionState(state, { type: 'AWAIT_SIGNATURE' });
    state = transitionTransactionState(state, { type: 'SUBMIT', record: submitted });
    state = transitionTransactionState(state, { type: 'UNKNOWN' });

    expect(state.status).toBe('UNKNOWN');
    expect(state.hash).toBe(submitted.hash);
    expect(state.error).toBeUndefined();
  });
});
