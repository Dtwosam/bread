import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import type { FreshnessMeta, IndexedResponse } from '../../packages/types/src/index';
import {
  BreadApiRequestError,
  classifyFreshness,
  createBreadApiClient,
} from '../../apps/web/lib/api/client';
import { breadQueryKeys } from '../../apps/web/lib/api/queries';

const meta: FreshnessMeta = {
  chainId: 5042002,
  schemaVersion: 'day6-v1',
  indexedThroughBlock: '123',
  indexedThroughBlockHash: `0x${'11'.repeat(32)}` as `0x${string}`,
  indexedThroughBlockTimestamp: '1754780000',
  servedAt: '2026-08-10T00:00:00.000Z',
  source: 'bread-indexer',
  status: 'LAGGING',
  observedHeadBlock: '125',
  lagBlocks: '2',
  cache: 'HIT',
  stackVersion: 'test-stack',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('Day 7 indexed browser read boundary', () => {
  it('preserves canonical IndexedResponse freshness/page metadata and bounded feed serialization', async () => {
    const expected: IndexedResponse<readonly { tokenAddress: string }[]> = {
      data: [{ tokenAddress: '0xabc' }],
      meta,
      page: { hasMore: true, nextCursor: 'next-cursor' },
    };
    const fetchImpl = vi.fn(async () => jsonResponse(expected));
    const client = createBreadApiClient({ baseUrl: 'https://bread.test', fetchImpl });

    const result = await client.getFeed<readonly { tokenAddress: string }[]>({
      view: 'new',
      limit: 25,
      cursor: 'cursor-1',
    });

    expect(result).toEqual(expected);
    expect(result.meta).toEqual(meta);
    expect(result.page).toEqual(expected.page);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      'https://bread.test/v1/feed?view=new&limit=25&cursor=cursor-1',
    );
  });

  it('serializes supported Explore Age filters without frontend classification', async () => {
    const expected: IndexedResponse<readonly { tokenAddress: string }[]> = {
      data: [],
      meta,
      page: { hasMore: false },
    };
    const fetchImpl = vi.fn(async () => jsonResponse(expected));
    const client = createBreadApiClient({ baseUrl: 'https://bread.test', fetchImpl });

    await client.getFeed({ view: 'trending', age: 'lt5m', limit: 25 });

    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      'https://bread.test/v1/feed?view=trending&age=lt5m&limit=25',
    );
  });

  it('serializes source-backed lifecycle filtering without changing exact result labels', async () => {
    const expected: IndexedResponse<readonly { tokenAddress: string }[]> = {
      data: [],
      meta,
      page: { hasMore: false },
    };
    const fetchImpl = vi.fn(async () => jsonResponse(expected));
    const client = createBreadApiClient({ baseUrl: 'https://bread.test', fetchImpl });

    await client.getFeed({ view: 'new', lifecycle: 'processing', limit: 25 });

    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      'https://bread.test/v1/feed?view=new&lifecycle=processing&limit=25',
    );
  });

  it('rejects out-of-contract bounded query values before network work', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: [], meta }));
    const client = createBreadApiClient({ fetchImpl });

    await expect(client.getFeed({ limit: 101 })).rejects.toThrow(/limit/i);
    await expect(client.search({ q: 'ab', limit: 51 })).rejects.toThrow(/limit/i);
    await expect(client.getTrades('0xabc', { cursor: 'x'.repeat(513) })).rejects.toThrow(/cursor/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('surfaces canonical API errors with HTTP status, code and request identity', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        {
          error: {
            code: 'FEED_VIEW_NOT_READY',
            message: 'This deterministic feed projection is not available yet.',
            requestId: 'req-123',
          },
        },
        503,
      ),
    );
    const client = createBreadApiClient({ fetchImpl });

    const error = await client.getFeed({ view: 'trending' }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(BreadApiRequestError);
    expect(error).toMatchObject({
      status: 503,
      code: 'FEED_VIEW_NOT_READY',
      requestId: 'req-123',
    });
  });

  it('uses the server-owned FreshnessStatus directly without frontend thresholds', () => {
    expect(classifyFreshness({ ...meta, status: 'FRESH' })).toBe('FRESH');
    expect(classifyFreshness({ ...meta, status: 'LAGGING' })).toBe('LAGGING');
    expect(classifyFreshness({ ...meta, status: 'REBUILDING' })).toBe('REBUILDING');
    expect(classifyFreshness({ ...meta, status: 'DEGRADED' })).toBe('DEGRADED');
  });

  it('creates deterministic primitive query keys for shared-request deduplication', () => {
    expect(breadQueryKeys.feed({ view: 'new', limit: 25, cursor: 'abc' })).toEqual([
      'bread',
      'feed',
      'new',
      'default',
      '',
      'any',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      25,
      'abc',
    ]);
    expect(breadQueryKeys.feed({ view: 'new', age: 'lt5m', limit: 25, cursor: 'abc' })).toEqual([
      'bread',
      'feed',
      'new',
      'default',
      '',
      'lt5m',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      25,
      'abc',
    ]);
    expect(
      breadQueryKeys.feed({
        view: 'new',
        sort: 'market-cap',
        lifecycle: 'processing',
        marketCapMinQuote: '1000000',
        marketCapMaxQuote: '5000000',
        limit: 25,
      }),
    ).toEqual([
      'bread',
      'feed',
      'new',
      'market-cap',
      'processing',
      'any',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '1000000',
      '5000000',
      25,
      '',
    ]);
    expect(breadQueryKeys.search({ q: 'bread', limit: 10 })).toEqual([
      'bread',
      'search',
      'bread',
      10,
    ]);
    expect(breadQueryKeys.token('0xABC')).toEqual(['bread', 'token', '0xabc']);
    expect(breadQueryKeys.status()).toEqual(['bread', 'status']);
  });

  it('keeps primary browser reads free of viem/wagmi/raw-RPC imports', () => {
    for (const path of [
      '../../apps/web/lib/api/client.ts',
      '../../apps/web/lib/api/queries.ts',
    ]) {
      const source = readFileSync(new URL(path, import.meta.url), 'utf8');
      expect(source).not.toMatch(/from ['\"]viem['\"]/);
      expect(source).not.toMatch(/from ['\"]wagmi['\"]/);
      expect(source).not.toMatch(/createPublicClient|eth_call|request\s*\(\s*\{\s*method:\s*['\"]eth_/);
    }
  });
});
