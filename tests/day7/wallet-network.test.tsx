import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const paths = {
  providers: 'apps/web/components/providers.tsx',
  walletProvider: 'apps/web/components/wallet/wallet-provider.tsx',
  walletButton: 'apps/web/components/wallet/wallet-button.tsx',
  walletMenu: 'apps/web/components/wallet/wallet-menu.tsx',
  networkSwitcher: 'apps/web/components/wallet/network-switcher.tsx',
  tradeProvider: 'apps/web/components/trade/wallet-trade-provider.tsx',
  runtime: 'apps/web/components/trade/trade-runtime.tsx',
  layout: 'apps/web/app/layout.tsx',
  walletStyles: 'apps/web/app/wallet.css',
  config: 'apps/web/lib/wallet/config.ts',
  tradePanel: 'apps/web/components/trade/trade-panel.tsx',
  create: 'apps/web/app/create/page.tsx',
  creator: 'apps/web/app/creator/page.tsx',
  portfolio: 'apps/web/app/portfolio/page.tsx',
  explore: 'apps/web/app/explore/page.tsx',
} as const;

describe('Day 7 Task 8 wallet/network integration and recovery convergence', () => {
  it('keeps one wallet/runtime owner while exposing the frozen WalletButton and NetworkSwitcher composition', () => {
    for (const path of [paths.walletProvider, paths.walletButton, paths.walletMenu, paths.networkSwitcher]) {
      expect(existsSync(resolve(root, path))).toBe(true);
    }

    const providers = read(paths.providers);
    const walletProvider = read(paths.walletProvider);
    const layout = read(paths.layout);

    expect(providers).toContain('WalletProvider');
    expect(providers).not.toContain('WalletTradeProvider');
    expect(walletProvider).toContain('WalletTradeProvider');
    expect(layout).toContain('WalletButton');
    expect(layout).toContain('<WalletButton');
  });

  it('offers discovered connector choices instead of silently treating connectors[0] as the wallet decision', () => {
    const provider = read(paths.tradeProvider);
    const runtime = read(paths.runtime);
    const button = read(paths.walletButton);
    const menu = read(paths.walletMenu);

    expect(provider).not.toContain('connectors[0]');
    expect(provider).toContain('connector.id');
    expect(provider).toContain('walletOptions');
    expect(runtime).toContain('WalletOption');
    expect(runtime).toContain('walletOptions');
    expect(runtime).toMatch(/connectWallet:\s*\(connectorId\?: string\)/);
    expect(button).toContain("dynamic(() => import('./wallet-menu')");
    expect(menu).toContain('walletOptions.map');
    expect(menu).toContain('chooseWallet(option.id)');
    expect(menu).toContain('runtime.connectWallet(connectorId)');

    // Detection is not a support certification. Wallet brands become first-class
    // only after their full Create/Buy/Sell/Claim/network-switch matrix is proven.
    for (const source of [button, menu, provider]) {
      expect(source).not.toMatch(/first[- ]class|officially supported/i);
    }
  });

  it('preserves browse access and converges transaction actions on Connect wallet / Switch to Arc', () => {
    const explore = read(paths.explore);
    const tradePanel = read(paths.tradePanel);
    const create = read(paths.create);
    const creator = read(paths.creator);
    const portfolio = read(paths.portfolio);
    const switcher = read(paths.networkSwitcher);

    expect(explore).not.toContain('useTradeRuntime');
    expect(tradePanel).toContain("'Connect wallet'");
    expect(tradePanel).toContain("'Switch to Arc'");
    expect(create).toContain('Switch to Arc');
    expect(creator).toContain('Switch to Arc');
    expect(portfolio).toContain('Switch to Arc');
    expect(switcher).toContain('Switch to Arc');
    expect(switcher).toContain("connectionStatus !== 'WRONG_NETWORK'");
  });

  it('keeps network identity canonical and does not embed wallet credentials or unsupported brand claims', () => {
    const config = read(paths.config);

    expect(config).toContain("config/networks/arc-testnet.json");
    expect(config).toContain("config/deployments/arc-testnet.day5.json");
    expect(config).toContain('multiInjectedProviderDiscovery: true');
    expect(config).not.toMatch(/projectId:\s*['\"][^'\"]+['\"]/);
    expect(config).not.toMatch(/MetaMask|Rabby|Coinbase Wallet/);
  });

  it('renders the wallet menu as a desktop popover and a safe-area-aware mobile sheet', () => {
    const css = read(paths.walletStyles);

    expect(css).toMatch(/\.bread-wallet-control\s*\{[\s\S]*?position:\s*relative/);
    expect(css).toMatch(/\.bread-wallet-menu\s*\{[\s\S]*?position:\s*absolute/);
    expect(css).toMatch(/@media\s*\(max-width:\s*767px\)[\s\S]*?\.bread-wallet-menu\s*\{[\s\S]*?position:\s*fixed/);
    expect(css).toMatch(/\.bread-wallet-menu\s*\{[\s\S]*?z-index:/);
    expect(css).toMatch(/@media\s*\(max-width:\s*767px\)[\s\S]*?env\(safe-area-inset-bottom\)/);
  });
});
