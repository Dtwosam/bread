import type { Hex32 } from './identity.js';

export type FreshnessStatus = 'FRESH' | 'LAGGING' | 'REBUILDING' | 'DEGRADED';
export type CacheState = 'HIT' | 'MISS' | 'BYPASS' | 'UNAVAILABLE';

export type FreshnessMeta = Readonly<{
  chainId: number;
  schemaVersion: string;
  indexedThroughBlock: string;
  indexedThroughBlockHash: Hex32;
  indexedThroughBlockTimestamp: string;
  servedAt: string;
  source: 'bread-indexer';
  status: FreshnessStatus;
  observedHeadBlock?: string;
  lagBlocks?: string;
  cache?: CacheState;
  stackVersion?: string;
}>;

export type CursorPageMeta = Readonly<{
  nextCursor?: string;
  hasMore: boolean;
}>;

export type IndexedResponse<T> = Readonly<{
  data: T;
  meta: FreshnessMeta;
  page?: CursorPageMeta;
}>;

export type ApiError = Readonly<{
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: Readonly<Record<string, string | number | boolean>>;
  };
}>;
