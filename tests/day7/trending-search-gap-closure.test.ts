import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('Bread v1.6.1 Trending Search gap closure', () => {
  it('reuses the canonical indexed Trending token feed in its existing order with a bounded Search subset', () => {
    const surface = read('../../apps/web/components/search-surface.tsx');

    expect(surface).toContain("breadQueryKeys.feed({ view: 'trending', limit: TRENDING_SEARCH_LIMIT })");
    expect(surface).toContain("api.getFeed<readonly IndexedFeedItem[]>({ view: 'trending', limit: TRENDING_SEARCH_LIMIT })");
    expect(surface).toContain('const TRENDING_SEARCH_LIMIT = 5;');
    expect(surface).toContain("<h3 className=\"bread-search-hint\">Trending</h3>");
    expect(surface).not.toMatch(/searchCount|queryCount|termCount|paidPlacement|sponsor/i);
  });
});
