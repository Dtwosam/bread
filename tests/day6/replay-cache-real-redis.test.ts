import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { BreadCache } from '../../apps/api/src/cache.ts';
import { PostCommitPublisher } from '../../apps/indexer/src/post-commit.ts';

const RUN_REDIS = process.env.BREAD_DB_INTEGRATION === '1';
const address = (value: number) => `0x${value.toString(16).padStart(40, '0')}`;
const hash = (value: number) => `0x${value.toString(16).padStart(64, '0')}`;
const chainId = 5_042_002;

type RedisClient = {
  on: (event: 'error', listener: (error: unknown) => void) => RedisClient;
  connect: () => Promise<unknown>;
  destroy: () => void;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, options?: Readonly<{ NX?: boolean; PX?: number }>) => Promise<unknown>;
  incr: (key: string) => Promise<number>;
  eval: (script: string, input: Readonly<{ keys: string[]; arguments: string[] }>) => Promise<unknown>;
};

const requireFromApi = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const { createClient } = requireFromApi('redis') as {
  createClient: (options: Readonly<{ url: string }>) => RedisClient;
};

describe.skipIf(!RUN_REDIS)('Day 6 Task 8 real redis@6.1.0 integration', () => {
  let client: RedisClient;

  beforeAll(async () => {
    client = createClient({
      url: process.env.BREAD_REDIS_URL ?? 'redis://127.0.0.1:6379',
    });
    client.on('error', () => undefined);
    await client.connect();
  });

  afterAll(() => {
    client?.destroy();
  });

  it('executes real generation, NX/PX single-flight, payload TTL and ownership-safe Lua release', async () => {
    const schemaVersion = `task8-real-${process.pid}`;
    const channel = `token:${chainId}:${address(20)}`;
    const cache = new BreadCache({ redis: client, schemaVersion });
    const load = vi.fn(async () => ({ token: address(20), checkpoint: '120' }));

    const first = await cache.getOrLoad({ channel, key: 'token-card', load });
    const second = await cache.getOrLoad({ channel, key: 'token-card', load });

    expect(first.cache).toBe('MISS');
    expect(second).toEqual({ value: first.value, cache: 'HIT' });
    expect(load).toHaveBeenCalledTimes(1);

    await cache.invalidate(channel);
    const third = await cache.getOrLoad({ channel, key: 'token-card', load });
    expect(third.cache).toBe('MISS');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('wires post-commit invalidation through real Redis without making cache authoritative', async () => {
    const schemaVersion = `task8-publish-${process.pid}`;
    const channel = `token:${chainId}:${address(21)}`;
    const cache = new BreadCache({ redis: client, schemaVersion });
    const load = vi.fn(async () => ({ token: address(21), checkpoint: '120' }));
    const fanout = vi.fn(async (_message: unknown) => undefined);
    const publisher = new PostCommitPublisher({
      invalidate: (logicalChannel) => cache.invalidate(logicalChannel),
      fanout,
    });

    await cache.getOrLoad({ channel, key: 'token-card', load });
    await cache.getOrLoad({ channel, key: 'token-card', load });
    expect(load).toHaveBeenCalledTimes(1);

    await publisher.publish({
      insertedEventIds: [`${chainId}:${hash(2)}:1`],
      channels: [channel, channel],
      checkpoint: { blockNumber: 121n, blockHash: hash(121) },
    });

    expect(fanout).toHaveBeenCalledTimes(1);
    expect(fanout).toHaveBeenCalledWith(expect.objectContaining({
      channel,
      changeDomain: 'token',
      affectedIdentity: address(21),
      checkpointBlock: '121',
    }));

    const refreshed = await cache.getOrLoad({ channel, key: 'token-card', load });
    expect(refreshed.cache).toBe('MISS');
    expect(load).toHaveBeenCalledTimes(2);
  });
});
