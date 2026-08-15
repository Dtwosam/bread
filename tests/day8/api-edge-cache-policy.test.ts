import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Address } from '../../packages/types/src/index.js';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';
import type { BreadDb } from '../../packages/db/src/client.js';
import { ReadRepository } from '../../packages/db/src/repositories/read.js';
import { SearchRepository } from '../../packages/db/src/repositories/search.js';

const address = (value: number) => `0x${value.toString(16).padStart(40, '0')}` as Address;
const factory = address(1);
const tokenAddress = address(2);
const curveAddress = address(3);
const context: ProtocolContext = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'day8-edge-cache-test',
  factoryAddress: factory,
  quoteAsset: address(4),
  quoteDecimals: 6,
  deploymentStartBlock: 100n,
  addresses: {
    factory,
    deployer: address(5),
    feePolicy: address(6),
    feeEscrow: address(7),
    emergencyController: address(8),
    locker: address(9),
    coordinator: address(10),
    graduationAdapter: address(11),
  },
};

const checkpoint = {
  chainId: context.chainId,
  stackVersion: context.stackVersion,
  factoryAddress: factory,
  deploymentStartBlock: 100n,
  indexedThroughBlock: 110n,
  indexedThroughBlockHash: `0x${'11'.repeat(32)}`,
  indexedThroughBlockTimestamp: 1_786_348_800n,
  lastTransactionHash: null,
  lastLogIndex: null,
  decoderSchemaVersion: 'day6-v1',
  status: 'COMMITTED',
  appliedAt: new Date('2026-08-10T18:00:00.000Z'),
  updatedAt: new Date('2026-08-10T18:00:00.000Z'),
} as const;

const launch = {
  chainId: context.chainId,
  tokenAddress,
  curveAddress,
  stackVersion: context.stackVersion,
  factoryAddress: factory,
  deployerAddress: address(12),
  creatorFeeRecipient: address(13),
  creatorTaxBps: 100n,
  economicsDigest: `0x${'22'.repeat(32)}`,
  configVersion: 1n,
  launchTimestamp: 1_786_348_700n,
  name: 'Edge Bread',
  symbol: 'EDGE',
  metadata: {},
  quoteAsset: context.quoteAsset,
  initialSupply: 1_000n,
  phantomQuote: 10n,
  graduationThreshold: 500n,
  protocolFeeRecipient: address(14),
  tradeFeeBps: 100n,
  protocolFeeShareBps: 5_000n,
  maxCreatorTaxBps: 500n,
  graduationCoordinator: context.addresses.coordinator,
  graduationAdapter: context.addresses.graduationAdapter,
  graduationAdapterFamily: null,
  graduationConfigHash: null,
  reservedTokensBaseline: 100n,
  launchBlockNumber: 105n,
  launchTransactionHash: `0x${'33'.repeat(32)}`,
  launchLogIndex: 1,
  createdAt: new Date('2026-08-10T18:00:00.000Z'),
} as const;

const PUBLIC_PROJECTION_CACHE_CONTROL = 'public, max-age=2, s-maxage=2, stale-while-revalidate=8';
const NO_STORE_CACHE_CONTROL = 'no-store, max-age=0';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Day 8 API edge-cache policy', () => {
  it('makes successful hot public projections shared-cacheable while status remains no-store', async () => {
    vi.spyOn(ReadRepository.prototype, 'getCheckpoint').mockResolvedValue(checkpoint as never);
    vi.spyOn(ReadRepository.prototype, 'getLaunch').mockResolvedValue(launch as never);
    vi.spyOn(ReadRepository.prototype, 'getLaunchState').mockResolvedValue(undefined);
    vi.spyOn(ReadRepository.prototype, 'getTokenMetrics').mockResolvedValue(undefined);
    vi.spyOn(ReadRepository.prototype, 'listNewLaunches').mockResolvedValue([launch] as never);
    vi.spyOn(ReadRepository.prototype, 'listTokenMetrics').mockResolvedValue([]);
    vi.spyOn(ReadRepository.prototype, 'listLaunchStates').mockResolvedValue([]);
    vi.spyOn(SearchRepository.prototype, 'searchLaunches').mockResolvedValue([]);

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
      app.inject({ method: 'GET', url: '/v1/feed?view=graduating&limit=1' }),
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
