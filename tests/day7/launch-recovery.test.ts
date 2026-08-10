import { describe, expect, it } from 'vitest';

import {
  extractLaunchCreatedToken,
  recoverLaunchTransactions,
} from '../../apps/web/lib/transactions/launch-controller.js';
import {
  loadRecoverableTransactions,
  persistSubmittedTransaction,
} from '../../apps/web/lib/transactions/storage.js';
import type { SubmittedTransactionRecord } from '../../apps/web/lib/transactions/state.js';

const address = (byte: string) => `0x${byte.repeat(40)}` as `0x${string}`;
const hash = (byte: string) => `0x${byte.repeat(64)}` as `0x${string}`;

const context = {
  network: 'arc-testnet',
  chainId: 5_042_002,
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

function launchRecord(overrides: Partial<SubmittedTransactionRecord> = {}): SubmittedTransactionRecord {
  return {
    chainId: context.chainId,
    hash: hash('a'),
    action: 'LAUNCH',
    launchIntentId: 'create:reload:1',
    submittedAt: '2026-08-10T10:40:00.000Z',
    status: 'SUBMITTED',
    ...overrides,
  };
}

const token = address('a');
const curve = address('b');
const decodedLaunchLog = {
  address: context.addresses.factory,
  eventName: 'LaunchCreated',
  args: {
    deployer: address('c'),
    token,
    curve,
    creatorFeeRecipient: address('d'),
    creatorTaxBps: 100n,
    economicsDigest: hash('e'),
    configVersion: 7n,
  },
  topics: [hash('f')],
  data: '0x',
};

describe('Day 7 Task 6 launch confirmation and reload recovery', () => {
  it('extracts the token only from the canonical Factory LaunchCreated log', () => {
    expect(extractLaunchCreatedToken({ logs: [
      { ...decodedLaunchLog, address: address('9'), args: { ...decodedLaunchLog.args, token: address('9') } },
      decodedLaunchLog,
    ] }, context)).toBe(token);

    expect(() => extractLaunchCreatedToken({ logs: [] }, context)).toThrow(/LaunchCreated.*missing/i);
  });

  it('recovers a submitted launch, confirms it, returns canonical token identity and clears recovery', async () => {
    const storage = memoryStorage();
    persistSubmittedTransaction(storage, launchRecord());
    const states: string[] = [];
    const confirmed: Array<{ hash: string; tokenAddress?: string }> = [];

    const recovered = await recoverLaunchTransactions({
      client: {
        async waitForTransactionReceipt() {
          expect(loadRecoverableTransactions(storage, { actions: ['LAUNCH', 'LAUNCH_AND_BUY'] })).toHaveLength(1);
          return { status: 'success' as const, logs: [decodedLaunchLog] };
        },
      } as never,
      storage,
      context,
      onStateChange: (state) => states.push(state.status),
      onConfirmed: (record) => confirmed.push({ hash: record.hash, tokenAddress: record.tokenAddress }),
    });

    expect(recovered).toEqual([
      expect.objectContaining({ state: expect.objectContaining({ status: 'CONFIRMED', tokenAddress: token }), tokenAddress: token }),
    ]);
    expect(states).toEqual(['CONFIRMING', 'CONFIRMED']);
    expect(confirmed).toEqual([{ hash: hash('a'), tokenAddress: token }]);
    expect(loadRecoverableTransactions(storage, { actions: ['LAUNCH', 'LAUNCH_AND_BUY'] })).toEqual([]);
  });

  it('preserves UNKNOWN on reload transport loss without consuming the launch record', async () => {
    const storage = memoryStorage();
    persistSubmittedTransaction(storage, launchRecord({ status: 'UNKNOWN' }));

    const recovered = await recoverLaunchTransactions({
      client: {
        async waitForTransactionReceipt() {
          throw new Error('rpc unavailable');
        },
      } as never,
      storage,
      context,
    });

    expect(recovered[0]?.state).toMatchObject({ status: 'UNKNOWN', hash: hash('a') });
    expect(loadRecoverableTransactions(storage, { actions: ['LAUNCH', 'LAUNCH_AND_BUY'] })).toEqual([
      expect.objectContaining({ hash: hash('a'), status: 'UNKNOWN' }),
    ]);
  });

  it('persists a replacement launch hash and completes recovery from the replacement', async () => {
    const storage = memoryStorage();
    persistSubmittedTransaction(storage, launchRecord());
    const replacement = hash('7');
    const states: string[] = [];

    const recovered = await recoverLaunchTransactions({
      client: {
        async waitForTransactionReceipt({ onReplaced }: { onReplaced?: (value: unknown) => void }) {
          onReplaced?.({ transaction: { hash: replacement } });
          expect(loadRecoverableTransactions(storage, { actions: ['LAUNCH', 'LAUNCH_AND_BUY'] })).toEqual([
            expect.objectContaining({ hash: replacement, status: 'CONFIRMING' }),
          ]);
          return { status: 'success' as const, logs: [decodedLaunchLog] };
        },
      } as never,
      storage,
      context,
      onStateChange: (state) => states.push(state.status),
    });

    expect(states).toContain('REPLACED');
    expect(recovered[0]).toMatchObject({ tokenAddress: token });
    expect(loadRecoverableTransactions(storage, { actions: ['LAUNCH', 'LAUNCH_AND_BUY'] })).toEqual([]);
  });
});
