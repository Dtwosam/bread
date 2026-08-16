import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const paths = {
  page: 'apps/web/app/token/[address]/page.tsx',
  client: 'apps/web/components/token/token-client.tsx',
  trade: 'apps/web/components/trade/trade-experience.tsx',
  tradePanel: 'apps/web/components/trade/trade-panel.tsx',
  identity: 'apps/web/components/token/token-identity.tsx',
  stats: 'apps/web/components/token/token-stats.tsx',
  chart: 'apps/web/components/token/token-chart.tsx',
  graduation: 'apps/web/components/token/graduation-module.tsx',
  tabs: 'apps/web/components/token/token-tabs.tsx',
  css: 'apps/web/app/globals.css',
} as const;

describe('Day 7 Task 4 Token page behavior', () => {
  it('builds the frozen Token page from dedicated source-defined components', () => {
    for (const path of Object.values(paths)) expect(existsSync(resolve(root, path))).toBe(true);

    const page = read(paths.page);
    expect(page).toContain('TokenClient');
  });

  it('uses one canonical indexed primary read with distinct local malformed and API not-found states', () => {
    const client = read(paths.client);

    expect(client).toContain('createBreadApiClient');
    expect(client).toContain('breadQueryKeys.token(address)');
    expect(client).toContain('api.getToken<IndexedTokenDetail>(address)');
    expect(client).toContain('enabled: validAddress');
    expect(client).toContain("error.code === 'TOKEN_NOT_FOUND'");
    expect(client).toContain('Invalid token address');
    expect(client).toContain('Not a Bread launch');
    expect(client).toContain('<FreshnessBanner meta={query.data.meta} />');
  });

  it('keeps contract identity visible and unsupported financial values explicit', () => {
    const identity = read(paths.identity);
    const stats = read(paths.stats);

    expect(identity).toContain('{token.tokenAddress}');
    expect(identity).not.toContain('shortAddress(token.tokenAddress)');
    expect(stats).toContain('Market cap');
    expect(stats).toContain('Trades');
    expect(stats.match(/—/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('uses the canonical onchain deployer for the Token-header creator attribution', () => {
    const identity = read(paths.identity);

    expect(identity).toContain('CreatorAttribution');
    expect(identity).toContain('creatorAddress={token.deployerAddress}');
    expect(identity).toContain("size=\"token-header\"");
    expect(identity).not.toContain('token.creatorFeeRecipient');
  });

  it('renders canonical primary-detail holder count in Token market stats', () => {
    const stats = read(paths.stats);

    expect(stats).toContain("['Holders', token.holderCount ?? '—']");
  });

  it('presents active baked progress from the canonical real quote reserve and snapshotted target', () => {
    const graduation = read(paths.graduation);

    expect(graduation).toContain('realQuoteReserve');
    expect(graduation).toContain('graduationThreshold');
    expect(graduation).toContain('% baked');
    expect(graduation).toContain('Accumulated');
    expect(graduation).toContain('Remaining');
  });

  it('uses the source-defined Graduation pending label without implying the completed trade failed', () => {
    const graduation = read(paths.graduation);

    expect(graduation).toContain('Graduation pending');
    expect(graduation).toMatch(/completed trade remains confirmed/i);
    expect(graduation).not.toMatch(/trade failed/i);
  });

  it('presents Processing as Graduating and disables the invalid trade route while preserving completed trades', () => {
    const graduation = read(paths.graduation);
    const trade = read(paths.trade);
    const tradePanel = read(paths.tradePanel);

    expect(graduation).toContain("'Graduating'");
    expect(graduation).toMatch(/bonding curve is complete/i);
    expect(graduation).toMatch(/liquidity creation is in progress/i);
    expect(graduation).toMatch(/completed trades remain confirmed/i);
    expect(graduation).toContain("state === 'Graduating'");
    expect(graduation).toContain('Continue graduation');
    expect(trade).toContain('routeUnavailableReason');
    expect(tradePanel).toContain('routeUnavailableReason');
    expect(tradePanel).toContain('Trading unavailable');
  });

  it('transforms the lifecycle module for canonical Graduated state without inventing a pool address', () => {
    const graduation = read(paths.graduation);

    expect(graduation).toContain('graduatedVenueKind');
    expect(graduation).toContain('Uniswap V3');
    expect(graduation).toContain('Pool ID');
    expect(graduation).toContain('positionManager');
    expect(graduation).toContain('Position manager');
    expect(graduation).toContain('usdcUsed');
    expect(graduation).toContain('Liquidity USDC');
    expect(graduation).toContain('Permanent lock');
    expect(graduation).toMatch(/not a safety guarantee/i);
    expect(graduation).not.toMatch(/pool address.*poolId/i);
  });

  it('exposes source-defined TradePanel balance, reviewed route context and ticker-aware final CTA inputs', () => {
    const trade = read(paths.trade);
    const tradePanel = read(paths.tradePanel);

    expect(trade).toContain('spendableBalance');
    expect(trade).toContain('getSpendableBalance');
    expect(trade).toContain('reviewRoute');
    expect(trade).toContain('tokenSymbol: token.symbol');
    expect(tradePanel).toContain('spendableBalance');
    expect(tradePanel).toContain('reviewRoute');
    expect(tradePanel).toContain('tokenSymbol');
    expect(tradePanel).toContain('Balance');
    expect(tradePanel).toContain('Bonding curve');
    expect(tradePanel).toContain('Uniswap V3');
  });

  it('lazy-loads secondary Trades and Holders only when their tabs are active', () => {
    const tabs = read(paths.tabs);

    expect(tabs).toContain("activeTab === 'trades'");
    expect(tabs).toContain("enabled: activeTab === 'trades'");
    expect(tabs).toContain('breadQueryKeys.trades(tokenAddress');
    expect(tabs).toContain('api.getTrades<readonly IndexedTokenTrade[]>');
    expect(tabs).toContain("activeTab === 'holders'");
    expect(tabs).toContain("enabled: activeTab === 'holders'");
    expect(tabs).toContain('breadQueryKeys.holders(tokenAddress');
    expect(tabs).toContain('api.getHolders<IndexedTokenHolders>');
  });

  it('does not fabricate chart history and provides a textual indexed-price alternative', () => {
    const client = read(paths.client);
    const chart = read(paths.chart);

    expect(client).toContain("dynamic(() => import('./token-chart')");
    expect(chart).toContain('Historical chart unavailable');
    expect(chart).toContain('Indexed price ratio');
    expect(chart).not.toMatch(/candles|fake|sampleData|mockData/i);
  });

  it('shows canonical graduation evidence without describing it as a safety guarantee', () => {
    const graduation = read(paths.graduation);

    expect(graduation).toContain('Graduation');
    expect(graduation).toContain('progressBps');
    expect(graduation).toContain('graduationPhase');
    expect(graduation).toContain('poolId');
    expect(graduation).toContain('positionLocked');
    expect(graduation).not.toMatch(/guaranteed safe|risk[- ]free/i);
  });

  it('keeps canonical NOT_GRADUATED launches Active until the curve is actually ready', () => {
    const graduation = read(paths.graduation);

    expect(graduation).toContain("graduationPhase !== 'NOT_GRADUATED'");
    expect(graduation).toContain('readyToGraduate');
  });

  it('preserves source-defined responsive Token composition through the Task-5 trade owner', () => {
    const client = read(paths.client);
    const trade = read(paths.trade);
    const css = read(paths.css);

    expect(client).toContain('bread-token-layout');
    expect(client).toContain('<TradeExperience token={token} />');
    expect(trade).toContain('bread-token-trade-slot');
    expect(trade).toContain('bread-token-mobile-actions');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr) 360px');
    expect(css).toContain('.bread-token-mobile-actions');
    expect(css).toContain('@media (max-width: 767px)');
  });

  it('keeps the frozen tablet trade-sheet composition after Task-5 enables transactions', () => {
    const trade = read(paths.trade);
    const css = read(paths.css);

    expect(trade).toContain('bread-token-tablet-trade-trigger');
    expect(trade).toContain('sheetOpen');
    expect(trade).toContain('role="dialog"');
    expect(trade).toContain('aria-modal="true"');
    expect(css).toContain('.bread-token-tablet-trade-trigger');
    expect(css).toContain('.bread-token-tablet-trade-sheet');
    expect(css).toContain('@media (min-width: 768px) and (max-width: 1023px)');
  });

  it('keeps source-defined Info facts explicit when no canonical value is projected', () => {
    const tabs = read(paths.tabs);

    expect(tabs).toContain('Buyback');
    expect(tabs).toContain('Social links');
    expect(tabs).toContain('Description');
  });
});
