'use client';

import { useQuery } from '@tanstack/react-query';
import { LiveActivityStrip, type LiveActivityStatus } from '@bread/ui';
import { useMemo } from 'react';

import { createBreadApiClient } from '../lib/api/client';
import { breadQueryKeys } from '../lib/api/queries';

export function LiveActivityStripStatus() {
  const api = useMemo(() => createBreadApiClient(), []);
  const query = useQuery({
    queryKey: breadQueryKeys.status(),
    queryFn: () => api.getStatus(),
    staleTime: 10_000,
    refetchInterval: 15_000,
    retry: 1,
  });

  const status: LiveActivityStatus = query.isError
    ? 'UNAVAILABLE'
    : query.data?.meta.status ?? 'CHECKING';

  return (
    <LiveActivityStrip
      status={status}
      indexedThroughBlock={query.data?.meta.indexedThroughBlock ?? null}
    />
  );
}
