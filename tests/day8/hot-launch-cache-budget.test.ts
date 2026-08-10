import { describe, expect, it } from 'vitest';

import { PUBLIC_PROJECTION_CACHE_CONTROL } from '../../apps/api/src/http-cache.js';
import {
  maxOriginFetchesForBurst,
  sharedCacheTtlMs,
} from '../../scripts/load/day8-cache-budget.js';

describe('Day 8 hot-launch cache refresh budget', () => {
  it('derives the cache TTL from the authoritative public projection policy', () => {
    expect(sharedCacheTtlMs(PUBLIC_PROJECTION_CACHE_CONTROL)).toBe(1_000);
  });

  it('allows one boundary epoch beyond the configured arrival window per edge', () => {
    expect(maxOriginFetchesForBurst({
      frontends: 4,
      arrivalWindowMs: 2_000,
      cacheTtlMs: 1_000,
    })).toBe(12);
  });

  it('keeps the budget independent of viewer count', () => {
    const budget = maxOriginFetchesForBurst({
      frontends: 4,
      arrivalWindowMs: 2_000,
      cacheTtlMs: 1_000,
    });

    expect(budget).toBeLessThan(100);
    expect(budget / 10_000).toBeLessThan(0.01);
  });
});
