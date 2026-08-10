import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createTradeWalletAdapter,
  readSpendableTradeBalance,
} from '../../apps/web/lib/transactions/wallet-adapter.js';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const address = (byte: string) => `0x${byte.repeat(40)}` as `0x${string}`;
const hash = (byte: string) => `0x${byte.repeat(64)}` as `0x${string}`;

function preparedTrade() {
  return {
    to: address('9'),
    abi: [] as const,
    functionName: 'buy',
    args: [10_000n, 9_000n, address('b')] as const,
    value: 0n as const,
    allowance: {
      token: address('2'),
      spender: address('9'),
      amount: 10_000n,
    },
  };
}

describe('Day 7 Task 5 real wallet runtime', () => {
  it('sends an exact approval and waits for it before a separately requested trade broadcast', async () => {
    const writes: Array<{ functionName: string; args?: readonly unknown[] }> = [];
    const waits: `0x${string}`[] = [];
    let approvalConfirmed = false;
    const publicClient = {
      async readContract(request: { functionName: string }) {
        if (request.functionName === 'allowance') return approvalConfirmed ? 10_000n : 0n;
        throw new Error(`unexpected read ${request.functionName}`);
      },
      async waitForTransactionReceipt({ hash: transactionHash }: { hash: `0x${string}` }) {
        waits.push(transactionHash);
        approvalConfirmed = true;
        return { status: 'success' as const };
      },
    } as never;
    const walletClient = {
      async writeContract(request: { functionName: string; args?: readonly unknown[] }) {
        writes.push(request);
        return request.functionName === 'approve' ? hash('a') : hash('b');
      },
    } as never;

    const adapter = createTradeWalletAdapter({
      publicClient,
      walletClient,
      account: address('b'),
      chainId: 5_042_002,
    });
    await adapter.ensurePreparedTransactionAllowance(preparedTrade());
    const result = await adapter.sendPreparedTransaction(preparedTrade());

    expect(writes.map((write) => write.functionName)).toEqual(['approve', 'buy']);
    expect(writes[0]?.args).toEqual([address('9'), 10_000n]);
    expect(waits).toEqual([hash('a')]);
    expect(result).toBe(hash('b'));
  });

  it('does not send an approval when the exact spend allowance is already sufficient', async () => {
    const writes: string[] = [];
    const publicClient = {
      async readContract() {
        return 10_000n;
      },
      async waitForTransactionReceipt() {
        throw new Error('approval receipt should not be awaited');
      },
    } as never;
    const walletClient = {
      async writeContract(request: { functionName: string }) {
        writes.push(request.functionName);
        return hash('b');
      },
    } as never;

    const adapter = createTradeWalletAdapter({
      publicClient,
      walletClient,
      account: address('b'),
      chainId: 5_042_002,
    });
    await adapter.ensurePreparedTransactionAllowance(preparedTrade());
    await adapter.sendPreparedTransaction(preparedTrade());

    expect(writes).toEqual(['buy']);
  });

  it('fails closed when an approval is mined reverted and never broadcasts the trade', async () => {
    const writes: string[] = [];
    const publicClient = {
      async readContract() {
        return 0n;
      },
      async waitForTransactionReceipt() {
        return { status: 'reverted' as const };
      },
    } as never;
    const walletClient = {
      async writeContract(request: { functionName: string }) {
        writes.push(request.functionName);
        return hash('a');
      },
    } as never;

    const adapter = createTradeWalletAdapter({
      publicClient,
      walletClient,
      account: address('b'),
      chainId: 5_042_002,
    });

    await expect(adapter.ensurePreparedTransactionAllowance(preparedTrade())).rejects.toThrow(/approval.*revert/i);
    expect(writes).toEqual(['approve']);
  });

  it('reads BUY balance from canonical quote asset and SELL balance from the launch token', async () => {
    const reads: `0x${string}`[] = [];
    const publicClient = {
      async readContract(request: { address: `0x${string}`; functionName: string }) {
        expect(request.functionName).toBe('balanceOf');
        reads.push(request.address);
        return request.address === address('2') ? 25_000_000n : 7_000n;
      },
    } as never;

    await expect(
      readSpendableTradeBalance({
        publicClient,
        account: address('b'),
        action: 'BUY',
        tokenAddress: address('a'),
        quoteAsset: address('2'),
      }),
    ).resolves.toBe(25_000_000n);
    await expect(
      readSpendableTradeBalance({
        publicClient,
        account: address('b'),
        action: 'SELL',
        tokenAddress: address('a'),
        quoteAsset: address('2'),
      }),
    ).resolves.toBe(7_000n);
    expect(reads).toEqual([address('2'), address('a')]);
  });

  it('mounts one Wagmi/injected runtime, explicit connect/switch controls and automatic recovery', () => {
    const paths = {
      providers: 'apps/web/components/providers.tsx',
      walletBoundary: 'apps/web/components/wallet/wallet-provider.tsx',
      walletProvider: 'apps/web/components/trade/wallet-trade-provider.tsx',
      runtime: 'apps/web/components/trade/trade-runtime.tsx',
      config: 'apps/web/lib/wallet/config.ts',
    } as const;
    for (const path of Object.values(paths)) expect(existsSync(resolve(root, path))).toBe(true);

    const providers = read(paths.providers);
    const walletBoundary = read(paths.walletBoundary);
    const walletProvider = read(paths.walletProvider);
    const runtime = read(paths.runtime);
    const config = read(paths.config);

    expect(providers).toContain('WalletProvider');
    expect(providers).not.toContain('WagmiProvider');
    expect(walletBoundary).toContain('WagmiProvider');
    expect(walletBoundary).toContain('WalletTradeProvider');
    expect(config).toContain("from 'wagmi/connectors'");
    expect(config).toContain('injected()');
    expect(config).toContain("config/networks/arc-testnet.json");
    expect(config).not.toContain('0x3600000000000000000000000000000000000000');

    for (const hook of [
      'useConnection',
      'useConnect',
      'useConnectors',
      'useSwitchChain',
      'useWalletClient',
      'usePublicClient',
    ]) {
      expect(walletProvider).toContain(hook);
    }
    expect(walletProvider).toContain('TradeRuntimeProvider');
    expect(walletProvider).toContain('recoverPersistedTransactions');
    expect(walletProvider).toContain('recoverPersistedAllowanceTransactions');
    expect(walletProvider).toContain('readSpendableTradeBalance');
    expect(walletProvider).toContain('createTradeWalletAdapter');
    expect(walletProvider).toContain('storage: browserStorage');
    for (const status of ["'DISCONNECTED'", "'WRONG_NETWORK'", "'READY'"]) {
      expect(walletProvider).toContain(status);
    }
    expect(runtime).toContain('walletOptions');
    expect(runtime).toContain('connectWallet');
    expect(runtime).toContain('switchToTargetChain');
  });
});
