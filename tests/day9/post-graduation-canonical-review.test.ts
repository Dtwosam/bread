import { describe, expect, it, vi } from 'vitest';

import type { Address } from '../../packages/types/src/index.js';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';

const address = (byte: string) => `0x${byte.repeat(40)}` as Address;
const bytes32Address = (value: Address) => `0x${'0'.repeat(24)}${value.slice(2)}` as const;

const token = address('1');
const curve = address('2');
const launchCoordinator = address('3');
const launchAdapter = address('4');
const quoteAsset = address('5');
const v3Factory = address('6');
const positionManager = address('7');
const router = address('8');
const quoter = address('9');
const pool = address('a');
const protocolFactory = address('b');
const configHash = `0x${'11'.repeat(32)}` as const;
const Q96 = 1n << 96n;

const context = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'test-stack',
  factoryAddress: protocolFactory,
  quoteAsset,
  quoteDecimals: 6,
  deploymentStartBlock: 123n,
  addresses: {
    factory: protocolFactory,
    deployer: address('c'),
    feePolicy: address('d'),
    feeEscrow: address('e'),
    emergencyController: address('f'),
    locker: address('1'),
    coordinator: address('2'),
    graduationAdapter: address('3'),
  },
  graduatedTrading: {
    family: 'UNISWAP_V3',
    factory: v3Factory,
    positionManager,
    swapRouter: router,
    swapRouterKind: 'V3_SWAP_ROUTER_02',
    quoter,
    quoterKind: 'V3_QUOTER_V2',
  },
} satisfies ProtocolContext;

function launch() {
  return {
    token,
    curve,
    deployer: address('c'),
    creatorFeeRecipient: address('d'),
    creatorTaxBps: 100,
    economicsDigest: `0x${'22'.repeat(32)}`,
    launchTimestamp: 1,
    configVersion: 1,
    graduationCoordinator: launchCoordinator,
    graduationAdapter: launchAdapter,
    graduationAdapterFamily: 2,
    graduationConfigHash: configHash,
  };
}

function graduation(phase: number) {
  return {
    phase,
    sweptAt: 0,
    sweptUsdc: 0n,
    sweptTokens: 0n,
    poolTokenAmount: 0n,
    poolId: phase === 2 ? bytes32Address(pool) : `0x${'0'.repeat(64)}`,
    positionManager: phase === 2 ? positionManager : address('0'),
    positionId: phase === 2 ? 1n : 0n,
  };
}

function activeCurveClient() {
  return {
    readContract: vi.fn(async (request: { address: Address; functionName: string }) => {
      if (request.address === protocolFactory && request.functionName === 'getLaunch') return launch();
      if (request.address === launchCoordinator && request.functionName === 'getGraduation') return graduation(0);
      if (request.address === curve && request.functionName === 'readyToGraduate') return false;
      if (request.address === curve && request.functionName === 'getReserves') return [1_000_000n, 1_000_000n];
      if (request.address === curve && request.functionName === 'reservedTokens') return 0n;
      if (request.address === curve && request.functionName === 'tradeFeeBps') return 100n;
      if (request.address === curve && request.functionName === 'creatorTaxBps') return 50n;
      if (request.address === curve && request.functionName === 'currentSnipeTaxBps') return 0n;
      throw new Error(`unexpected read ${request.address} ${request.functionName}`);
    }),
  };
}

function graduatedClient() {
  return {
    readContract: vi.fn(async (request: { address: Address; functionName: string }) => {
      if (request.address === protocolFactory && request.functionName === 'getLaunch') return launch();
      if (request.address === launchCoordinator && request.functionName === 'getGraduation') return graduation(2);
      if (request.address === launchAdapter && request.functionName === 'family') return 2;
      if (request.address === launchAdapter && request.functionName === 'coordinator') return launchCoordinator;
      if (request.address === launchAdapter && request.functionName === 'configHash') return configHash;
      if (request.address === launchAdapter && request.functionName === 'usdc') return quoteAsset;
      if (request.address === launchAdapter && request.functionName === 'positionManager') return positionManager;
      if (request.address === launchAdapter && request.functionName === 'v3Factory') return v3Factory;
      if (request.address === launchAdapter && request.functionName === 'fee') return 3000;
      if (request.address === router && request.functionName === 'factory') return v3Factory;
      if (request.address === quoter && request.functionName === 'factory') return v3Factory;
      if (request.address === v3Factory && request.functionName === 'getPool') return pool;
      if (request.address === pool && request.functionName === 'token0') return quoteAsset;
      if (request.address === pool && request.functionName === 'token1') return token;
      if (request.address === pool && request.functionName === 'fee') return 3000;
      if (request.address === pool && request.functionName === 'liquidity') return 1n;
      if (request.address === pool && request.functionName === 'slot0') return [Q96, 0, 0, 1, 1, 0, true];
      if (request.address === quoter && request.functionName === 'quoteExactInputSingle') return [900n, Q96, 0, 123_456n];
      throw new Error(`unexpected read ${request.address} ${request.functionName}`);
    }),
  };
}

