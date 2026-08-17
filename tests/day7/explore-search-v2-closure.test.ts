import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { resolveIndexedLifecycleState } from '../../packages/db/src/repositories/lifecycle';
import { formatIndexedAge } from '../../apps/web/components/explore/model';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('Bread UI/UX v2.2 Explore/Search source-constrained closure', () => {
  it('formats TokenCard age only from the launch timestamp and committed indexed-head timestamp', () => {
    expect(formatIndexedAge('1700000000', '1700000120')).toBe('2m');
    expect(formatIndexedAge('1700000000', '1700003600')).toBe('1h');
    expect(formatIndexedAge('1700000000', '1700086400')).toBe('1d');
    expect(formatIndexedAge('1700000120', '1700000000')).toBe('<1m');
    expect(formatIndexedAge(null, '1700000120')).toBe('—');
    expect(formatIndexedAge('invalid', '1700000120')).toBe('—');
  });

  it('reserves the exact v2.2 TokenCard image slot and keeps age in the identity cluster', () => {
    const card = read('../../apps/web/components/token-card.tsx');
    const client = read('../../apps/web/components/explore/explore-client.tsx');
    const css = read('../../apps/web/app/explore-search-v2.css');
    const layout = read('../../apps/web/app/layout.tsx');

    expect(card).toContain('bread-token-card__image');
    expect(card).toContain('indexedThroughBlockTimestamp');
    expect(card).toContain('formatIndexedAge');
    expect(client).toContain('indexedThroughBlockTimestamp={latestMeta?.indexedThroughBlockTimestamp ?? null}');
    expect(layout).toContain("import './explore-search-v2.css';");
    expect(css).toMatch(/\.bread-token-card__image\s*\{[^}]*width:\s*48px;[^}]*height:\s*48px;/s);
    expect(css).toMatch(/@media \(max-width:\s*767px\)[\s\S]*?\.bread-token-card__image\s*\{[^}]*width:\s*52px;[^}]*height:\s*52px;/s);
  });

  it('renders the canonical indexed market-cap value in TokenCard and Search without a frontend formula', () => {
    const card = read('../../apps/web/components/token-card.tsx');
    const search = read('../../apps/web/components/search-surface.tsx');
    const model = read('../../apps/web/components/explore/model.ts');
    const apiTypes = read('../../packages/types/src/api.ts');

    expect(model).toContain('marketCap: source.metrics?.marketCap ?? null');
    expect(card).toContain('formatUsdcBaseUnits(model.marketCap)');
    expect(search).toContain('formatUsdcBaseUnits(result.marketCap)');
    expect(apiTypes).toContain('marketCap: string | null;');
    expect(`${card}\n${search}\n${model}`).not.toMatch(/marketCap\s*=.*(?:price|supply)|(?:price|supply).*\*.*(?:supply|price)/i);
  });

  it('wires ratified explicit sorts and indexed market-cap filters without inventing a Trending sort', () => {
    const explore = read('../../apps/web/components/explore/explore-client.tsx');
    const apiClient = read('../../apps/web/lib/api/client.ts');

    expect(apiClient).toContain("export type FeedSort = 'newest' | 'market-cap' | 'volume-24h' | 'holders' | 'baked-progress';");
    expect(apiClient).toContain('sort?: FeedSort;');
    expect(apiClient).toContain('marketCapMinQuote?: string;');
    expect(apiClient).toContain('marketCapMaxQuote?: string;');
    expect(explore).toContain("{ value: 'newest', label: 'Newest ↓' }");
    expect(explore).toContain("{ value: 'market-cap', label: 'Market Cap ↓' }");
    expect(explore).toContain("{ value: 'volume-24h', label: '24h Volume ↓' }");
    expect(explore).toContain("{ value: 'holders', label: 'Holders ↓' }");
    expect(explore).toContain("{ value: 'baked-progress', label: 'Baked Progress ↓' }");
    expect(explore).not.toContain("{ value: 'trending', label: 'Trending ↓' }");
    expect(explore).toContain('Market cap min');
    expect(explore).toContain('Market cap max');
    expect(explore).toContain('marketCapMinQuote');
    expect(explore).toContain('marketCapMaxQuote');
  });

  it('uses one canonical indexed lifecycle authority with exact precedence across Feed, Search and Token', () => {
    const apiTypes = read('../../packages/types/src/api.ts');
    const dbIndex = read('../../packages/db/src/index.ts');
    const searchRepository = read('../../packages/db/src/repositories/search.ts');
    const feedRoute = read('../../apps/api/src/routes/feed.ts');
    const tokenRoute = read('../../apps/api/src/routes/token.ts');
    const model = read('../../apps/web/components/explore/model.ts');
    const card = read('../../apps/web/components/token-card.tsx');
    const search = read('../../apps/web/components/search-surface.tsx');

    expect(apiTypes).toContain('export type IndexedLifecycleState =');
    for (const state of ['GRADUATED', 'GRADUATION_PENDING', 'PROCESSING', 'ALMOST_BAKED', 'NEW', 'ACTIVE']) {
      expect(apiTypes).toContain(`"${state}"`);
    }
    expect(dbIndex).toContain('indexedLifecycleStateSql');
    expect(searchRepository).toContain('indexedLifecycleStateSql');
    expect(searchRepository).not.toContain("WHEN s.graduation_phase = 'POOL_CREATED'");
    expect(feedRoute).toContain('lifecycleState: serializeLifecycleState(launch, stateRow, metricRow)');
    expect(tokenRoute).toContain('lifecycleState: serializeLifecycleState(launch, state, metrics)');
    expect(model).toContain("if (state === 'PROCESSING') return 'Graduating';");
    expect(`${card}\n${search}`).not.toMatch(/(?:age|progress|percent)[^\n]{0,100}(?:>=|>)[^\n]{0,100}(?:ALMOST_BAKED|NEW)/i);

    const overlap = {
      graduationPhase: 'POOL_CREATED',
      readyToGraduate: true,
      graduationFailureReasonHash: 'retry',
      mode: 'ACTIVE',
      graduationProgressBps: '9999',
      launchTimestamp: '100',
      initialSupply: '1000',
    } as const;
    expect(resolveIndexedLifecycleState(overlap)).toBe('GRADUATED');
    expect(resolveIndexedLifecycleState({ ...overlap, graduationPhase: 'NOT_GRADUATED' })).toBe('GRADUATION_PENDING');
    expect(resolveIndexedLifecycleState({ ...overlap, graduationPhase: 'SWEPT', graduationFailureReasonHash: null })).toBe('PROCESSING');
    expect(resolveIndexedLifecycleState({ ...overlap, graduationPhase: 'NOT_GRADUATED', readyToGraduate: false, graduationFailureReasonHash: null })).toBe('ALMOST_BAKED');
    expect(resolveIndexedLifecycleState({ ...overlap, graduationPhase: 'NOT_GRADUATED', readyToGraduate: false, graduationFailureReasonHash: null, graduationProgressBps: null })).toBe('NEW');
    expect(resolveIndexedLifecycleState({ ...overlap, graduationPhase: null, readyToGraduate: false, graduationFailureReasonHash: null, graduationProgressBps: null, launchTimestamp: null, initialSupply: null })).toBe('ACTIVE');
  });

  it('requires canonical lifecycle filtering and keeps retry-pending inside Processing without relabeling it', async () => {
    const lifecycleModule = await import('../../packages/db/src/repositories/lifecycle');
    const filterMatches = (lifecycleModule as Record<string, unknown>).matchesIndexedLifecycleFilter;
    expect(typeof filterMatches).toBe('function');
    if (typeof filterMatches !== 'function') return;

    const matches = filterMatches as (state: string | null, filter: string) => boolean;
    expect(matches('PROCESSING', 'processing')).toBe(true);
    expect(matches('GRADUATION_PENDING', 'processing')).toBe(true);
    expect(matches('GRADUATED', 'processing')).toBe(false);
    expect(matches('NEW', 'new')).toBe(true);
    expect(matches('ACTIVE', 'active')).toBe(true);
    expect(matches('ALMOST_BAKED', 'almost-baked')).toBe(true);
    expect(matches('GRADUATED', 'graduated')).toBe(true);

    const lifecycleSource = read('../../packages/db/src/repositories/lifecycle.ts');
    const feedRoute = read('../../apps/api/src/routes/feed.ts');
    const apiClient = read('../../apps/web/lib/api/client.ts');
    const queries = read('../../apps/web/lib/api/queries.ts');
    const explore = read('../../apps/web/components/explore/explore-client.tsx');

    expect(lifecycleSource).toContain('indexedLifecycleFilterSql');
    expect(feedRoute).toContain('lifecycle?: string;');
    expect(feedRoute).toContain('isIndexedLifecycleFilter');
    expect(apiClient).toContain("export type FeedLifecycle = 'new' | 'active' | 'almost-baked' | 'processing' | 'graduated';");
    expect(apiClient).toContain('lifecycle?: FeedLifecycle;');
    expect(queries).toContain("input.lifecycle ?? ''");
    for (const option of ['New', 'Active', 'Almost Baked', 'Processing', 'Graduated']) {
      expect(explore).toContain(`label: '${option}'`);
    }
    expect(explore).toContain('Lifecycle');
  });

  it('shows every currently source-backed Search token-row field with safe fallbacks', () => {
    const search = read('../../apps/web/components/search-surface.tsx');

    expect(search).toContain('bread-search-result__image');
    expect(search).toContain('formatUsdcBaseUnits(result.marketCap)');
    expect(search).toContain("Age {age ?? '—'}");
    expect(search).toContain("Holders {result.holderCount ?? '—'}");
    expect(search).toContain("Lifecycle {lifecycle ?? '—'}");
    expect(search).not.toMatch(/Date\.now\(|new Date\(\)/);
    expect(search).not.toMatch(/<img[^>]+src=\{result\.(?:metadata|image|logo)/);
  });

  it('implements v1.6.1 Recent and Trending Search only through their ratified authorities', () => {
    const search = read('../../apps/web/components/search-surface.tsx');
    const recent = read('../../apps/web/lib/search/recent-targets.ts');

    expect(recent).toContain('MAX_RECENT_SEARCH_TARGETS = 8');
    expect(recent).toContain('window.localStorage');
    expect(recent).not.toMatch(/fetch\s*\(|wallet|account|searchCount|queryCount|termCount/i);
    expect(search).toContain('recordRecentTarget');
    expect(search).toContain("breadQueryKeys.feed({ view: 'trending', limit: TRENDING_SEARCH_LIMIT })");
    expect(search).toContain("api.getFeed<readonly IndexedFeedItem[]>({ view: 'trending', limit: TRENDING_SEARCH_LIMIT })");
    expect(search).toContain('const TRENDING_SEARCH_LIMIT = 5;');
    expect(search).not.toMatch(/searchCount|queryCount|termCount|paidPlacement|sponsor/i);
  });

  it('projects market cap centrally from exact indexed execution price and snapshotted fixed supply', () => {
    const projection = read('../../packages/db/src/repositories/trades.ts');

    expect(projection).toMatch(/const\s+marketCap\s*=\s*\(priceNumerator\s*\*\s*fixedTotalSupply\)\s*\/\s*priceDenominator/);
    expect(projection).toContain('computeIndexedMarketCap(');
    expect(projection).toContain('market_cap = EXCLUDED.market_cap');
    expect(projection).not.toMatch(/Number\([^\n]*marketCap|parseFloat\([^\n]*marketCap/);
  });
});
