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

export type IndexedPriceSummary = Readonly<{
  numerator: string;
  denominator: string;
  source: string;
}>;

export type IndexedTradeMetricsSummary = Readonly<{
  lastPrice: IndexedPriceSummary;
  quoteVolume: Readonly<{
    m5: string | null;
    h1: string | null;
    h24: string | null;
  }>;
  tradeCount: Readonly<{
    h1: string | null;
    h24: string | null;
  }>;
  uniqueTraders: Readonly<{
    h1: string | null;
    h24: string | null;
  }>;
}>;

export type IndexedGraduationProgressSummary = Readonly<{
  progressBps: string | null;
  state: string | null;
}>;

export type IndexedFeedItem = Readonly<{
  tokenAddress: string;
  curveAddress: string;
  stackVersion: string;
  factoryAddress: string;
  deployerAddress: string;
  creatorFeeRecipient: string;
  creatorTaxBps: string | null;
  economicsDigest: string | null;
  configVersion: string | null;
  launchTimestamp: string | null;
  name: string | null;
  symbol: string | null;
  metadata: unknown;
  quoteAsset: string | null;
  initialSupply: string | null;
  phantomQuote: string | null;
  graduationThreshold: string | null;
  protocolFeeRecipient: string | null;
  tradeFeeBps: string | null;
  protocolFeeShareBps: string | null;
  maxCreatorTaxBps: string | null;
  graduationCoordinator: string | null;
  graduationAdapter: string | null;
  graduationAdapterFamily: string | null;
  graduationConfigHash: string | null;
  reservedTokensBaseline: string | null;
  launchBlockNumber: string;
  launchTransactionHash: string;
  launchLogIndex: number;
  metrics: IndexedTradeMetricsSummary | null;
  progress: IndexedGraduationProgressSummary | null;
}>;

export type IndexedSearchResult = Readonly<{
  tokenAddress: string;
  curveAddress: string;
  deployerAddress: string;
  creatorFeeRecipient: string;
  name: string | null;
  symbol: string | null;
  matchKind: string;
}>;
