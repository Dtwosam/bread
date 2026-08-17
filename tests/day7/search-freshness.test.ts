import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('Day 7 Search indexed freshness presentation', () => {
  it('surfaces the shared freshness banner for successful non-fresh indexed search results', () => {
    const source = readFileSync(
      new URL('../../apps/web/components/search-surface.tsx', import.meta.url),
      'utf8',
    );

    expect(source).toMatch(
      /import\s+\{\s*FreshnessBanner\s*\}\s+from\s+["']\.\/freshness-banner["'];?/,
    );
    expect(source).toMatch(
      /query\.data\?\.meta\s*\?\s*\(\s*<FreshnessBanner\s+meta=\{query\.data\.meta\}\s*\/>\s*\)\s*:\s*null/s,
    );
  });
});
