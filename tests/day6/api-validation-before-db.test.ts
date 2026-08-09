import { describe, expect, it, vi } from 'vitest';

import { ReadRepository, SearchRepository, type BreadDb } from '../../packages/db/src/index.js';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';

const address = (value: number) => `0x${value.toString(16).padStart(40, '0')}`;

const context: ProtocolContext = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'task9-validation-stack',
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

function inMemoryRedis() {
  const state = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => state.get(key) ?? null),
    set: vi.fn(async (key: string, value: string, options?: { NX?: boolean }) => {
      if (options?.NX && state.has(key)) return null;
      state.set(key, value);
      return 'OK';
    }),
    incr: vi.fn(async (key: string) => {
      const next = Number(state.get(key) ?? '0') + 1;
      state.set(key, String(next));
      return next;
    }),
    eval: vi.fn(async () => 1),
    pExpire: vi.fn(async () => true),
  };
}

describe('Day 6 Task 9 validation-before-DB contract', () => {
  it('rejects malformed search, token and feed inputs before any read repository call', async () => {
    const search = vi.spyOn(SearchRepository.prototype, 'searchLaunches');
    const getLaunch = vi.spyOn(ReadRepository.prototype, 'getLaunch');
    const listFeed = vi.spyOn(ReadRepository.prototype, 'listNewLaunches');
    const getCheckpoint = vi.spyOn(ReadRepository.prototype, 'getCheckpoint');
    const apiModule = await import('../../apps/api/src/server.js');
    const app = apiModule.createBreadApi({
      db: {} as BreadDb,
      context,
      observedHeadBlock: vi.fn(async () => {
        throw new Error('validation failure must not request observed head');
      }),
      redis: inMemoryRedis(),
      now: () => new Date('2026-08-09T18:00:00.000Z'),
      rateLimits: {
        feed: { maxRequests: 100, windowMs: 1_000 },
        search: { maxRequests: 100, windowMs: 1_000 },
      },
    });

    const responses = await Promise.all([
      app.inject({ method: 'GET', url: '/v1/search?q=a' }),
      app.inject({ method: 'GET', url: `/v1/search?q=${'x'.repeat(257)}` }),
      app.inject({ method: 'GET', url: '/v1/search?q=br&limit=9999' }),
      app.inject({ method: 'GET', url: '/v1/search?q=0x1234' }),
      app.inject({ method: 'GET', url: '/v1/tokens/not-an-address' }),
      app.inject({ method: 'GET', url: '/v1/feed?view=new&cursor=not-a-cursor' }),
      app.inject({ method: 'GET', url: '/v1/feed?view=new&limit=9999' }),
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([400, 400, 400, 400, 400, 400, 400]);
    expect(search).not.toHaveBeenCalled();
    expect(getLaunch).not.toHaveBeenCalled();
    expect(listFeed).not.toHaveBeenCalled();
    expect(getCheckpoint).not.toHaveBeenCalled();

    await app.close();
  });
});
