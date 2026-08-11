import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const paths = {
  config: 'apps/web/lib/wallet/config.ts',
  menu: 'apps/web/components/wallet/wallet-menu.tsx',
  webPackage: 'apps/web/package.json',
  nextConfig: 'apps/web/next.config.ts',
} as const;

/**
 * Day-9 mobile wallet connectivity gap.
 *
 * 04C names Rabby, MetaMask, Coinbase Wallet and WalletConnect-compatible
 * wallets, and 04D requires current iOS Safari plus current Chrome on a
 * representative physical Android device as first-class trading surfaces.
 *
 * `injected()` can only ever reach a wallet through EIP-6963/EIP-1193
 * injection. Chrome for Android supports no extensions at all, and no
 * mainstream EVM wallet ships an iOS Safari extension, so an injected-only
 * configuration can never present a wallet on either mandatory mobile target.
 * These assertions pin the remote (WalletConnect) path that closes that gap
 * without removing the desktop injected path.
 */
describe('Day 9 mobile wallet connectivity', () => {
  it('configures a remote WalletConnect path alongside injected for mobile browsers', () => {
    const config = read(paths.config);

    expect(config).toContain('walletConnect');
    expect(config).toMatch(/import\s*\{[^}]*walletConnect[^}]*\}\s*from\s*'wagmi\/connectors'/);

    // The desktop extension path must survive; this is an addition, not a swap.
    expect(config).toContain('injected(');
    expect(config).toContain('multiInjectedProviderDiscovery');
  });

  it('sources the Reown project id from public browser configuration and never from a secret', () => {
    const config = read(paths.config);

    // A WalletConnect project id is a public client identifier. It must be
    // supplied through NEXT_PUBLIC configuration, never inlined and never
    // read from a server-only/secret-shaped variable.
    expect(config).toContain('NEXT_PUBLIC_BREAD_WALLETCONNECT_PROJECT_ID');
    expect(config).not.toMatch(/projectId:\s*'[0-9a-f]{8,}'/i);

    // Secret-shaped identifiers only; prose explaining that the project id is
    // NOT a secret must not trip this.
    expect(config).not.toMatch(/\b(PRIVATE_KEY|MNEMONIC|SIGNING_KEY|[A-Z][A-Z_]*SECRET[A-Z_]*)\b/);
  });

  it('fails closed to injected-only when no project id is configured', () => {
    const config = read(paths.config);

    // Absent configuration must degrade to the existing injected-only
    // behaviour rather than constructing a connector that cannot dial.
    expect(config).toMatch(/const\s+remoteConnectors\s*=\s*[\s\S]*?walletConnectProjectId[\s\S]*?\?[\s\S]*?walletConnect\(/);
    expect(config).toMatch(/:\s*\[\s*\]/);
    expect(config).toMatch(/connectors:\s*\[\s*injected\(\)\s*,\s*\.\.\.remoteConnectors\s*\]/);
  });

  it('permits exactly the WalletConnect origins the shipped connector needs', () => {
    const nextConfig = read(paths.nextConfig);

    // The Verify attestation SDK is loaded in an iframe; without frame-src the
    // existing default-src 'self' blocks it. Fonts come from the modal.
    expect(nextConfig).toContain('frame-src');
    expect(nextConfig).toContain('https://secure.walletconnect.org');
    expect(nextConfig).toContain('https://fonts.reown.com');

    // frame-ancestors must stay locked down: Bread is never embeddable.
    expect(nextConfig).toContain("frame-ancestors 'none'");

    // No blanket widening of script execution for a third party.
    expect(nextConfig).not.toMatch(/script-src[^"']*walletconnect/i);
    expect(nextConfig).not.toMatch(/script-src[^"']*\bhttps:(?!\s*wss)/i);
  });

  it('keeps wallet truthfulness messaging: detection is not certification', () => {
    const menu = read(paths.menu);

    expect(menu).toContain('Detection alone is not a compatibility certification.');
  });

  it('declares the single minimum WalletConnect dependency surface', () => {
    const webPackage = JSON.parse(read(paths.webPackage)) as {
      dependencies?: Record<string, string>;
    };
    const dependencies = webPackage.dependencies ?? {};

    // wagmi's walletConnect connector lazily imports exactly this package.
    expect(dependencies).toHaveProperty('@walletconnect/ethereum-provider');

    // No wallet-brand SDK and no hosted modal kit may be added: Bread stays
    // provider-neutral and must not promote a wallet brand to first class.
    expect(dependencies).not.toHaveProperty('@reown/appkit');
    expect(dependencies).not.toHaveProperty('@web3modal/wagmi');
    expect(dependencies).not.toHaveProperty('@coinbase/wallet-sdk');
    expect(dependencies).not.toHaveProperty('@metamask/sdk');
  });
});
