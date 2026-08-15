import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { BreadApiRequestError } from '../../apps/web/lib/api/client';
import {
  feedErrorPresentation,
  resolveExploreView,
  searchIntent,
  toTokenCardModel,
} from '../../apps/web/components/explore/model';

const VALID_ADDRESS = `0x${'12'.repeat(20)}`;

describe('Day 7 Explore/Search interaction contract', () => {
  it('keeps Explore view selection inside the frozen query-param model', () => {
    expect(resolveExploreView(undefined)).toBe('new');
    expect(resolveExploreView('new')).toBe('new');
    expect(resolveExploreView('trending')).toBe('trending');
    expect(resolveExploreView('graduating')).toBe('graduating');
    expect(resolveExploreView('graduated')).toBe('graduated');
    expect(resolveExploreView('invented')).toBe('new');
  });

  it('uses the ratified v2.2 discovery labels without changing indexed feed semantics', () => {
    const source = readFileSync(
      new URL('../../apps/web/components/explore/explore-client.tsx', import.meta.url),
      'utf8',
    );

    expect(source).toContain("{ value: 'new', label: 'New' }");
    expect(source).toContain("{ value: 'trending', label: 'Trending' }");
    expect(source).toContain("{ value: 'graduating', label: 'Almost Baked' }");
    expect(source).toContain("{ value: 'graduated', label: 'Graduated' }");
    expect(source).not.toContain("label: 'Near Graduation'");
  });

  it('starts exact-address search immediately but waits for two text characters', () => {
    expect(searchIntent('')).toEqual({ kind: 'idle' });
    expect(searchIntent('b')).toEqual({ kind: 'idle' });
    expect(searchIntent('br')).toEqual({ kind: 'search', query: 'br' });
    expect(searchIntent(VALID_ADDRESS)).toEqual({ kind: 'search', query: VALID_ADDRESS.toLowerCase() });
    expect(searchIntent('0x1234')).toEqual({ kind: 'invalid-address' });
  });

  it('turns unsupported deterministic feed views into an explicit not-ready state', () => {
    const error = new BreadApiRequestError(503, {
      code: 'FEED_VIEW_NOT_READY',
      message: 'This deterministic feed projection is not available yet.',
      requestId: 'req-feed',
    });

    expect(feedErrorPresentation(error)).toEqual({
      kind: 'not-ready',
      title: 'This feed view is not ready yet',
      detail: 'Bread will not fabricate rankings while this indexed projection is unavailable.',
    });
    expect(feedErrorPresentation(new Error('network'))).toEqual({
      kind: 'error',
      title: 'Explore data is unavailable',
      detail: 'Try again when the indexed read service is available.',
    });
  });

  it('builds TokenCard presentation only from indexed feed fields', () => {
    expect(
      toTokenCardModel({
        tokenAddress: VALID_ADDRESS,
        name: 'Bread',
        symbol: 'BRD',
        metrics: {
          lastPrice: { numerator: '1250000', denominator: '1000000', source: 'TRADE_EXECUTION' },
          quoteVolume: { m5: '1000000', h1: '2000000', h24: '5000000' },
          tradeCount: { h1: '3', h24: '9' },
          uniqueTraders: { h1: '2', h24: '5' },
        },
        progress: { progressBps: '6250', state: 'CURVE_ACTIVE' },
      }),
    ).toEqual({
      tokenAddress: VALID_ADDRESS,
      name: 'Bread',
      symbol: 'BRD',
      price: { numerator: '1250000', denominator: '1000000', source: 'TRADE_EXECUTION' },
      volume24h: '5000000',
      priceChange24h: null,
      progress: { bps: 6250, percent: 62.5, state: 'CURVE_ACTIVE' },
    });
  });

  it('keeps Explore/Search rendering free of per-card API or raw-RPC fanout', () => {
    for (const path of [
      '../../apps/web/components/token-card.tsx',
      '../../apps/web/components/search-surface.tsx',
      '../../apps/web/components/explore/explore-client.tsx',
    ]) {
      const source = readFileSync(new URL(path, import.meta.url), 'utf8');
      expect(source).not.toMatch(/from ['"]viem['"]/);
      expect(source).not.toMatch(/from ['"]wagmi['"]/);
      expect(source).not.toMatch(/createPublicClient|getToken\s*\(|eth_call/);
    }
  });
});
