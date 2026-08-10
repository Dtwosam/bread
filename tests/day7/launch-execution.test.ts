import { describe, expect, it } from 'vitest';

import {
  executeLaunchLifecycle,
} from '../../apps/web/lib/transactions/launch-controller.js';
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
import {
  prepareCanonicalLaunchReview,
  type LaunchReviewSnapshot,
} from '../../packages/protocol-sdk/src/launch-review.js';

const hash = (byte: string) => `0x${byte.repeat(64)}` as `0x${string}`;
const address = (byte: string) => `0x${byte.repeat(40)}` as `0x${string}`;
const digest = (byte: string) => `0x${byte.repeat(64)}` as `0x${string}`;

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

const baseSnapshot: LaunchReviewSnapshot = {
  supply: 1_000_000_000n * 10n ** 18n,
  phantomQuote: 10_000_000n,
  graduationThreshold: 50_000_000n,
  launchFeeUsdc: 2_500_000n,
  graduationAdapter: address('9'),
  graduationConfigHash: digest('c'),
  enabled: true,
  configVersion: 7n,
  economicsDigest: digest('a'),
  protocolFeeRecipient: address('d'),
  tradeFeeBps: 100,
  protocolFeeShareBps: 5_000,
  maxCreatorTaxBps: 500,
};

const creator = {
  name: 'Bread Test',
  symbol: 'BREADT',
  logo: 'https://example.com/token.png',
  description: 'A deterministic test launch.',
  twitter: 'https://x.com/example',
  telegram: 'https://t.me/example',
  website: 'https://example.com',
  creatorFeeRecipient: address('b'),
  creatorTaxBps: 250n,
} as const;

const approved = prepareCanonicalLaunchReview({
  context,
  snapshot: baseSnapshot,
  creator,
  initialBuyQuoteIn: 25_000_000n,
  slippageBps: 50,
});

const confirmedLaunchLog = {
  address: context.addresses.factory,
  eventName: 'LaunchCreated',
  args: {
    deployer: creator.creatorFeeRecipient,
    token: address('f'),
    curve: address('e'),
    creatorFeeRecipient: creator.creatorFeeRecipient,
    creatorTaxBps: creator.creatorTaxBps,
    economicsDigest: baseSnapshot.economicsDigest,
    configVersion: baseSnapshot.configVersion,
  },
  topics: [hash('f')],
  data: '0x',
};

function chainHarness({
  secondDigest = baseSnapshot.economicsDigest,
  receiptError,
}: Readonly<{
  secondDigest?: `0x${string}`;
  receiptError?: Error;
}> = {}) {
  const order: string[] = [];
  const writes: string[] = [];
  const states: string[] = [];
  const storage = memoryStorage();
  let snapshotRead = 0;

  const client = {
    async readContract(request: { functionName: string }) {
      order.push(`read:${request.functionName}`);
      switch (request.functionName) {
        case 'currentLaunchConfig':
          snapshotRead += 1;
          return [{
            supply: baseSnapshot.supply,
            phantomQuote: baseSnapshot.phantomQuote,
            graduationThreshold: baseSnapshot.graduationThreshold,
            launchFeeUsdc: baseSnapshot.launchFeeUsdc,
            graduationAdapter: baseSnapshot.graduationAdapter,
            graduationConfigHash: baseSnapshot.graduationConfigHash,
            enabled: true,
          }, baseSnapshot.configVersion] as const;
        case 'previewLaunchEconomics':
          return snapshotRead >= 2 ? secondDigest : baseSnapshot.economicsDigest;
        case 'currentFeePolicy':
          return {
            protocolFeeRecipient: baseSnapshot.protocolFeeRecipient,
            tradeFeeBps: baseSnapshot.tradeFeeBps,
            protocolFeeShareBps: baseSnapshot.protocolFeeShareBps,
            maxCreatorTaxBps: baseSnapshot.maxCreatorTaxBps,
          };
        default:
          throw new Error(`unexpected read ${request.functionName}`);
      }
    },
    async simulateContract() {
      order.push('simulate');
      return { request: {} };
    },
    async waitForTransactionReceipt() {
      order.push('receipt');
      expect(loadRecoverableTransactions(storage, { actions: ['LAUNCH', 'LAUNCH_AND_BUY'] })).toHaveLength(1);
      if (receiptError) throw receiptError;
      return { status: 'success' as const, logs: [confirmedLaunchLog] };
    },
  } as never;

  const wallet = {
    async getAccount() { return creator.creatorFeeRecipient; },
    async getChainId() { return context.chainId; },
    async ensurePreparedTransactionAllowance() {
      order.push('allowance');
    },
    async sendPreparedTransaction() {
      order.push('launch-write');
      writes.push('launch');
      return hash('e');
    },
  };

  return { client, wallet, storage, order, writes, states };
}

const launchRecord: SubmittedTransactionRecord = {
  chainId: context.chainId,
  hash: hash('a'),
  action: 'LAUNCH',
  launchIntentId: 'create:bread-test:2026-08-10T10:30:00Z',
  submittedAt: '2026-08-10T10:30:05.000Z',
  status: 'SUBMITTED',
};

