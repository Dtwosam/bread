import { describe, expect, it } from 'vitest';

import { BreadApiRequestError } from '../../apps/web/lib/api/client';
import { createBreadQueryClient } from '../../apps/web/components/providers';
import { freshnessPresentation } from '../../apps/web/components/freshness-banner';

function requestError(status: number) {
  return new BreadApiRequestError(status, {
    code: status >= 500 ? 'TEMPORARY_FAILURE' : 'INVALID_REQUEST',
    message: 'fixture',
    requestId: `req-${status}`,
  });
}

describe('Day 7 indexed read provider and freshness presentation', () => {
  it('uses bounded retry with no 4xx retry or automatic polling storm', () => {
    const client = createBreadQueryClient();
    const defaults = client.getDefaultOptions().queries;
    const retry = defaults?.retry;

    expect(defaults?.staleTime).toBeTypeOf('number');
    expect(Number(defaults?.staleTime)).toBeGreaterThan(0);
    expect(defaults?.refetchInterval).toBeFalsy();
    expect(typeof retry).toBe('function');

    const retryFn = retry as (failureCount: number, error: Error) => boolean;
    expect(retryFn(0, requestError(400))).toBe(false);
    expect(retryFn(0, requestError(404))).toBe(false);
    expect(retryFn(0, requestError(503))).toBe(true);
    expect(retryFn(1, requestError(503))).toBe(false);
    expect(retryFn(0, new Error('network'))).toBe(true);
    expect(retryFn(1, new Error('network'))).toBe(false);
  });

  it('maps only server-owned freshness states to truthful user presentation', () => {
    expect(freshnessPresentation('FRESH')).toBeNull();
    expect(freshnessPresentation('LAGGING')).toEqual({
      tone: 'warning',
      title: 'Indexed data is delayed',
      detail: 'Bread is showing the latest committed indexed data while the indexer catches up.',
    });
    expect(freshnessPresentation('REBUILDING')).toEqual({
      tone: 'warning',
      title: 'Indexed data is rebuilding',
      detail: 'Some indexed views may be incomplete until the rebuild reaches the current chain state.',
    });
    expect(freshnessPresentation('DEGRADED')).toEqual({
      tone: 'negative',
      title: 'Indexed data is degraded',
      detail: 'Some indexed views may be unavailable. Bread will not substitute unverified primary RPC data.',
    });
  });
});
