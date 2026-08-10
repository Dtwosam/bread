import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const paths = {
  tokenClient: 'apps/web/components/token/token-client.tsx',
  runtime: 'apps/web/components/trade/trade-runtime.tsx',
  experience: 'apps/web/components/trade/trade-experience.tsx',
  panel: 'apps/web/components/trade/trade-panel.tsx',
  status: 'apps/web/components/transaction-status.tsx',
  globals: 'apps/web/app/globals.css',
  tradeCss: 'apps/web/components/trade/trade.module.css',
} as const;

describe('Day 7 Task 5 responsive trade surface', () => {
  it('uses one shared TradeExperience instead of three independent transaction states', () => {
    for (const path of Object.values(paths)) expect(existsSync(resolve(root, path))).toBe(true);

    const tokenClient = read(paths.tokenClient);
    expect(tokenClient).toContain('TradeExperience');
    expect(tokenClient.match(/<TradeExperience\b/g)?.length ?? 0).toBe(1);
    expect(tokenClient).not.toContain('Buy unavailable until trade integration');
    expect(tokenClient).not.toContain('Sell unavailable until trade integration');
  });

  it('keeps wallet/provider capability injected and never creates a Bread mutation API', () => {
    const runtime = read(paths.runtime);
    const experience = read(paths.experience);
    const panel = read(paths.panel);

    expect(runtime).toContain('TradeRuntimeProvider');
    expect(runtime).toContain('TradeWalletAdapter');
    expect(runtime).toContain('PublicClient');
    expect(experience).toContain('useTradeRuntime');
    expect(panel).not.toMatch(/\/v1\//);
    expect(experience).not.toMatch(/\/v1\//);
  });

  it('shows every source-required financial consequence from the SDK review', () => {
    const panel = read(paths.panel);
    const experience = read(paths.experience);

    for (const label of [
      'Expected output',
      'Minimum output',
      'Base fee',
      'Creator tax',
      'Opening buy tax',
      'Price impact',
      'Slippage',
    ]) {
      expect(panel).toContain(label);
    }
    expect(experience).toContain('prepareTradeForSignature');
    expect(experience).toContain('executeTradeLifecycle');
    expect(panel).not.toMatch(/getAmountOut|getAmountIn|quoteReserve\s*\*/);
    expect(experience).not.toMatch(/getAmountOut|getAmountIn|quoteReserve\s*\*/);
  });

  it('keeps the exact Buy/Sell quick actions and mobile-friendly numeric input', () => {
    const panel = read(paths.panel);

    for (const preset of ['$25', '$50', '$100', 'MAX', '25%', '50%', '75%']) {
      expect(panel).toContain(preset);
    }
    expect(panel).toContain('inputMode="decimal"');
    expect(panel).toContain('aria-label="Trade amount"');
  });

  it('warns whenever canonical opening buy tax is active without inventing a new threshold', () => {
    const panel = read(paths.panel);

    expect(panel).toContain('review.openingTaxBps > 0');
    expect(panel).toContain('Opening buy tax is active');
    expect(panel).toContain('review.openingTaxBps');
  });

  it('renders the frozen transaction statuses through an accessible live region', () => {
    const status = read(paths.status);

    expect(status).toContain('role="status"');
    expect(status).toContain('aria-live="polite"');
    for (const state of [
      'VALIDATING',
      'PREPARING',
      'AWAITING_SIGNATURE',
      'SUBMITTED',
      'CONFIRMING',
      'CONFIRMED',
      'REJECTED',
      'REVERTED',
      'REPLACED',
      'UNKNOWN',
    ]) {
      expect(status).toContain(state);
    }
  });

  it('shares the same experience across desktop, tablet and mobile source-defined slots', () => {
    const experience = read(paths.experience);
    const css = read(paths.globals);

    expect(experience).toContain('bread-token-trade-slot');
    expect(experience).toContain('bread-token-tablet-trade-trigger');
    expect(experience).toContain('bread-token-tablet-trade-sheet');
    expect(experience).toContain('bread-token-mobile-actions');
    expect(css).toContain('@media (min-width: 768px) and (max-width: 1023px)');
    expect(css).toContain('@media (max-width: 767px)');
  });

  it('keeps all interactive trade controls at the accepted minimum touch target', () => {
    const css = read(paths.tradeCss);
    expect(css).toContain(':global(.bread-trade-preset)');
    expect(css).toContain(':global(.bread-trade-input)');
    expect(css).toMatch(/:global\(\.bread-trade-preset\)[\s\S]*min-height:\s*44px/);
    expect(css).toMatch(/:global\(\.bread-trade-input\)[\s\S]*min-height:\s*44px/);
  });
});
