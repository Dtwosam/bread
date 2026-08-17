import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('Bread UI/UX v2.2 Token detail source-conformance closure', () => {
  it('uses the exact source-defined primary stats without promoting creator tax or unavailable movement', () => {
    const stats = read('../../apps/web/components/token/token-stats.tsx');

    expect(stats).toContain("['Market cap', formatUsdcBaseUnits(token.marketCap)]");
    expect(stats).toContain("['Price', priceRatio(token)]");
    expect(stats).toContain("['24h volume', formatUsdcBaseUnits(token.metrics?.quoteVolume.h24 ?? null)]");
    expect(stats).toContain("['Holders', token.holderCount ?? '—']");
    expect(stats).toContain("['Trades', token.metrics?.tradeCount.h24 ?? '—']");
    expect(stats).not.toContain("['24h change'");
    expect(stats).not.toContain("['Creator tax'");
  });

  it('uses the exact v2.2 Token header image/title dimensions on desktop and mobile', () => {
    const identity = read('../../apps/web/components/token/token-identity.tsx');
    const css = read('../../apps/web/app/token-v2-closure.css');
    const layout = read('../../apps/web/app/layout.tsx');

    expect(identity).toContain('bread-token-identity__mark');
    expect(layout).toContain("import './token-v2-closure.css';");
    expect(css).toMatch(/\.bread-token-identity__mark\s*\{[^}]*width:\s*64px;[^}]*height:\s*64px;/s);
    expect(css).toMatch(/\.bread-token-identity__title-row h1\s*\{[^}]*font-size:\s*28px;[^}]*line-height:\s*34px;[^}]*font-weight:\s*700;/s);
    expect(css).toMatch(/@media \(max-width:\s*767px\)[\s\S]*?\.bread-token-identity__mark\s*\{[^}]*width:\s*56px;[^}]*height:\s*56px;/s);
    expect(css).toMatch(/@media \(max-width:\s*767px\)[\s\S]*?\.bread-token-identity__title-row h1\s*\{[^}]*font-size:\s*22px;[^}]*line-height:\s*28px;/s);
  });
});
