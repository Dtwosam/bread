import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { formatIndexedAge } from '../../apps/web/components/explore/model';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('Bread UI/UX v2.2 Explore/Search remaining source-backed presentation', () => {
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

  it('renders the canonical indexed market cap on Explore cards rather than an unavailable placeholder', () => {
    const model = read('../../apps/web/components/explore/model.ts');
    const card = read('../../apps/web/components/token-card.tsx');

    expect(model).toContain("'marketCap'");
    expect(model).toContain('marketCap: source.marketCap');
    expect(card).toContain('{formatUsdcBaseUnits(model.marketCap)}');
    expect(card).not.toMatch(/<dt>Market cap<\/dt>\s*<dd[^>]*>—<\/dd>/s);
  });

  it('shows every source-required Search token-row field while unavailable values stay explicit', () => {
    const search = read('../../apps/web/components/search-surface.tsx');

    expect(search).toContain('bread-search-result__image');
    expect(search).toContain('Market cap');
    expect(search).toContain("Age {age ?? '—'}");
    expect(search).toContain("Holders {result.holderCount ?? '—'}");
    expect(search).toContain("Lifecycle {lifecycle ?? '—'}");
    expect(search).not.toMatch(/Date\.now\(|new Date\(\)/);
    expect(search).not.toMatch(/<img[^>]+src=\{result\.(?:metadata|image|logo)/);
  });

  it('keeps Recent searches device-local, bounded to eight unique selections, and clearable', () => {
    const search = read('../../apps/web/components/search-surface.tsx');

    expect(search).toContain('Recent searches');
    expect(search).toContain('bread.search.recent.v1');
    expect(search).toContain('MAX_RECENT_SEARCHES = 8');
    expect(search).toContain('window.localStorage');
    expect(search).toContain('Clear recent');
    expect(search).not.toMatch(/walletAddress.*recent|recent.*walletAddress/i);
  });

  it('does not create competing market-cap math in public UI', () => {
    const card = read('../../apps/web/components/token-card.tsx');
    const search = read('../../apps/web/components/search-surface.tsx');

    expect(card).toContain('<dt>Market cap</dt>');
    expect(card).toContain('<dt>24h change</dt>');
    expect(search).toContain('Market cap');
    expect(`${card}\n${search}`).not.toMatch(/circulatingSupply|marketCap\s*=/);
  });
});
