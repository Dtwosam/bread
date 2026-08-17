import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('Bread v1.6.1 Trending Search gap closure', () => {
  it('reuses the canonical indexed Trending token feed in its existing order with a bounded Search subset', () => {
    const surface = read('../../apps/web/components/search-surface.tsx');

    expect(surface).toMatch(
      /breadQueryKeys\.feed\(\{\s*view:\s*["']trending["'],\s*limit:\s*TRENDING_SEARCH_LIMIT,?\s*\}\)/s,
    );
    expect(surface).toMatch(
      /api\.getFeed<readonly IndexedFeedItem\[]>\(\{\s*view:\s*["']trending["'],\s*limit:\s*TRENDING_SEARCH_LIMIT,?\s*\}\)/s,
    );
    expect(surface).toContain('const TRENDING_SEARCH_LIMIT = 5;');
    expect(surface).toMatch(/<h3 className=["']bread-search-hint["']>Trending<\/h3>/);
    expect(surface).not.toMatch(/searchCount|queryCount|termCount|paidPlacement|sponsor/i);
  });
});
