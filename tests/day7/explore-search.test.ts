import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { BreadApiRequestError } from '../../apps/web/lib/api/client';
import {
  feedErrorPresentation,
  resolveExploreView,
  searchIntent,
  toTokenCardModel,
  type IndexedFeedCardFields,
} from '../../apps/web/components/explore/model';

const VALID_ADDRESS = `0x${'12'.repeat(20)}`;
const CREATOR_ADDRESS = `0x${'34'.repeat(20)}`;

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
        deployerAddress: CREATOR_ADDRESS,
        holderCount: '42',
        graduatedVenueKind: null,
        name: 'Bread',
        symbol: 'BRD',
        metrics: {
          lastPrice: { numerator: '1250000', denominator: '1000000', source: 'TRADE_EXECUTION' },
          quoteVolume: { m5: '1000000', h1: '2000000', h24: '5000000' },
          tradeCount: { h1: '3', h24: '9' },
          uniqueTraders: { h1: '2', h24: '5' },
        },
        progress: { progressBps: '6250', state: 'CURVE_ACTIVE' },
      } as IndexedFeedCardFields),
    ).toEqual({
      tokenAddress: VALID_ADDRESS,
      creatorAddress: CREATOR_ADDRESS,
      name: 'Bread',
      symbol: 'BRD',
      price: { numerator: '1250000', denominator: '1000000', source: 'TRADE_EXECUTION' },
      volume24h: '5000000',
      holderCount: '42',
      graduatedVenueKind: null,
      priceChange24h: null,
      progress: { bps: 6250, percent: 62.5, state: 'CURVE_ACTIVE' },
    });
  });

  it('keeps canonical holder count available before a token has trade metrics', () => {
    const model = toTokenCardModel({
      tokenAddress: VALID_ADDRESS,
      deployerAddress: CREATOR_ADDRESS,
      holderCount: '1',
      graduatedVenueKind: null,
      name: 'Fresh Bread',
      symbol: 'FRESH',
      metrics: null,
      progress: { progressBps: '0', state: 'CURVE_ACTIVE' },
    } as IndexedFeedCardFields);

    expect(model.holderCount).toBe('1');
    expect(model.price).toBeNull();
  });

  it('wires canonical holder count independently from trade metrics through feed and token DTOs', () => {
    const typeSource = readFileSync(new URL('../../packages/types/src/api.ts', import.meta.url), 'utf8');
    const feedRouteSource = readFileSync(new URL('../../apps/api/src/routes/feed.ts', import.meta.url), 'utf8');
    const tokenRouteSource = readFileSync(new URL('../../apps/api/src/routes/token.ts', import.meta.url), 'utf8');
    const metricType = typeSource.match(
      /export type IndexedTradeMetricsSummary = Readonly<\{([\s\S]*?)\n\}>;/,
    )?.[1];

    expect(typeSource).toMatch(
      /export type IndexedFeedItem = Readonly<\{[\s\S]*?holderCount: string \| null;[\s\S]*?metrics:/,
    );
    expect(metricType).not.toContain('holderCount');
    expect(feedRouteSource).toContain('holderCount: metricRow?.holderCount?.toString(10) ?? null');
    expect(tokenRouteSource).toContain('holderCount: metrics?.holderCount?.toString(10) ?? null');
  });

  it('batch-loads canonical graduated venue state for feed cards without per-card state reads', () => {
    const typeSource = readFileSync(new URL('../../packages/types/src/api.ts', import.meta.url), 'utf8');
    const readSource = readFileSync(new URL('../../packages/db/src/repositories/read.ts', import.meta.url), 'utf8');
    const feedRouteSource = readFileSync(new URL('../../apps/api/src/routes/feed.ts', import.meta.url), 'utf8');

    expect(typeSource).toContain('graduatedVenueKind: string | null;');
    expect(readSource).toContain('async listLaunchStates(chainId: number, tokenAddresses: readonly string[])');
    expect(feedRouteSource).toContain('listLaunchStates(');
    expect(feedRouteSource).not.toContain('getLaunchState(');
    expect(feedRouteSource).toContain('graduatedVenueKind: stateRow?.graduatedVenueKind ?? null');
  });

  it('renders the authoritative indexed creator wallet directly below TokenCard identity', () => {
    const source = readFileSync(new URL('../../apps/web/components/token-card.tsx', import.meta.url), 'utf8');
    expect(source).toContain('CreatorAttribution');
    expect(source).toContain('creatorAddress={model.creatorAddress}');
    expect(source).not.toContain('creatorAddress={item.creatorFeeRecipient}');
  });

  it('uses the v2.2 decision-data hierarchy without fabricating unavailable market data', () => {
    const source = readFileSync(new URL('../../apps/web/components/token-card.tsx', import.meta.url), 'utf8');
    expect(source).toContain('<dt>Market cap</dt>');
    expect(source).toContain('<dt>24h change</dt>');
    expect(source).toContain('<dt>24h volume</dt>');
    expect(source).toContain('<dt>Holders</dt>');
    expect(source).toContain("{model.holderCount ?? '—'}");
    expect(source).not.toContain('Indexed price ratio');
  });

  it('replaces the baked bar with canonical venue state for graduated cards', () => {
    const source = readFileSync(new URL('../../apps/web/components/token-card.tsx', import.meta.url), 'utf8');
    expect(source).toContain("model.progress?.state === 'GRADUATED'");
    expect(source).toContain('Graduated');
    expect(source).toContain("UNISWAP_V3: 'Uniswap V3'");
    expect(source).toContain('bread-token-card__graduated');
  });

  it('uses the v2.2 five-pixel brand-butter baked-progress treatment without shrinking shared progress', () => {
    const source = readFileSync(new URL('../../apps/web/app/globals.css', import.meta.url), 'utf8');
    expect(source).toMatch(
      /\.bread-token-card\s+\.bread-progress-track\s*\{[^}]*height:\s*5px;/s,
    );
    expect(source).toMatch(
      /\.bread-progress-value\s*\{[^}]*background:\s*var\(--bread-brand-butter\);/s,
    );
  });

  it('uses the exact v2.2 TokenCard name typography across desktop and mobile', () => {
    const source = readFileSync(new URL('../../apps/web/app/globals.css', import.meta.url), 'utf8');
    expect(source).toMatch(
      /\.bread-token-card__identity strong\s*\{[^}]*font-size:\s*15px;[^}]*line-height:\s*20px;[^}]*font-weight:\s*600;/s,
    );
    expect(source).toMatch(
      /@media \(max-width:\s*767px\)[\s\S]*?\.bread-token-card__identity strong\s*\{[^}]*font-size:\s*16px;/s,
    );
  });

  it('keeps TokenCard hover restrained and suppresses card motion for reduced-motion users', () => {
    const source = readFileSync(new URL('../../apps/web/app/globals.css', import.meta.url), 'utf8');
    expect(source).toMatch(
      /\.bread-token-card:hover\s*\{[^}]*transform:\s*translateY\(-1px\);/s,
    );
    expect(source).not.toMatch(/\.bread-token-card:hover\s*\{[^}]*scale\s*\(/s);
    expect(source).toMatch(
      /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.bread-token-card:hover,\s*\.bread-token-card:active\s*\{[^}]*transform:\s*none;/s,
    );
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
