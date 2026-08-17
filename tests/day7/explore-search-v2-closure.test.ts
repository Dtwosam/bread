import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

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

  it('does not invent Recent or Trending Search persistence/ranking semantics that the ratified source leaves undefined', () => {
    const search = read('../../apps/web/components/search-surface.tsx');

    expect(search).not.toContain('RECENT_SEARCH_STORAGE_KEY');
    expect(search).not.toContain('MAX_RECENT_SEARCHES');
    expect(search).not.toContain('window.localStorage');
    expect(search).not.toContain("breadQueryKeys.feed({ view: 'trending'");
    expect(search).not.toContain("api.getFeed<readonly IndexedFeedItem[]>({ view: 'trending'");
  });

  it('projects market cap centrally from exact indexed execution price and snapshotted fixed supply', () => {
    const projection = read('../../packages/db/src/repositories/trades.ts');

    expect(projection).toMatch(/const\s+marketCap\s*=\s*\(priceNumerator\s*\*\s*fixedTotalSupply\)\s*\/\s*priceDenominator/);
    expect(projection).toContain('computeIndexedMarketCap(');
    expect(projection).toContain('market_cap = EXCLUDED.market_cap');
    expect(projection).not.toMatch(/Number\([^\n]*marketCap|parseFloat\([^\n]*marketCap/);
  });
});
