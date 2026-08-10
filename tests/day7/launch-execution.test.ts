import { describe, expect, it } from 'vitest';

import {
  canSubmitTransactionAction,
  createLaunchTransactionState,
  transitionTransactionState,
  type SubmittedTransactionRecord,
} from '../../apps/web/lib/transactions/state.js';
import {
  loadRecoverableTransactions,
  persistSubmittedTransaction,
} from '../../apps/web/lib/transactions/storage.js';

const hash = (byte: string) => `0x${byte.repeat(64)}` as `0x${string}`;
const address = (byte: string) => `0x${byte.repeat(40)}` as `0x${string}`;

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

const launchRecord: SubmittedTransactionRecord = {
  chainId: 5_042_002,
  hash: hash('a'),
  action: 'LAUNCH',
  launchIntentId: 'create:bread-test:2026-08-10T10:30:00Z',
  submittedAt: '2026-08-10T10:30:05.000Z',
  status: 'SUBMITTED',
};

const tradeRecord: SubmittedTransactionRecord = {
  chainId: 5_042_002,
  hash: hash('b'),
  action: 'BUY',
  tokenAddress: address('c'),
  submittedAt: '2026-08-10T10:30:06.000Z',
  status: 'SUBMITTED',
};

describe('Day 7 Task 6 shared launch transaction state', () => {
  it('uses the Task-5 lifecycle for launch actions without pretending a token address exists pre-confirmation', () => {
    let state = createLaunchTransactionState('LAUNCH_AND_BUY', launchRecord.launchIntentId);
    expect(state).toMatchObject({
      action: 'LAUNCH_AND_BUY',
      launchIntentId: launchRecord.launchIntentId,
      status: 'IDLE',
    });
    expect(state.tokenAddress).toBeUndefined();

    state = transitionTransactionState(state, { type: 'VALIDATE' });
    state = transitionTransactionState(state, { type: 'PREPARE' });
    state = transitionTransactionState(state, { type: 'AWAIT_SIGNATURE' });
    state = transitionTransactionState(state, { type: 'SUBMIT', record: { ...launchRecord, action: 'LAUNCH_AND_BUY' } });
    state = transitionTransactionState(state, { type: 'CONFIRM' });
    expect(state.status).toBe('CONFIRMING');
    expect(canSubmitTransactionAction(state)).toBe(false);
  });

  it('persists launch records in the same bounded transaction store and recovers their intent identity', () => {
    const storage = memoryStorage();
    persistSubmittedTransaction(storage, launchRecord);

    expect(loadRecoverableTransactions(storage, { actions: ['LAUNCH', 'LAUNCH_AND_BUY'] })).toEqual([
      launchRecord,
    ]);
  });

  it('filters trade and launch recovery ownership so providers cannot consume each other records', () => {
    const storage = memoryStorage();
    persistSubmittedTransaction(storage, launchRecord);
    persistSubmittedTransaction(storage, tradeRecord);

    expect(loadRecoverableTransactions(storage, { actions: ['BUY', 'SELL'] }).map((record) => record.hash)).toEqual([
      tradeRecord.hash,
    ]);
    expect(loadRecoverableTransactions(storage, { actions: ['LAUNCH', 'LAUNCH_AND_BUY'] }).map((record) => record.hash)).toEqual([
      launchRecord.hash,
    ]);
  });
});
