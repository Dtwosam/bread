import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const paths = {
  portfolioRoute: 'apps/web/app/portfolio/page.tsx',
  creatorRoute: 'apps/web/app/creator/page.tsx',
  portfolioPosition: 'apps/web/components/portfolio/position.tsx',
  claimPanel: 'apps/web/components/creator/claim-panel.tsx',
  claimController: 'apps/web/lib/transactions/claim-controller.ts',
  globals: 'apps/web/app/globals.css',
} as const;

describe('Day 7 Task 7 Portfolio, Creator dashboard and USDC claims', () => {
  it('keeps disconnected Portfolio and Creator routes truthful instead of inventing wallet balances', () => {
    expect(existsSync(resolve(root, paths.portfolioRoute))).toBe(true);
    expect(existsSync(resolve(root, paths.creatorRoute))).toBe(true);

    const portfolio = read(paths.portfolioRoute);
    const creator = read(paths.creatorRoute);

    for (const source of [portfolio, creator]) {
      expect(source).toContain('useTradeRuntime');
      expect(source).toContain("connectionStatus === 'DISCONNECTED'");
      expect(source).toContain('connectWallet');
    }

    expect(portfolio).toContain('getPortfolio');
    expect(creator).toContain('getCreator');
    expect(portfolio).not.toMatch(/rawRpc|readContract|eth_call/i);
  });

  it('does not expose PnL or average entry while the accepted Portfolio API has no trustworthy cost basis', () => {
    expect(existsSync(resolve(root, paths.portfolioPosition))).toBe(true);
    const position = read(paths.portfolioPosition);
    expect(position).not.toMatch(/\bPnL\b|average entry|avg\. entry/i);
    expect(position).toContain('/token/');
  });

  it('reviews exact onchain FeeEscrow claimable USDC and recipient before direct wallet signing', () => {
    expect(existsSync(resolve(root, paths.claimPanel))).toBe(true);
    expect(existsSync(resolve(root, paths.claimController))).toBe(true);

    const panel = read(paths.claimPanel);
    const controller = read(paths.claimController);

    expect(panel).toMatch(/Claimable USDC/i);
    expect(panel).toMatch(/Recipient/i);
    expect(controller).toContain("functionName: 'balanceOf'");
    expect(controller).toContain('breadAbiRegistry.feeEscrow');
    expect(controller).toContain('prepareClaim');
    expect(controller).toContain('simulatePreparedTransaction');
    expect(controller).not.toMatch(/\/v1\//);
  });

  it('renders indexed current value and responsive desktop-to-mobile Portfolio and Creator layouts', () => {
    const position = read(paths.portfolioPosition);
    const portfolio = read(paths.portfolioRoute);
    const creator = read(paths.creatorRoute);
    const css = read(paths.globals);

    expect(position).toContain('currentValue.numerator');
    expect(position).toContain('currentValue.denominator');
    expect(position).toContain('USDC');
    expect(portfolio).toContain('bread-portfolio-list');
    expect(creator).toContain('bread-creator-summary');
    expect(creator).toContain('bread-creator-launch-list');

    expect(css).toMatch(/\.bread-portfolio-position\s*\{[\s\S]*?grid-template-columns:/);
    expect(css).toMatch(/\.bread-creator-summary\s*\{[\s\S]*?grid-template-columns:/);
    expect(css).toMatch(/@media\s*\(max-width:\s*767px\)[\s\S]*?\.bread-portfolio-position\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
    expect(css).toMatch(/@media\s*\(max-width:\s*767px\)[\s\S]*?\.bread-creator-launch-list\s+li\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
    expect(css).not.toMatch(/\.bread-portfolio-list\s*\{[^}]*overflow-x:\s*auto/s);
  });
});
