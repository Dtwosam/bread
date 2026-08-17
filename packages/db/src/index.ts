export const DB_STATUS = "day6-transaction-boundary" as const;

export {
  breadDbSchema,
  createBreadDb,
  migrateBreadDb,
  type BreadDb,
  type BreadPgPool,
} from "./client.js";

export { eventJournal } from "./schema/event-journal.js";
export {
  adminEvents,
  creatorRollups,
  feeClaims,
  feeCredits,
  holderSnapshots,
  indexerCheckpoints,
  launches,
  launchState,
  marketCandles,
  metadata,
  protocolStacks,
  tokenMetrics,
  trades,
} from "./schema/projections.js";

export {
  DAY6_DB_SCHEMA_VERSION,
  IndexerRepository,
  type ApplyCanonicalRangeInput,
  type ApplyCanonicalRangeResult,
  type CanonicalEventIdentity,
  type CanonicalIndexedEvent,
  type IndexerProtocolContext,
  type ProjectionReducer,
} from "./repositories/indexer.js";

export { ReadRepository, decimalIntegerToBigInt } from "./repositories/read.js";
export {
  SecondaryRepository,
  type PlatformActivityRow,
  type PlatformStatsRow,
} from "./repositories/secondary.js";
export {
  EXPLORE_AGE_FILTERS,
  isExploreAgeFilter,
  resolveExploreAgeBounds,
  type ExploreAgeBounds,
  type ExploreAgeFilter,
} from "./repositories/explore-age.js";
export {
  ExploreAgeReadRepository,
  type AgeFilteredGraduatedCursorKey,
  type AgeFilteredNewCursorKey,
} from "./repositories/explore-age-read.js";
export {
  parseExploreHolderBounds,
  type ExploreHolderBounds,
} from "./repositories/explore-holders.js";
export {
  parseExploreProgressBounds,
  type ExploreProgressBounds,
} from "./repositories/explore-progress.js";
export {
  parseExploreVolumeBounds,
  type ExploreVolumeBounds,
} from "./repositories/explore-volume.js";
export {
  AlmostBakedRepository,
  type AlmostBakedLaunchCursorKey,
} from "./repositories/almost-baked.js";
export {
  TrendingRepository,
  type TrendingLaunchCursorKey,
} from "./repositories/trending.js";
export {
  SearchRepository,
  type SearchLaunchInput,
  type SearchLaunchRow,
} from "./repositories/search.js";
export {
  RebuildRepository,
  type ReconciliationLaunchRow,
  type ReconciliationLaunchStateRow,
  type ReconciliationSnapshot,
  type ReconciliationStackRow,
} from "./repositories/rebuild.js";
export {
  applyCanonicalTradeProjection,
  type CanonicalTradeProjection,
} from "./repositories/trades.js";
export {
  applyFeeAdminGraduationProjection,
  type VerifiedGraduatedVenueProjection,
} from "./repositories/verified-graduation.js";
export { projectCurveGraduationProgress } from "./repositories/graduation-progress.js";
export {
  incrementCreatorTradeCountForToken,
  projectCreatorTradeCount,
} from "./repositories/creator-trade-count.js";
export { CreatorRepository } from "./repositories/creators.js";
export {
  applyHolderTransferProjection,
  type HolderProjectionContext,
} from "./repositories/holders.js";