const tradeRecord: SubmittedTransactionRecord = {
  chainId: context.chainId,
  hash: hash('b'),
  action: 'BUY',
  tokenAddress: address('c'),
  submittedAt: '2026-08-10T10:30:06.000Z',
  status: 'SUBMITTED',
};

describe('Day 7 Task 6 shared launch transaction state', () => {
  it('uses the Task-5 lifecycle for launch actions without pretending a token address exists pre-confirmation', () => {
    let state = createLaunchTransactionState('LAUNCH_AND_BUY', launchRecord.launchIntentId!);
    expect(state).toMatchObject({ action: 'LAUNCH_AND_BUY', launchIntentId: launchRecord.launchIntentId, status: 'IDLE' });
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
    expect(loadRecoverableTransactions(storage, { actions: ['LAUNCH', 'LAUNCH_AND_BUY'] })).toEqual([launchRecord]);
  });

  it('filters trade and launch recovery ownership so providers cannot consume each other records', () => {
    const storage = memoryStorage();
    persistSubmittedTransaction(storage, launchRecord);
    persistSubmittedTransaction(storage, tradeRecord);
    expect(loadRecoverableTransactions(storage, { actions: ['BUY', 'SELL'] }).map((record) => record.hash)).toEqual([tradeRecord.hash]);
    expect(loadRecoverableTransactions(storage, { actions: ['LAUNCH', 'LAUNCH_AND_BUY'] }).map((record) => record.hash)).toEqual([launchRecord.hash]);
  });
});

describe('Day 7 Task 6 launch execution', () => {
  it('rereads before allowance and again before simulation/signature, persists hash before wait and confirms', async () => {
    const test = chainHarness();
    const result = await executeLaunchLifecycle({
      client: test.client,
      wallet: test.wallet,
      storage: test.storage,
      context,
      approved,
      launchIntentId: 'create:bread-test:1',
      now: () => new Date('2026-08-10T10:30:05.000Z'),
      onStateChange: (state) => test.states.push(state.status),
    });
    expect(result.reviewChanged).toBe(false);
    expect(result.state.status).toBe('CONFIRMED');
    expect(result.tokenAddress).toBe(address('f'));
    expect(test.writes).toEqual(['launch']);
    expect(test.states).toEqual(['VALIDATING', 'PREPARING', 'AWAITING_SIGNATURE', 'SUBMITTED', 'CONFIRMING', 'CONFIRMED']);
    const firstDigestRead = test.order.indexOf('read:previewLaunchEconomics');
    const allowance = test.order.indexOf('allowance');
    const secondDigestRead = test.order.lastIndexOf('read:previewLaunchEconomics');
    const simulation = test.order.indexOf('simulate');
    const launchWrite = test.order.indexOf('launch-write');
    expect(firstDigestRead).toBeGreaterThan(-1);
    expect(allowance).toBeGreaterThan(firstDigestRead);
    expect(secondDigestRead).toBeGreaterThan(allowance);
    expect(simulation).toBeGreaterThan(secondDigestRead);
    expect(launchWrite).toBeGreaterThan(simulation);
  });

  it('blocks before approval when current economics no longer match the user-approved review', async () => {
    const test = chainHarness();
    const staleClient = {
      ...test.client,
      async readContract(request: { functionName: string }) {
        if (request.functionName === 'previewLaunchEconomics') return digest('f');
        return test.client.readContract(request as never);
      },
    } as never;
    const result = await executeLaunchLifecycle({ client: staleClient, wallet: test.wallet, storage: test.storage, context, approved, launchIntentId: 'create:bread-test:2' });
    expect(result.reviewChanged).toBe(true);
    expect(test.order).not.toContain('allowance');
    expect(test.order).not.toContain('launch-write');
  });

  it('blocks launch signature if economics change while allowance is being confirmed', async () => {
    const test = chainHarness({ secondDigest: digest('f') });
    const result = await executeLaunchLifecycle({ client: test.client, wallet: test.wallet, storage: test.storage, context, approved, launchIntentId: 'create:bread-test:3' });
    expect(result.reviewChanged).toBe(true);
    expect(test.order).toContain('allowance');
    expect(test.order).not.toContain('simulate');
    expect(test.order).not.toContain('launch-write');
  });

  it('keeps post-broadcast receipt transport loss recoverable as UNKNOWN with the launch hash', async () => {
    const test = chainHarness({ receiptError: new Error('network lost') });
    const result = await executeLaunchLifecycle({ client: test.client, wallet: test.wallet, storage: test.storage, context, approved, launchIntentId: 'create:bread-test:4' });
    expect(result.state.status).toBe('UNKNOWN');
    expect(result.state.hash).toBe(hash('e'));
    expect(loadRecoverableTransactions(test.storage, { actions: ['LAUNCH', 'LAUNCH_AND_BUY'] })).toEqual([
      expect.objectContaining({ hash: hash('e'), status: 'UNKNOWN', launchIntentId: 'create:bread-test:4' }),
    ]);
  });
});
