import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReadRepository, type BreadDb } from '../../packages/db/src/index.js';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';
import {
  NO_STORE_CACHE_CONTROL,
  PUBLIC_PROJECTION_CACHE_CONTROL,
} from '../../apps/api/src/http-cache.js';

const address = (value: number) => `0x${value.toString(16).padStart(40, '0')}`;
const hash = (value: number) => `0x${value.toString(16).padStart(64, '0')}`;
const tokenAddress = address(10);

const context: ProtocolContext = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'day8-edge-policy-test',
  factoryAddress: address(1),
  quoteAsset: address(2),
  quoteDecimals: 6,
  deploymentStartBlock: 100n,
  addresses: {
    factory: address(1),
    deployer: address(3),
    feePolicy: address(4),
    feeEscrow: address(5),
    emergencyController: address(6),
    locker: address(7),
    coordinator: address(8),
    graduationAdapter: address(9),
  },
};

const checkpoint = {
  chainId: context.chainId,
  stackVersion: context.stackVersion,
  factoryAddress: context.factoryAddress,
  deploymentStartBlock: 100n,
  indexedThroughBlock: 120n,
  indexedThroughBlockHash: hash(120),
  indexedThroughBlockTimestamp: 1_786_262_400n,
  decoderSchemaVersion: 'day6-v1',
  status: 'COMMITTED',
};

const launch = {
  tokenAddress,
  curveAddress: address(20),
  stackVersion: context.stackVersion,
  factoryAddress: context.factoryAddress,
  deployerAddress: address(3),
  creatorFeeRecipient: address(30),
  creatorTaxBps: 100n,
  economicsDigest: hash(1),
  configVersion: 1n,
  launchTimestamp: 1_786_262_400n,
  name: 'Hot Bread',
  symbol: 'HOT',
  metadata: null,
  quoteAsset: context.quoteAsset,
  initialSupply: 1_000_000n,
  phantomQuote: 100n,
  graduationThreshold: 500n,
  protocolFeeRecipient: address(31),
  tradeFeeBps: 100n,
  protocolFeeShareBps: 5_000n,
  maxCreatorTaxBps: 1_000n,
  graduationCoordinator: address(8),
  graduationAdapter: address(9),
  graduationAdapterFamily: 'TEST_ONLY',
  graduationConfigHash: hash(2),
  reservedTokensBaseline: 100n,
  launchBlockNumber: 120n,
  launchTransactionHash: hash(120),
  launchLogIndex: 1,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Day 8 API edge-cache policy', () => {
  it('makes successful hot public projections shared-cacheable while status remains no-store', async () => {
    vi.spyOn(ReadRepository.prototype, 'getCheckpoint').mockResolvedValue(checkpoint as never);
    vi.spyOn(ReadRepository.prototype, 'getLaunch').mockResolvedValue(launch as never);
    vi.spyOn(ReadRepository.prototype, 'getLaunchState').mockResolvedValue(null);
    vi.spyOn(ReadRepository.prototype, 'getTokenMetrics').mockResolvedValue(null);
    vi.spyOn(ReadRepository.prototype, 'listNewLaunches').mockResolvedValue([]);
    vi.spyOn(ReadRepository.prototype, 'listTokenMetrics').mockResolvedValue([]);

    const { createBreadApi } = await import('../../apps/api/src/server.js');
    const app = createBreadApi({
      db: {} as BreadDb,
      context,
      observedHeadBlock: vi.fn(async () => 120n),
      now: () => new Date('2026-08-10T18:00:00.000Z'),
    });

    const [token, feed, status] = await Promise.all([
      app.inject({ method: 'GET', url: `/v1/tokens/${tokenAddress}` }),
      app.inject({ method: 'GET', url: '/v1/feed?view=new&limit=1' }),
      app.inject({ method: 'GET', url: '/v1/status' }),
    ]);

    expect(token.statusCode).toBe(200);
    expect(feed.statusCode).toBe(200);
    expect(status.statusCode).toBe(200);
    expect(token.headers['cache-control']).toBe(PUBLIC_PROJECTION_CACHE_CONTROL);
    expect(feed.headers['cache-control']).toBe(PUBLIC_PROJECTION_CACHE_CONTROL);
    expect(status.headers['cache-control']).toBe(NO_STORE_CACHE_CONTROL);

    await app.close();
  });

  it('keeps malformed, missing, and unsupported read responses out of shared caches', async () => {
    vi.spyOn(ReadRepository.prototype, 'getCheckpoint').mockResolvedValue(checkpoint as never);
    vi.spyOn(ReadRepository.prototype, 'getLaunch').mockResolvedValue(null);

    const { createBreadApi } = await import('../../apps/api/src/server.js');
    const app = createBreadApi({
      db: {} as BreadDb,
      context,
      observedHeadBlock: vi.fn(async () => 120n),
      now: () => new Date('2026-08-10T18:00:00.000Z'),
    });

    const [malformed, missing, unsupportedFeed] = await Promise.all([
      app.inject({ method: 'GET', url: '/v1/tokens/not-an-address' }),
      app.inject({ method: 'GET', url: `/v1/tokens/${address(99)}` }),
      app.inject({ method: 'GET', url: '/v1/feed?view=trending&limit=1' }),
    ]);

    expect(malformed.statusCode).toBe(400);
    expect(missing.statusCode).toBe(404);
    expect(unsupportedFeed.statusCode).toBe(503);
    expect(malformed.headers['cache-control']).toBe(NO_STORE_CACHE_CONTROL);
    expect(missing.headers['cache-control']).toBe(NO_STORE_CACHE_CONTROL);
    expect(unsupportedFeed.headers['cache-control']).toBe(NO_STORE_CACHE_CONTROL);

    await app.close();
  });
});
