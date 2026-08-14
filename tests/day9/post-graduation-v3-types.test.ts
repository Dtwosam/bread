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

export type Day9V3TypeContractAssertions = readonly [
  VenueKindsAreExact,
  PriceSourcesAreExact,
  PublicVenueIsExact,
  PublicPriceSourceUsesSharedContract,
];
