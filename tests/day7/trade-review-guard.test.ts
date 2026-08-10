import { describe, expect, it } from 'vitest';

import { estimateBuyTradeReview } from '../../packages/protocol-sdk/src/trade-review.js';
import { executeTradeLifecycle } from '../../apps/web/lib/transactions/controller.js';

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

function storage(): Storage {
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

function harness(quoteReserve = 1_000_000n) {
  let sends = 0;
  const client = {
    async readContract(request: { functionName: string }) {
      switch (request.functionName) {
        case 'getReserves': return [quoteReserve, 2_000_000n] as const;
        case 'reservedTokens': return 0n;
        case 'tradeFeeBps': return 100n;
        case 'creatorTaxBps': return 50n;
        case 'currentSnipeTaxBps': return 0n;
        default: throw new Error(`unexpected read ${request.functionName}`);
      }
    },
    async simulateContract() { return { request: {} }; },
    async waitForTransactionReceipt() { return { status: 'success' as const }; },
  } as never;
  const wallet = {
    async getAccount() { return address('b'); },
    async getChainId() { return 5042002; },
    async ensurePreparedTransactionAllowance() {},
    async sendPreparedTransaction() { sends += 1; return hash('c'); },
  };
  return { client, wallet, get sends() { return sends; } };
}

const trade = {
  context,
  action: 'BUY' as const,
  tokenAddress: address('a'),
  curveAddress: address('9'),
  inputAmount: 10_000n,
  slippageBps: 50,
};

describe('Day 7 Task 5 final-review guard', () => {
  it('does not open the wallet when the final canonical reread changes reviewed financial consequences', async () => {
    const changed = harness(1_100_000n);
    const result = await executeTradeLifecycle({
      ...trade,
      client: changed.client,
      wallet: changed.wallet,
      storage: storage(),
      approvedReview,
    });

    expect(result.reviewChanged).toBe(true);
    expect(result.prepared?.review).not.toEqual(approvedReview);
    expect(result.state.status).toBe('IDLE');
    expect(changed.sends).toBe(0);
  });

  it('allows the wallet signature boundary only when the final reread matches the user-approved review', async () => {
    const unchanged = harness();
    const result = await executeTradeLifecycle({
      ...trade,
      client: unchanged.client,
      wallet: unchanged.wallet,
      storage: storage(),
      approvedReview,
    });

    expect(result.reviewChanged).toBe(false);
    expect(result.state.status).toBe('CONFIRMED');
    expect(unchanged.sends).toBe(1);
  });

  it('requires an approved review instead of signing from an unseen fresh estimate', async () => {
    const fresh = harness();
    const result = await executeTradeLifecycle({
      ...trade,
      client: fresh.client,
      wallet: fresh.wallet,
      storage: storage(),
      approvedReview: undefined,
    });

    expect(result.reviewChanged).toBe(true);
    expect(result.state.status).toBe('IDLE');
    expect(fresh.sends).toBe(0);
  });
});
