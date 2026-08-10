import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('Day 7 Search indexed freshness presentation', () => {
  it('surfaces the shared freshness banner for successful non-fresh indexed search results', () => {
    const source = readFileSync(
      new URL('../../apps/web/components/search-surface.tsx', import.meta.url),
      'utf8',
    );

    expect(source).toContain("import { FreshnessBanner } from './freshness-banner'");
    expect(source).toContain('query.data?.meta ? <FreshnessBanner meta={query.data.meta} /> : null');
  });
});
