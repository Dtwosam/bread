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
const factory = address('6');
const positionManager = address('7');
const router = address('8');
const quoter = address('9');
const pool = address('a');
const configHash = `0x${'11'.repeat(32)}` as const;

const context = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'test-stack',
  factoryAddress: address('b'),
  quoteAsset,
  quoteDecimals: 6,
  deploymentStartBlock: 123n,
  addresses: {
    factory: address('b'),
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
    factory,
    positionManager,
    swapRouter: router,
    swapRouterKind: 'V3_SWAP_ROUTER_02',
    quoter,
    quoterKind: 'V3_QUOTER_V2',
  },
} satisfies ProtocolContext;

function launch(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  };
}

function graduation(phase: number, overrides: Record<string, unknown> = {}) {
  return {
    phase,
    sweptAt: 0,
    sweptUsdc: 0n,
    sweptTokens: 0n,
    poolTokenAmount: 0n,
    poolId: phase === 2 ? bytes32Address(pool) : `0x${'0'.repeat(64)}`,
    positionManager: phase === 2 ? positionManager : address('0'),
    positionId: phase === 2 ? 1n : 0n,
    ...overrides,
  };
}

function successfulV3Client() {
  const readContract = vi.fn(async (request: { address: Address; functionName: string }) => {
    if (request.address === context.addresses.factory && request.functionName === 'getLaunch') return launch();
    if (request.address === launchCoordinator && request.functionName === 'getGraduation') return graduation(2);
    if (request.address === launchAdapter && request.functionName === 'family') return 2;
    if (request.address === launchAdapter && request.functionName === 'coordinator') return launchCoordinator;
    if (request.address === launchAdapter && request.functionName === 'configHash') return configHash;
    if (request.address === launchAdapter && request.functionName === 'usdc') return quoteAsset;
    if (request.address === launchAdapter && request.functionName === 'positionManager') return positionManager;
    if (request.address === launchAdapter && request.functionName === 'v3Factory') return factory;
    if (request.address === launchAdapter && request.functionName === 'fee') return 3000;
    if (request.address === router && request.functionName === 'factory') return factory;
    if (request.address === quoter && request.functionName === 'factory') return factory;
    if (request.address === factory && request.functionName === 'getPool') return pool;
    if (request.address === pool && request.functionName === 'token0') return quoteAsset;
    if (request.address === pool && request.functionName === 'token1') return token;
    if (request.address === pool && request.functionName === 'fee') return 3000;
    if (request.address === pool && request.functionName === 'liquidity') return 1n;
    throw new Error(`unexpected read ${request.address} ${request.functionName}`);
  });
  return { readContract };
}

