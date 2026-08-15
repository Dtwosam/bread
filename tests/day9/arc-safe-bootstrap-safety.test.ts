import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

async function loadLib() {
  const path = '../../scripts/day9/arc-safe-bootstrap-lib.mjs';
  try {
    return await import(/* @vite-ignore */ path) as Readonly<{
      validateAuthoritySet: (input: Readonly<{
        deployer: string;
        guardian: string;
        owners: readonly string[];
      }>) => void;
      renderSecretEnv: (input: Readonly<Record<string, string>>) => string;
      publicAuthoritySummary: (input: Readonly<{
        deployer: string;
        guardian: string;
        owners: readonly string[];
        secretFile: string;
      }>) => Readonly<Record<string, unknown>>;
    }>;
  } catch {
    return null;
  }
}

const deployer = '0x1000000000000000000000000000000000000001';
const guardian = '0x2000000000000000000000000000000000000002';
const owners = [
  '0x3000000000000000000000000000000000000003',
  '0x4000000000000000000000000000000000000004',
  '0x5000000000000000000000000000000000000005',
] as const;

describe('Day 9 Arc Safe bootstrap safety boundary', () => {
  it('requires three distinct Safe owners separate from deployer and Guardian', async () => {
    const lib = await loadLib();
    expect(lib?.validateAuthoritySet).toBeTypeOf('function');
    if (!lib) return;

    expect(() => lib.validateAuthoritySet({ deployer, guardian, owners })).not.toThrow();
    expect(() => lib.validateAuthoritySet({ deployer, guardian, owners: [owners[0], owners[0], owners[2]] })).toThrow();
    expect(() => lib.validateAuthoritySet({ deployer, guardian, owners: [deployer, owners[1], owners[2]] })).toThrow();
    expect(() => lib.validateAuthoritySet({ deployer, guardian, owners: [guardian, owners[1], owners[2]] })).toThrow();
  });

  it('keeps private keys in the secret env representation and out of the public summary', async () => {
    const lib = await loadLib();
    expect(lib?.renderSecretEnv).toBeTypeOf('function');
    expect(lib?.publicAuthoritySummary).toBeTypeOf('function');
    if (!lib) return;

    const privateKey = `0x${'ab'.repeat(32)}`;
    const env = lib.renderSecretEnv({
      BREAD_DEPLOYER_PRIVATE_KEY: privateKey,
      BREAD_SAFE_OWNER_1_PRIVATE_KEY: privateKey,
      BREAD_DEPLOYMENT_AUTHORITY: deployer,
    });
    expect(env).toContain(privateKey);

    const summary = JSON.stringify(lib.publicAuthoritySummary({
      deployer,
      guardian,
      owners,
      secretFile: '/Users/test/.config/bread/day9-arc-testnet-safe.env',
    }));
    expect(summary).not.toContain(privateKey);
    expect(summary).not.toMatch(/private[_-]?key/i);
  });

  it('uses Safe chain-specific proxy creation and never embeds owner private keys in Solidity', () => {
    const path = resolve(process.cwd(), 'contracts/script/rehearsal/CreateDay9ArcSafe.s.sol');
    let source = '';
    try {
      source = readFileSync(path, 'utf8');
    } catch {
      // RED until the bounded creation script exists.
    }

    expect(source).toContain('createChainSpecificProxyWithNonce');
    expect(source).not.toContain('createProxyWithNonce(');
    expect(source).toContain('BREAD_SAFE_OWNER_1');
    expect(source).toContain('BREAD_SAFE_OWNER_2');
    expect(source).toContain('BREAD_SAFE_OWNER_3');
    expect(source).toContain('BREAD_GUARDIAN');
    expect(source).not.toContain('BREAD_SAFE_OWNER_1_PRIVATE_KEY');
    expect(source).not.toContain('BREAD_SAFE_OWNER_2_PRIVATE_KEY');
    expect(source).not.toContain('BREAD_SAFE_OWNER_3_PRIVATE_KEY');
  });
});
