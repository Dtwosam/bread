import { describe, expect, it } from 'vitest';

import type { Address, FreshnessMeta, Hex32 } from '../../packages/types/src/index.js';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';

const address = (nibble: string) => `0x${nibble.repeat(40)}` as Address;
const hash = (nibble: string) => `0x${nibble.repeat(64)}` as Hex32;

const factory = address('1');
const token = address('2');
const curve = address('3');
const context: ProtocolContext = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'task4-test-stack',
  factoryAddress: factory,
  quoteAsset: address('4'),
  quoteDecimals: 6,
  deploymentStartBlock: 100n,
  addresses: {
    factory,
    deployer: address('5'),
    feePolicy: address('6'),
    feeEscrow: address('7'),
    emergencyController: address('8'),
    locker: address('9'),
    coordinator: address('a'),
    graduationAdapter: address('b'),
  },
};

async function optionalModule(relativePath: string): Promise<Record<string, unknown>> {
  const href = new URL(relativePath, import.meta.url).href;
  try {
    return (await import(/* @vite-ignore */ href)) as Record<string, unknown>;
  } catch (error) {
    const code = (error as { code?: string }).code;
    const message = error instanceof Error ? error.message : String(error);
    if (code === 'ERR_MODULE_NOT_FOUND' || /cannot find module|failed to load url/i.test(message)) return {};
    throw error;
  }
}

describe('Day 6 Task 4 source conformance', () => {
  it('classifies a later-range event from a previously indexed launch address', async () => {
    const module = await optionalModule('../../apps/indexer/src/normalize.ts');
    const normalizeTransactionLogs = module.normalizeTransactionLogs as
      | ((input: Record<string, unknown>) => Promise<{ events: ReadonlyArray<{ contractRole: string; eventName: string }> }>)
      | undefined;
    expect(normalizeTransactionLogs).toBeTypeOf('function');

    const events = await normalizeTransactionLogs?.({
      client: { readContract: async () => { throw new Error('no immutable read expected'); } },
      context,
      knownLaunches: [{ tokenAddress: token, curveAddress: curve }],
      toBlock: 101n,
      toBlockTimestamp: 1_786_262_401n,
      logs: [
        {
          address: token,
          blockNumber: 101n,
          blockHash: hash('c'),
          transactionHash: hash('d'),
          transactionIndex: 1,
          logIndex: 2,
          eventName: 'Transfer',
          args: { from: curve, to: address('e'), value: 1n },
          topics: [hash('f')],
          data: '0x',
        },
      ],
    });

    expect(events?.events).toEqual([
      expect.objectContaining({ contractRole: 'LAUNCH_TOKEN', eventName: 'Transfer' }),
    ]);
  });

  it('sanitizes unsafe display metadata before persistence', async () => {
    const module = await optionalModule('../../apps/indexer/src/normalize.ts');
    const sanitizeDisplayMetadata = module.sanitizeDisplayMetadata as
      | ((input: Readonly<Record<string, unknown>>) => Readonly<Record<string, unknown>>)
      | undefined;
    expect(sanitizeDisplayMetadata).toBeTypeOf('function');

    const result = sanitizeDisplayMetadata?.({
      logo: 'data:text/html,<script>alert(1)</script>',
      description: `safe\u0000text${'x'.repeat(10_000)}`,
      socials: {
        twitter: 'javascript:alert(1)',
        telegram: '',
        discord: '',
        website: 'https://bread.test/path',
        farcaster: 'data:text/plain,bad',
      },
    }) as { logo?: string; description?: string; socials?: Record<string, string> } | undefined;

    expect(result?.logo).toBe('');
    expect(result?.socials?.twitter).toBe('');
    expect(result?.socials?.farcaster).toBe('');
    expect(result?.socials?.website).toBe('https://bread.test/path');
    expect(result?.description).not.toContain('\u0000');
    expect((result?.description?.length ?? 0)).toBeLessThan(10_000);
  });

  it('status data exposes observed head and derived lag without secrets', async () => {
    const module = await optionalModule('../../apps/api/src/routes/status.ts');
    const buildStatusData = module.buildStatusData as
      | ((checkpoint: Record<string, unknown>, meta: FreshnessMeta) => Readonly<Record<string, unknown>>)
      | undefined;
    expect(buildStatusData).toBeTypeOf('function');

    const meta: FreshnessMeta = {
      chainId: context.chainId,
      schemaVersion: 'day6-v1',
      indexedThroughBlock: '100',
      indexedThroughBlockHash: hash('1'),
      indexedThroughBlockTimestamp: '1786262400',
      servedAt: '2026-08-09T12:00:00.000Z',
      source: 'bread-indexer',
      status: 'LAGGING',
      observedHeadBlock: '103',
      lagBlocks: '3',
      cache: 'BYPASS',
      stackVersion: context.stackVersion,
    };
    const data = buildStatusData?.(
      {
        chainId: context.chainId,
        stackVersion: context.stackVersion,
        factoryAddress: factory,
        deploymentStartBlock: 100n,
        indexedThroughBlock: 100n,
        indexedThroughBlockHash: hash('1'),
        indexedThroughBlockTimestamp: 1_786_262_400n,
        decoderSchemaVersion: 'day6-v1',
        status: 'COMMITTED',
      },
      meta,
    );

    expect(data).toMatchObject({
      observedHeadBlock: '103',
      lagBlocks: '3',
      health: { db: 'HEALTHY', indexer: 'LAGGING' },
    });
    expect(JSON.stringify(data)).not.toMatch(/password|secret|dsn|rpcUrl/i);
  });
});
