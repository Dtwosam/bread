import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const paths = {
  route: 'apps/web/app/create/page.tsx',
  config: 'apps/web/lib/wallet/config.ts',
  runtime: 'apps/web/components/trade/trade-runtime.tsx',
  provider: 'apps/web/components/trade/wallet-trade-provider.tsx',
  status: 'apps/web/components/transaction-status.tsx',
} as const;

describe('Day 7 Task 6 Create runtime integration', () => {
  it('derives launch ProtocolContext only from canonical deployment manifests and fails closed while unresolved', () => {
    const config = read(paths.config);
    expect(config).toContain("config/deployments/arc-testnet.day5.json");
    expect(config).toContain('resolveProtocolContext');
    expect(config).toContain('arcProtocolContext');
    expect(config).toMatch(/return null/);
    expect(config).not.toContain('0x0000000000000000000000000000000000000001');
  });

  it('extends the existing one-wallet runtime instead of introducing a second provider', () => {
    const runtime = read(paths.runtime);
    const provider = read(paths.provider);
    expect(runtime).toContain('protocolContext');
    expect(runtime).toContain('ProtocolContext');
    expect(provider).toContain('protocolContext: arcProtocolContext');
    expect(read(paths.route)).toContain('useTradeRuntime');
    expect(read(paths.route)).not.toContain('WagmiProvider');
  });

  it('prepares Review from current chain state and executes through the shared launch lifecycle only', () => {
    const route = read(paths.route);
    expect(route).toContain('readLaunchReviewSnapshot');
    expect(route).toContain('prepareCanonicalLaunchReview');
    expect(route).toContain('executeLaunchLifecycle');
    expect(route).toContain('recoverLaunchTransactions');
    expect(route).toContain('TransactionStatus');
    expect(route).not.toMatch(/\/v1\//);
  });

  it('handles disconnected and wrong-network states without blocking form editing', () => {
    const route = read(paths.route);
    expect(route).toContain("connectionStatus === 'DISCONNECTED'");
    expect(route).toContain("connectionStatus === 'WRONG_NETWORK'");
    expect(route).toContain('connectWallet');
    expect(route).toContain('switchToTargetChain');
    expect(route).toMatch(/protocol deployment.*unavailable|launch runtime.*unavailable/i);
  });

  it('maps canonical prepared values into Review and exposes launch-buy consequences', () => {
    const route = read(paths.route);
    for (const token of [
      'fixedSupply',
      'launchFeeUsdc',
      'graduationThreshold',
      'creatorRevenueWallet',
      'initialBuyReview',
      'expectedOutput',
      'minimumOutput',
      'baseFee',
      'priceImpactBps',
      'slippageBps',
    ]) {
      expect(route).toContain(token);
    }
  });

  it('uses canonical confirmed token identity for success actions and never guesses deployment order', () => {
    const route = read(paths.route);
    expect(route).toContain('tokenAddress');
    expect(route).toContain('View token');
    expect(route).toContain('Share on X');
    expect(route).toContain('Copy link');
    expect(route).toContain('Creator economics');
    expect(route).toContain('/token/');
    expect(route).not.toMatch(/CREATE2|predict.*address/i);
  });

  it('keeps key Create and launch actions at least 48px and announces transaction status', () => {
    const css = read('apps/web/components/create/create.module.css');
    expect(css).toMatch(/bread-create-primary-action[\s\S]*min-height:\s*48px/);
    const status = read(paths.status);
    expect(status).toContain('aria-live="polite"');
  });
});
