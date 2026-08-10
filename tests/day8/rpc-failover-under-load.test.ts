import { describe, expect, it } from 'vitest';

import { discoverRange, type LogClient, type RpcLog } from '../../apps/indexer/src/discovery.ts';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.ts';

const address = (value: number) => `0x${value.toString(16).padStart(40, '0')}` as `0x${string}`;

const context: ProtocolContext = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'day8-rpc-failover-test-only',
  factoryAddress: address(1),
  quoteAsset: address(2),
  quoteDecimals: 6,
  deploymentStartBlock: 100n,
  addresses: {
    factory: address(1),
    deployer: address(3),
    feePolicy: address(4),
    feeEscrow: address(5),
    emergencyController: address(6),
    locker: address(7),
    coordinator: address(8),
    graduationAdapter: address(9),
  },
};

type FailoverModule = Readonly<{
  createBoundedRpcFailoverLogClient: (input: Readonly<{
    providers: readonly Readonly<{ name: string; client: LogClient }>[];
    maxConcurrentPerProvider: number;
    maxQueuedPerProvider: number;
    failureThreshold: number;
    cooldownMs: number;
    nowMs?: () => number;
    shouldFailover: (error: unknown) => boolean;
  }>) => LogClient;
}>;

async function loadFailoverModule(): Promise<FailoverModule | null> {
  const path = '../../apps/indexer/src/rpc-failover.ts';
  try {
    return await import(/* @vite-ignore */ path) as FailoverModule;
  } catch {
    return null;
  }
}

function trackedClient(input: Readonly<{
  run: () => Promise<readonly RpcLog[]>;
}>): Readonly<{
  client: LogClient;
  calls: () => number;
  maxActive: () => number;
}> {
  let calls = 0;
  let active = 0;
  let maxActive = 0;
  return {
    client: {
      getLogs: async () => {
        calls += 1;
        active += 1;
        maxActive = Math.max(maxActive, active);
        try {
          await new Promise((resolve) => setTimeout(resolve, 2));
          return await input.run();
        } finally {
          active -= 1;
        }
      },
    },
    calls: () => calls,
    maxActive: () => maxActive,
  };
}

describe('Day 8 06I RPC failover under load', () => {
  it('circuit-breaks a failed primary, bounds provider concurrency, and serves 200 concurrent reads without retry amplification', async () => {
    const module = await loadFailoverModule();
    expect(module?.createBoundedRpcFailoverLogClient).toBeTypeOf('function');
    if (!module) return;

    const primary = trackedClient({
      run: async () => {
        throw new Error('primary RPC unavailable');
      },
    });
    const secondary = trackedClient({ run: async () => [] });
    const client = module.createBoundedRpcFailoverLogClient({
      providers: [
        { name: 'primary', client: primary.client },
        { name: 'secondary', client: secondary.client },
      ],
      maxConcurrentPerProvider: 8,
      maxQueuedPerProvider: 256,
      failureThreshold: 2,
      cooldownMs: 10_000,
      shouldFailover: () => true,
    });

    const results = await Promise.all(Array.from({ length: 200 }, () => client.getLogs({
      address: context.factoryAddress,
      fromBlock: 100n,
      toBlock: 120n,
    })));

    expect(results).toHaveLength(200);
    expect(results.every((logs) => logs.length === 0)).toBe(true);
    expect(primary.maxActive()).toBeLessThanOrEqual(8);
    expect(secondary.maxActive()).toBeLessThanOrEqual(8);
    expect(primary.calls()).toBeLessThanOrEqual(8);
    expect(secondary.calls()).toBe(200);
    expect(primary.calls() + secondary.calls()).toBeLessThanOrEqual(208);

    const primaryCallsBeforeDiscovery = primary.calls();
    await expect(discoverRange(client, context, [], 100n, 120n)).resolves.toEqual([]);
    expect(primary.calls()).toBe(primaryCallsBeforeDiscovery);
  });

  it('does not hide a non-failover RPC error behind another provider', async () => {
    const module = await loadFailoverModule();
    expect(module?.createBoundedRpcFailoverLogClient).toBeTypeOf('function');
    if (!module) return;

    const primary = trackedClient({
      run: async () => {
        throw new Error('invalid RPC request');
      },
    });
    const secondary = trackedClient({ run: async () => [] });
    const client = module.createBoundedRpcFailoverLogClient({
      providers: [
        { name: 'primary', client: primary.client },
        { name: 'secondary', client: secondary.client },
      ],
      maxConcurrentPerProvider: 2,
      maxQueuedPerProvider: 4,
      failureThreshold: 1,
      cooldownMs: 1_000,
      shouldFailover: () => false,
    });

    await expect(client.getLogs({ fromBlock: 100n, toBlock: 101n })).rejects.toThrow('invalid RPC request');
    expect(primary.calls()).toBe(1);
    expect(secondary.calls()).toBe(0);
  });
});