describe('Day 9 canonical trade review orchestration', () => {
  it('returns the unchanged curve review for an active non-ready launch', async () => {
    const sdk = await import('../../packages/protocol-sdk/src/index.ts');
    expect(sdk).toHaveProperty('readCanonicalTradeReview');
    const readCanonicalTradeReview = (sdk as Record<string, unknown>).readCanonicalTradeReview as
      | ((client: { readContract: (request: never) => Promise<unknown> }, context: ProtocolContext, input: Record<string, unknown>) => Promise<Record<string, unknown>>)
      | undefined;

    const result = await readCanonicalTradeReview?.(activeCurveClient() as never, context, {
      token,
      action: 'BUY',
      inputAmount: 1_000n,
      slippageBps: 100,
    });

    expect(result).toMatchObject({
      route: { kind: 'CURVE', curve },
      review: {
        action: 'BUY',
        inputAmount: 1_000n,
        slippageBps: 100,
      },
    });
    expect(result && Object.keys(result)).not.toContain('transaction');
  });

  it('returns the V3 review for a canonically POOL_CREATED launch without producing a transaction', async () => {
    const sdk = await import('../../packages/protocol-sdk/src/index.ts');
    const readCanonicalTradeReview = (sdk as Record<string, unknown>).readCanonicalTradeReview as
      | ((client: { readContract: (request: never) => Promise<unknown> }, context: ProtocolContext, input: Record<string, unknown>) => Promise<Record<string, unknown>>)
      | undefined;

    const result = await readCanonicalTradeReview?.(graduatedClient() as never, context, {
      token,
      action: 'BUY',
      inputAmount: 1_000n,
      slippageBps: 100,
    });

    expect(result).toMatchObject({
      route: {
        kind: 'V3_POOL',
        pool,
        fee: 3000,
        swapRouter: router,
        quoter,
      },
      review: {
        action: 'BUY',
        route: 'V3_POOL',
        expectedOutput: 900n,
        minimumOutput: 891n,
        venueFee: 3000,
        baseFee: 0n,
        creatorTax: 0n,
        openingTaxBps: 0,
        openingTax: 0n,
      },
    });
    expect(result && Object.keys(result)).not.toContain('transaction');
  });

  it('propagates canonical pending-graduation failure before any review quote', async () => {
    const sdk = await import('../../packages/protocol-sdk/src/index.ts');
    const readCanonicalTradeReview = (sdk as Record<string, unknown>).readCanonicalTradeReview as
      | ((client: { readContract: (request: never) => Promise<unknown> }, context: ProtocolContext, input: Record<string, unknown>) => Promise<Record<string, unknown>>)
      | undefined;
    const client = activeCurveClient();
    client.readContract.mockImplementation(async (request: { address: Address; functionName: string }) => {
      if (request.address === protocolFactory && request.functionName === 'getLaunch') return launch();
      if (request.address === launchCoordinator && request.functionName === 'getGraduation') return graduation(0);
      if (request.address === curve && request.functionName === 'readyToGraduate') return true;
      throw new Error(`unexpected read ${request.address} ${request.functionName}`);
    });

    await expect(readCanonicalTradeReview?.(client as never, context, {
      token,
      action: 'BUY',
      inputAmount: 1_000n,
      slippageBps: 100,
    })).rejects.toThrow('graduation is pending');
    expect(client.readContract).not.toHaveBeenCalledWith(expect.objectContaining({ functionName: 'getReserves' }));
    expect(client.readContract).not.toHaveBeenCalledWith(expect.objectContaining({ functionName: 'quoteExactInputSingle' }));
  });
});
