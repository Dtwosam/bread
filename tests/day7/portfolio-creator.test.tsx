import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const paths = {
  portfolioRoute: 'apps/web/app/portfolio/page.tsx',
  creatorRoute: 'apps/web/app/creator/page.tsx',
  portfolioPosition: 'apps/web/components/portfolio/position.tsx',
  portfolioValue: 'apps/web/lib/portfolio/value.ts',
  claimPanel: 'apps/web/components/creator/claim-panel.tsx',
  claimController: 'apps/web/lib/transactions/claim-controller.ts',
  responsive: 'apps/web/app/portfolio-creator.css',
  types: 'packages/types/src/portfolio.ts',
  portfolioApi: 'apps/api/src/routes/portfolio.ts',
  creatorRepository: 'packages/db/src/repositories/creators.ts',
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

  it('keeps creator attribution in every Portfolio holding from canonical indexed deployer identity', () => {
    const types = read(paths.types);
    const api = read(paths.portfolioApi);
    const position = read(paths.portfolioPosition);

    expect(types).toContain('creatorAddress');
    expect(api).toContain('getLaunch');
    expect(api).toContain('deployerAddress');
    expect(api).toContain('creatorAddress');
    expect(api).not.toMatch(/creatorAddress:\s*launch\?\.creatorFeeRecipient/);
    expect(position).toContain('CreatorAttribution');
    expect(position).toContain('holding.creatorAddress');
  });

  it('does not expose PnL, average entry or fake 24h movement while those values are unavailable', () => {
    expect(existsSync(resolve(root, paths.portfolioPosition))).toBe(true);
    const position = read(paths.portfolioPosition);
    const route = read(paths.portfolioRoute);
    expect(position).not.toMatch(/\bPnL\b|average entry|avg\. entry/i);
    expect(position).not.toContain('Movement');
    expect(route).not.toContain('<th scope="col">Movement</th>');
    expect(position).toContain('/token/');
    expect(position).toContain('Trade');
  });

  it('keeps Portfolio calm: at most three summary blocks, holdings primary, recent activity below, no invented watchlist', () => {
    const portfolio = read(paths.portfolioRoute);
    expect(portfolio).toContain('Wallet value');
    expect(portfolio).toContain('Positions');
    expect(portfolio).toContain('bread-portfolio-list');
    expect(portfolio).toContain('Recent wallet activity');
    expect(portfolio).not.toMatch(/watchlist/i);
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

  it('backs Creator launch identity, market cap and lifecycle with indexed data rather than placeholders', () => {
    const types = read(paths.types);
    const repository = read(paths.creatorRepository);
    const creator = read(paths.creatorRoute);

    for (const field of ['name', 'symbol', 'marketCap', 'lifecycleState']) {
      expect(types).toContain(field);
    }
    expect(repository).toContain('LEFT JOIN token_metrics');
    expect(repository).toContain('LEFT JOIN launch_state');
    expect(repository).toContain('market_cap::text AS market_cap');
    expect(repository).toContain('graduation_state');
    expect(creator).toContain('CreatorAttribution');
    expect(creator).toContain('isCurrentUser');
    expect(creator).toContain('Market cap');
    expect(creator).toContain('Lifecycle');
    expect(creator).toContain('Revenue');
    expect(creator).toContain('Claim status');
  });

  it('shows only source-backed Creator summary blocks and does not fabricate unavailable buyback balances', () => {
    const creator = read(paths.creatorRoute);
    expect(creator).toContain('Total earned');
    expect(creator).toContain('Claimable USDC');
    expect(creator).toContain('Active launches');
    expect(creator).not.toContain('Locked buyback tokens');
    expect(creator).not.toMatch(/creator score|trust badge|reputation/i);
  });

  it('renders indexed current value and responsive desktop-to-mobile Portfolio and Creator layouts', () => {
    const position = read(paths.portfolioPosition);
    const value = read(paths.portfolioValue);
    const portfolio = read(paths.portfolioRoute);
    const creator = read(paths.creatorRoute);
    const css = read(paths.responsive);

    expect(value).toContain('value.numerator');
    expect(value).toContain('value.denominator');
    expect(value).toContain('formatUnits');
    expect(position).toContain('formatIndexedCurrentValueUsdc');
    expect(position).toContain('Current value');
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