describe('Day 9 canonical post-graduation trade-route resolution', () => {
  it('keeps an active non-ready launch on its canonical curve', async () => {
    const sdk = await import('../../packages/protocol-sdk/src/index.ts');
    expect(sdk).toHaveProperty('resolveCanonicalTradeRoute');
    const resolve = (sdk as Record<string, unknown>).resolveCanonicalTradeRoute as
      | ((client: { readContract: (request: never) => Promise<unknown> }, context: ProtocolContext, token: Address) => Promise<unknown>)
      | undefined;

    const client = {
      readContract: vi.fn(async (request: { address: Address; functionName: string }) => {
        if (request.functionName === 'getLaunch') return launch();
        if (request.address === launchCoordinator && request.functionName === 'getGraduation') return graduation(0);
        if (request.address === curve && request.functionName === 'readyToGraduate') return false;
        throw new Error(`unexpected read ${request.address} ${request.functionName}`);
      }),
    };

    await expect(resolve?.(client as never, context, token)).resolves.toEqual({ kind: 'CURVE', curve });
  });

  it.each([
    [0, true, 'graduation is pending'],
    [1, undefined, 'graduation is pending'],
    [3, undefined, 'graduation is unavailable'],
  ] as const)('fails closed for non-tradable graduation phase %s', async (phase, ready, message) => {
    const sdk = await import('../../packages/protocol-sdk/src/index.ts');
    const resolve = (sdk as Record<string, unknown>).resolveCanonicalTradeRoute as
      | ((client: { readContract: (request: never) => Promise<unknown> }, context: ProtocolContext, token: Address) => Promise<unknown>)
      | undefined;
    const client = {
      readContract: vi.fn(async (request: { address: Address; functionName: string }) => {
        if (request.functionName === 'getLaunch') return launch();
        if (request.address === launchCoordinator && request.functionName === 'getGraduation') return graduation(phase);
        if (request.address === curve && request.functionName === 'readyToGraduate') return ready;
        throw new Error(`unexpected read ${request.address} ${request.functionName}`);
      }),
    };

    await expect(resolve?.(client as never, context, token)).rejects.toThrow(message);
  });

  it('rejects a POOL_CREATED launch that was not snapshotted to V3', async () => {
    const sdk = await import('../../packages/protocol-sdk/src/index.ts');
    const resolve = (sdk as Record<string, unknown>).resolveCanonicalTradeRoute as
      | ((client: { readContract: (request: never) => Promise<unknown> }, context: ProtocolContext, token: Address) => Promise<unknown>)
      | undefined;
    const client = {
      readContract: vi.fn(async (request: { address: Address; functionName: string }) => {
        if (request.functionName === 'getLaunch') return launch({ graduationAdapterFamily: 1 });
        if (request.address === launchCoordinator && request.functionName === 'getGraduation') return graduation(2);
        throw new Error(`unexpected read ${request.address} ${request.functionName}`);
      }),
    };

    await expect(resolve?.(client as never, context, token)).rejects.toThrow('graduated route is not UNISWAP_V3');
  });

  it.each([
    ['configHash', `0x${'99'.repeat(32)}`],
    ['usdc', address('9')],
    ['v3Factory', address('9')],
    ['positionManager', address('9')],
  ] as const)('rejects adapter %s mismatch', async (field, wrongValue) => {
    const sdk = await import('../../packages/protocol-sdk/src/index.ts');
    const resolve = (sdk as Record<string, unknown>).resolveCanonicalTradeRoute as
      | ((client: { readContract: (request: never) => Promise<unknown> }, context: ProtocolContext, token: Address) => Promise<unknown>)
      | undefined;
    const client = successfulV3Client();
    client.readContract.mockImplementation(async (request: { address: Address; functionName: string }) => {
      if (request.address === context.addresses.factory && request.functionName === 'getLaunch') return launch();
      if (request.address === launchCoordinator && request.functionName === 'getGraduation') return graduation(2);
      if (request.address === launchAdapter && request.functionName === 'family') return 2;
      if (request.address === launchAdapter && request.functionName === 'coordinator') return launchCoordinator;
      if (request.address === launchAdapter && request.functionName === field) return wrongValue;
      if (request.address === launchAdapter && request.functionName === 'configHash') return configHash;
      if (request.address === launchAdapter && request.functionName === 'usdc') return quoteAsset;
      if (request.address === launchAdapter && request.functionName === 'positionManager') return positionManager;
      if (request.address === launchAdapter && request.functionName === 'v3Factory') return factory;
      if (request.address === launchAdapter && request.functionName === 'fee') return 3000;
      throw new Error(`unexpected read ${request.address} ${request.functionName}`);
    });

    await expect(resolve?.(client as never, context, token)).rejects.toThrow('graduated adapter identity mismatch');
  });

  it.each([
    [router, 'swap router'],
    [quoter, 'quoter'],
  ] as const)('rejects a %s bound to another V3 factory', async (dependency, label) => {
    const sdk = await import('../../packages/protocol-sdk/src/index.ts');
    const resolve = (sdk as Record<string, unknown>).resolveCanonicalTradeRoute as
      | ((client: { readContract: (request: never) => Promise<unknown> }, context: ProtocolContext, token: Address) => Promise<unknown>)
      | undefined;
    const client = successfulV3Client();
    const base = client.readContract.getMockImplementation()!;
    client.readContract.mockImplementation(async (request: { address: Address; functionName: string }) => {
      if (request.address === dependency && request.functionName === 'factory') return address('f');
      return base(request);
    });

    await expect(resolve?.(client as never, context, token)).rejects.toThrow(`${label} factory mismatch`);
  });

  it('rejects coordinator pool identity mismatch and zero pool liquidity', async () => {
    const sdk = await import('../../packages/protocol-sdk/src/index.ts');
    const resolve = (sdk as Record<string, unknown>).resolveCanonicalTradeRoute as
      | ((client: { readContract: (request: never) => Promise<unknown> }, context: ProtocolContext, token: Address) => Promise<unknown>)
      | undefined;

    const wrongPoolClient = successfulV3Client();
    const wrongBase = wrongPoolClient.readContract.getMockImplementation()!;
    wrongPoolClient.readContract.mockImplementation(async (request: { address: Address; functionName: string }) => {
      if (request.address === factory && request.functionName === 'getPool') return address('f');
      return wrongBase(request);
    });
    await expect(resolve?.(wrongPoolClient as never, context, token)).rejects.toThrow('graduated pool identity mismatch');

    const zeroLiquidityClient = successfulV3Client();
    const zeroBase = zeroLiquidityClient.readContract.getMockImplementation()!;
    zeroLiquidityClient.readContract.mockImplementation(async (request: { address: Address; functionName: string }) => {
      if (request.address === pool && request.functionName === 'liquidity') return 0n;
      return zeroBase(request);
    });
    await expect(resolve?.(zeroLiquidityClient as never, context, token)).rejects.toThrow('graduated pool has no active liquidity');
  });

  it('returns the exact verified V3 pool route for a fully matching POOL_CREATED launch', async () => {
    const sdk = await import('../../packages/protocol-sdk/src/index.ts');
    const resolve = (sdk as Record<string, unknown>).resolveCanonicalTradeRoute as
      | ((client: { readContract: (request: never) => Promise<unknown> }, context: ProtocolContext, token: Address) => Promise<unknown>)
      | undefined;

    await expect(resolve?.(successfulV3Client() as never, context, token)).resolves.toEqual({
      kind: 'V3_POOL',
      token,
      quoteAsset,
      pool,
      fee: 3000,
      factory,
      positionManager,
      swapRouter: router,
      swapRouterKind: 'V3_SWAP_ROUTER_02',
      quoter,
      quoterKind: 'V3_QUOTER_V2',
    });
  });
});
