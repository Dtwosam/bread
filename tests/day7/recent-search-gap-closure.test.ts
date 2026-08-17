import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('Bread v1.6.1 Recent Search gap closure', () => {
  it('stores only canonical selected token targets locally with max-8 dedupe/newest-first/remove/clear semantics', async () => {
    const moduleUrl = new URL('../../apps/web/lib/search/recent-targets.ts', import.meta.url);
    expect(existsSync(moduleUrl)).toBe(true);
    if (!existsSync(moduleUrl)) return;

    const recent = await import('../../apps/web/lib/search/recent-targets');
    const make = (index: number) => ({
      tokenAddress: `0x${index.toString(16).padStart(40, '0')}`,
      name: `Token ${index}`,
      symbol: `T${index}`,
      deployerAddress: `0x${(index + 100).toString(16).padStart(40, '0')}`,
    });

    let targets = [] as ReturnType<typeof recent.addRecentSearchTarget>;
    for (let index = 1; index <= 9; index += 1) targets = recent.addRecentSearchTarget(targets, make(index));
    expect(targets).toHaveLength(8);
    expect(targets.map((target) => target.tokenAddress)).toEqual(
      [9, 8, 7, 6, 5, 4, 3, 2].map((index) => make(index).tokenAddress),
    );

    targets = recent.addRecentSearchTarget(targets, { ...make(5), tokenAddress: make(5).tokenAddress.toUpperCase().replace('0X', '0x') });
    expect(targets).toHaveLength(8);
    expect(targets[0]?.tokenAddress).toBe(make(5).tokenAddress);
    expect(targets.filter((target) => target.tokenAddress === make(5).tokenAddress)).toHaveLength(1);

    targets = recent.removeRecentSearchTarget(targets, make(5).tokenAddress);
    expect(targets.some((target) => target.tokenAddress === make(5).tokenAddress)).toBe(false);
    expect(recent.clearRecentSearchTargets()).toEqual([]);
  });

  it('persists through browser localStorage only and records result selection rather than raw search terms', () => {
    const storage = read('../../apps/web/lib/search/recent-targets.ts');
    const surface = read('../../apps/web/components/search-surface.tsx');

    expect(storage).toContain('window.localStorage');
    expect(storage).toContain('MAX_RECENT_SEARCH_TARGETS = 8');
    expect(storage).not.toMatch(/fetch\s*\(|createBreadApiClient|wallet|account/i);
    expect(surface).toContain('recordRecentTarget');
    expect(surface).toContain('onClick={() => recordRecentTarget(result)}');
    expect(surface).not.toContain('recordRecentTarget(value)');
    expect(surface).toContain('Clear recent');
    expect(surface).toContain('Remove recent');
  });
});
