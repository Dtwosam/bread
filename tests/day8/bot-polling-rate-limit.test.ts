import { describe, expect, it, vi } from 'vitest';

import { IsolatedRateLimiter } from '../../apps/api/src/rate-limit.ts';

function inMemoryRateRedis() {
  const state = new Map<string, number>();
  return {
    incr: vi.fn(async (key: string) => {
      const next = (state.get(key) ?? 0) + 1;
      state.set(key, next);
      return next;
    }),
    pExpire: vi.fn(async () => true),
  };
}

describe('Day 8 06I bot-polling pressure', () => {
  it('bounds a 1,000-request search burst without consuming the feed bucket', async () => {
    const redis = inMemoryRateRedis();
    const limiter = new IsolatedRateLimiter({
      redis,
      policies: {
        search: { maxRequests: 30, windowMs: 10_000 },
        feed: { maxRequests: 500, windowMs: 10_000 },
      },
      nowMs: () => 123_000,
    });

    const results = await Promise.all(
      Array.from({ length: 1_000 }, () => limiter.take('search', '203.0.113.10')),
    );

    expect(results.filter((result) => result === 'ALLOWED')).toHaveLength(30);
    expect(results.filter((result) => result === 'LIMITED')).toHaveLength(970);
    expect(results).not.toContain('UNAVAILABLE');

    await expect(limiter.take('feed', '203.0.113.10')).resolves.toBe('ALLOWED');
    expect(redis.incr).toHaveBeenCalledTimes(1_001);
    expect(redis.pExpire).toHaveBeenCalledTimes(2);
  });

  it('fails explicitly when the shared limiter store is unavailable', async () => {
    const unavailableRedis = {
      incr: vi.fn(async () => { throw new Error('redis unavailable'); }),
      pExpire: vi.fn(async () => true),
    };
    const limiter = new IsolatedRateLimiter({
      redis: unavailableRedis,
      policies: {
        search: { maxRequests: 30, windowMs: 10_000 },
        feed: { maxRequests: 500, windowMs: 10_000 },
      },
      nowMs: () => 123_000,
    });

    await expect(limiter.take('search', '203.0.113.10')).resolves.toBe('UNAVAILABLE');
    expect(unavailableRedis.pExpire).not.toHaveBeenCalled();
  });
});
