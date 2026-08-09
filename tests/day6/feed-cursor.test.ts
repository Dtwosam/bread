import { describe, expect, it } from 'vitest';

import type { Address, Hex32 } from '../../packages/types/src/index.js';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';

const address = (nibble: string) => `0x${nibble.repeat(40)}` as Address;
const factory = address('1');
const context: ProtocolContext = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'task4-test-stack',
  factoryAddress: factory,
  quoteAsset: address('2'),
  quoteDecimals: 6,
  deploymentStartBlock: 100n,
  addresses: {
    factory,
    deployer: address('3'),
    feePolicy: address('4'),
    feeEscrow: address('5'),
    emergencyController: address('6'),
    locker: address('7'),
    coordinator: address('8'),
    graduationAdapter: address('9'),
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

describe('Day 6 Task 4 feed cursor contract', () => {
  it('round-trips a bounded versioned opaque New-feed sort key and rejects bad cursors', async () => {
    const module = await optionalModule('../../apps/api/src/pagination.ts');
    const encodeNewFeedCursor = module.encodeNewFeedCursor as
      | ((input: Record<string, unknown>) => string)
      | undefined;
    const decodeNewFeedCursor = module.decodeNewFeedCursor as
      | ((input: string) => Readonly<Record<string, unknown>>)
      | undefined;

    expect(encodeNewFeedCursor).toBeTypeOf('function');
    expect(decodeNewFeedCursor).toBeTypeOf('function');

    const key = {
      version: 1,
      launchBlockNumber: '123',
      launchTimestamp: '456',
      launchLogIndex: 7,
      tokenAddress: address('a'),
    };
    const cursor = encodeNewFeedCursor?.(key);
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(cursor!.length).toBeLessThanOrEqual(512);
    expect(decodeNewFeedCursor?.(cursor!)).toEqual(key);

    expect(() => decodeNewFeedCursor?.('not-a-valid-cursor')).toThrow();
    const unknownVersion = encodeNewFeedCursor?.({ ...key, version: 2 });
    expect(() => decodeNewFeedCursor?.(unknownVersion!)).toThrow(/version/i);
    expect(() => decodeNewFeedCursor?.('a'.repeat(513))).toThrow(/cursor/i);
  });

  it('returns bounded 400 before DB work for a malformed feed cursor', async () => {
    const serverModule = await optionalModule('../../apps/api/src/server.ts');
    const createBreadApi = serverModule.createBreadApi as
      | ((input: Record<string, unknown>) => {
          inject: (input: Record<string, unknown>) => Promise<{ statusCode: number; json: () => unknown }>;
          close: () => Promise<void>;
        })
      | undefined;
    expect(createBreadApi).toBeTypeOf('function');

    const app = createBreadApi?.({
      db: {},
      context,
      observedHeadBlock: async () => 100n,
      now: () => new Date('2026-08-09T12:00:00.000Z'),
    });
    expect(app).toBeDefined();
    const response = await app!.inject({ method: 'GET', url: '/v1/feed?view=new&cursor=not-a-valid-cursor' });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'INVALID_CURSOR' } });
    await app!.close();
  });
});
