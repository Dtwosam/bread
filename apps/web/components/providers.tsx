'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { BreadApiRequestError } from '../lib/api/client';

const READ_STALE_TIME_MS = 5_000;
const READ_GC_TIME_MS = 5 * 60_000;

function retryIndexedRead(failureCount: number, error: unknown): boolean {
  if (error instanceof BreadApiRequestError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < 1;
}

export function createBreadQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: READ_STALE_TIME_MS,
        gcTime: READ_GC_TIME_MS,
        retry: retryIndexedRead,
        retryDelay: 250,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
    },
  });
}

export function Providers({ children }: Readonly<{ children: ReactNode }>) {
  const [queryClient] = useState(createBreadQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
