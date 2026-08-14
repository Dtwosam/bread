import type { CanonicalTradeProjection } from "../../packages/db/src/index.js";
import type {
  IndexedTokenTrade,
  TradeExecutionPriceSource,
  TradeVenueKind,
} from "../../packages/types/src/index.js";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? (<Value>() => Value extends Right ? 1 : 2) extends <
        Value,
      >() => Value extends Left ? 1 : 2
      ? true
      : false
    : false;

type Assert<Condition extends true> = Condition;

type ExpectedVenue = Readonly<{
  kind: TradeVenueKind;
  address: string;
  feeTier: string | null;
}>;

type VenueKindsAreExact = Assert<
  Equal<TradeVenueKind, "BREAD_CURVE" | "UNISWAP_V3">
>;
type PriceSourcesAreExact = Assert<
  Equal<TradeExecutionPriceSource, "CURVE_EXECUTION" | "V3_SWAP_EXECUTION">
>;
type PublicVenueIsExact = Assert<
  Equal<IndexedTokenTrade["venue"], ExpectedVenue>
>;
type PublicPriceSourceUsesSharedContract = Assert<
  Equal<
    IndexedTokenTrade["executionPrice"]["source"],
    TradeExecutionPriceSource
  >
>;

const v3Projection = {
  id: {
    chainId: 5_042_002,
    transactionHash: `0x${"11".repeat(32)}`,
    logIndex: 7,
  },
  stackVersion: "day9-v3-types",
  side: "BUY",
  token: `0x${"1".repeat(40)}`,
  curve: `0x${"2".repeat(40)}`,
  actor: `0x${"3".repeat(40)}`,
  recipient: `0x${"4".repeat(40)}`,
  venueKind: "UNISWAP_V3",
  venueAddress: `0x${"5".repeat(40)}`,
  venueFeeTier: 3000,
  offeredQuote: null,
  quoteAmount: 125n,
  tokenAmount: 50n,
  baseFee: 0n,
  creatorTax: 0n,
  openingTaxBps: 0n,
  openingTax: 0n,
  launchBuyExempt: null,
  refund: null,
  netCurveInput: null,
  netQuoteOut: null,
  grossCurveQuoteOut: null,
  executionPriceNumerator: 125n,
  executionPriceDenominator: 50n,
  blockNumber: 500n,
  blockTimestamp: 1_786_262_900n,
  transactionIndex: 3,
} satisfies CanonicalTradeProjection;

type V3ProjectionVenueIsExact = Assert<
  Equal<typeof v3Projection.venueKind, "UNISWAP_V3">
>;

export type Day9V3TypeContractAssertions = readonly [
  VenueKindsAreExact,
  PriceSourcesAreExact,
  PublicVenueIsExact,
  PublicPriceSourceUsesSharedContract,
  V3ProjectionVenueIsExact,
];
