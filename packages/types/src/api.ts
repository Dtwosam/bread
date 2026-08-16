import type { Hex32 } from "./identity.js";
import type {
  TradeExecutionPriceSource,
  TradeVenueKind,
} from "./trading.js";

export type FreshnessStatus = "FRESH" | "LAGGING" | "REBUILDING" | "DEGRADED";
export type CacheState = "HIT" | "MISS" | "BYPASS" | "UNAVAILABLE";

export type FreshnessMeta = Readonly<{
  chainId: number;
  schemaVersion: string;
  indexedThroughBlock: string;
  indexedThroughBlockHash: Hex32;
  indexedThroughBlockTimestamp: string;
  servedAt: string;
  source: "bread-indexer";
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
  holderCount: string | null;
  graduatedVenueKind: string | null;
  metrics: IndexedTradeMetricsSummary | null;
  progress: IndexedGraduationProgressSummary | null;
}>;

export type IndexedSearchLifecycleState =
  | "PROCESSING"
  | "GRADUATION_PENDING"
  | "GRADUATED";

export type IndexedSearchResult = Readonly<{
  tokenAddress: string;
  curveAddress: string;
  deployerAddress: string;
  creatorFeeRecipient: string;
  name: string | null;
  symbol: string | null;
  matchKind: string;
  ageSeconds: string | null;
  holderCount: string | null;
  marketCap: string | null;
  lifecycleState: IndexedSearchLifecycleState | null;
}>;

export type IndexedCurveStateSummary = Readonly<{
  mode: string | null;
  trackedQuote: string | null;
  trackedTokens: string | null;
  quoteFeeBalance: string | null;
  creatorTaxBalance: string | null;
  realQuoteReserve: string | null;
  virtualQuoteReserve: string | null;
  remainingSellableTokens: string | null;
  trackedSoldInventory: string | null;
  readyToGraduate: boolean | null;
  graduationPhase: string | null;
  poolId: string | null;
  graduationAdapter: string | null;
  sweptUsdcAmount: string | null;
  sweptTokenAmount: string | null;
  graduationFailureReasonHash: string | null;
  positionManager: string | null;
  positionId: string | null;
  usdcUsed: string | null;
  tokenUsed: string | null;
  tokenLocked: string | null;
  usdcDust: string | null;
  positionLocked: boolean | null;
  tokenSupplyLocked: string | null;
  graduationCompletedBlock: string | null;
  graduationCompletedLogIndex: number | null;
  latestBlockNumber: string | null;
  latestTransactionHash: string | null;
  latestLogIndex: number | null;
}>;

export type IndexedTokenDetail = Omit<
  IndexedFeedItem,
  "deployerAddress" | "creatorFeeRecipient" | "graduationAdapterFamily"
> &
  Readonly<{
    deployerAddress: string | null;
    creatorFeeRecipient: string | null;
    graduationAdapterFamily: number | null;
    curveState: IndexedCurveStateSummary | null;
  }>;

export type IndexedTokenTrade = Readonly<{
  id: Readonly<{
    chainId: number;
    transactionHash: string;
    logIndex: number;
  }>;
  transactionHash: string;
  logIndex: number;
  side: string;
  tokenAddress: string;
  curveAddress: string;
  actor: string;
  recipient: string;
  venue: Readonly<{
    kind: TradeVenueKind;
    address: string;
    feeTier: string | null;
  }>;
  tokenAmount: string;
  quoteAmount: string;
  baseFee: string;
  creatorTax: string;
  offeredQuote: string | null;
  openingTaxBps: string | null;
  openingTax: string | null;
  launchBuyExempt: boolean | null;
  refund: string | null;
  netCurveInput: string | null;
  netQuoteOut: string | null;
  grossCurveQuoteOut: string | null;
  executionPrice: Readonly<{
    numerator: string | null;
    denominator: string | null;
    source: TradeExecutionPriceSource;
  }>;
  blockNumber: string;
  blockTimestamp: string | null;
  transactionIndex: number;
  stackVersion: string;
}>;

export type IndexedTokenHolder = Readonly<{
  walletAddress: string;
  balance: string;
  isProtocolAddress: boolean;
  asOfBlockNumber: string;
  lastEvent: Readonly<{ transactionHash: string; logIndex: number }> | null;
}>;

export type IndexedTokenHolders = Readonly<{
  tokenAddress: string;
  holders: readonly IndexedTokenHolder[];
  concentration: Readonly<{
    top10ExcludesProtocolAddresses: true;
    top10NonProtocolBalance: string;
    supply: string | null;
    holderCount: string;
    userHolderCount: string;
  }>;
}>;
