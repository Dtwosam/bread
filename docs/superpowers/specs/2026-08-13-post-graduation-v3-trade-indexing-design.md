# Post-Graduation V3 Trade Indexing Design

Date: 2026-08-13
Status: APPROVED DESIGN — IMPLEMENTATION PLAN NOT YET WRITTEN
Scope: Day-9 post-graduation trading continuity only

## Goal

Make Bread's indexed trade history, volume, candles, metrics and token-page trade surfaces remain correct after a launch graduates from its Bread bonding curve into its canonically verified `UNISWAP_V3` TOKEN/USDC pool.

The wallet execution path already selects the canonical active curve or the exact verified graduated V3 pool from fresh chain state. This design closes the downstream indexing/accounting handoff so a successful graduated swap does not become invisible to Bread's read model.

This work is separate from the still-unimplemented Graduated Explore feed. It does not implement Explore ranking/filtering for graduated launches.

## Source Constraints

The design preserves the existing Bread architecture and source-of-truth rules:

- canonical financial identity remains chain-derived;
- indexed state is a rebuildable projection, never financial transaction authority;
- `trades` remains the single normalized trade projection instead of splitting curve and DEX activity into separate ledgers;
- every persisted indexed event remains reorg/rebuild safe through the canonical event journal and block/log identity;
- old curve trades remain backward compatible;
- graduated trading remains DEX-neutral at the Bread boundary: `UNISWAP_V3`, not a vendor-specific family;
- no external DEX API becomes a source of truth for trades, price or volume;
- no new Solidity, token economics, admin authority, graduation accounting or live-chain write is introduced by this indexing lane.

## Current Gap

Today the indexer discovers:

1. the current Bread factory;
2. Bread core contracts;
3. known launch tokens;
4. known bonding curves.

The normalizer assigns Bread roles to those addresses and builds `NormalizedTrade` only from `CURVE` events. The existing public trade shape and database fields also encode curve-specific assumptions such as `curveAddress`, `netCurveInput`, `grossCurveQuoteOut`, and `executionPrice.source = CURVE_EXECUTION`.

After graduation, Router02 sends the swap into the verified V3 pool. The pool emits the canonical `Swap` event, while the launch token still emits ERC-20 `Transfer` events. Therefore holder balances can continue to move through the token log stream, but the current indexer cannot learn the V3 trade itself and consequently cannot update Bread's trade history, trade-count/volume rollups, candles or last execution price from that swap.

## Chosen Architecture

Use one venue-neutral normalized Bread trade projection.

A normalized trade becomes a trade executed on one of the supported canonical venues:

```ts
type TradeVenueKind = 'BREAD_CURVE' | 'UNISWAP_V3';

type NormalizedTrade = Readonly<{
  id: { chainId: number; transactionHash: Hex32; logIndex: number };
  side: 'BUY' | 'SELL';
  token: Address;
  venueKind: TradeVenueKind;
  venueAddress: Address;
  curve: Address | null;
  actor: Address;
  recipient: Address;
  quoteAmount: bigint;
  tokenAmount: bigint;
  venueFeeBps: bigint | null;
  baseFee: bigint;
  creatorTax: bigint;
  openingTaxBps: bigint;
  openingTax: bigint;
  executionPriceNumerator: bigint;
  executionPriceDenominator: bigint;
  blockNumber: bigint;
  blockHash: Hex32;
  blockTimestamp: bigint;
  transactionIndex: number;
  // retained curve-only compatibility fields remain nullable/zero as appropriate
}>;
```

For existing bonding-curve trades:

- `venueKind = BREAD_CURVE`;
- `venueAddress = curve`;
- `curve` remains the existing curve address;
- all existing fee/tax/refund/net-curve fields retain their current semantics.

For graduated V3 trades:

- `venueKind = UNISWAP_V3`;
- `venueAddress = exact verified pool`;
- `curve` remains the launch's historical curve address for launch identity/backward API compatibility, but it is not represented as the execution venue;
- Bread base fee, creator tax and opening tax are all zero;
- `venueFeeBps` records the V3 pool fee tier, e.g. `3000`;
- execution price is derived from exact pool `Swap` amounts, not indexed spot-price guesses;
- curve-only fields are zero/null and must never be interpreted as V3 accounting.

No separate `dex_trades` table is introduced.

## Canonical Graduated-Pool Registry

The indexer needs a rebuildable mapping from exact graduated pool address to launch identity.

This mapping must be derived only from canonical Bread graduation state already retained in the indexed launch/launch-state projection and, when necessary, verified onchain through the launch-snapshotted coordinator/adapter identity.

The minimum registry entry is:

```ts
type KnownGraduatedPool = Readonly<{
  poolAddress: Address;
  tokenAddress: Address;
  curveAddress: Address;
  quoteAsset: Address;
  fee: number;
  stackVersion: string;
  factoryAddress: Address;
  graduationCompletedBlock: bigint;
}>;
```

Rules:

- only `POOL_CREATED` / canonically completed V3 graduations are eligible;
- pool address must be nonzero and exact;
- launch adapter family must be `UNISWAP_V3`;
- TOKEN/USDC pair and fee must be exact;
- the mapping is stack-aware;
- a pool cannot map to two Bread launch tokens within the same chain/stack;
- a conflicting mapping fails the range rather than guessing.

This is a read/indexing registry, not a new source of financial truth.

## Discovery Flow

The existing two-pass Bread discovery remains intact and gains one bounded graduated-pool pass.

For each block range `[fromBlock, toBlock]`:

1. Run the current Bread factory/core/known token+curve discovery.
2. Decode/apply enough canonical Bread graduation information to know the verified graduated-pool registry relevant to this range.
3. Build the exact set of V3 pool addresses whose graduation completed at or before `toBlock` and whose indexed lifetime overlaps the range.
4. Fetch logs for those exact pool addresses over the same `[fromBlock, toBlock]` range.
5. Merge Bread logs and V3 pool logs by canonical `(blockNumber, transactionIndex, logIndex)` order before normalization/apply.

### Same-block graduation and first swap

The design must capture a pool created and traded later in the same block.

A pool discovered from a graduation event inside the current range is re-queried from its graduation block through `toBlock`. This is analogous to Bread's existing launch two-pass behavior, which re-queries dynamic addresses so constructor-era logs are not lost.

No `fromBlock + 1` shortcut is allowed.

### Chunking and RPC bounds

Pool-address queries use the existing bounded address chunking discipline. A large graduated-pool set must be split into deterministic chunks rather than widening to unrestricted chain-wide `Swap` scans.

## V3 Swap Decoding

Use a Bread-local minimal V3 pool event ABI; do not add a vendor SDK dependency.

Canonical event:

```solidity
event Swap(
  address indexed sender,
  address indexed recipient,
  int256 amount0,
  int256 amount1,
  uint160 sqrtPriceX96,
  uint128 liquidity,
  int24 tick
);
```

The pool's canonical TOKEN/USDC ordering comes from the verified graduated-pool registry, not from assumptions about address order.

For an exact TOKEN/USDC V3 swap:

- one amount is positive (input to pool);
- the other is negative (output from pool);
- zero/zero or same-sign amount pairs are invalid for a normalized trade and fail closed.

If USDC is pool token0:

- `amount0 > 0 && amount1 < 0` => BUY token with quote input;
- `amount0 < 0 && amount1 > 0` => SELL token for quote output.

If USDC is pool token1, directions reverse accordingly.

The normalized absolute values become exact `quoteAmount` and `tokenAmount`.

## Actor and Recipient Attribution

The V3 pool `Swap.sender` is not sufficient for Bread user attribution because Router02 can be the pool caller.

For Bread's own post-graduation direct-wallet path:

- `recipient` comes from the canonical V3 `Swap.recipient` field;
- `actor` is derived from the transaction sender (`eth_getTransactionByHash` / equivalent transaction lookup) for the swap transaction;
- the actor must be a valid address;
- transaction lookup is cached/deduplicated per transaction hash within the normalization range.

This lets Bread attribute Router02 trades to the wallet that actually submitted the transaction without pretending the router is the trader.

The indexer may also ingest valid direct pool/router activity not submitted through Bread UI if it targets the exact verified Bread pool. Bread records what happened on the canonical venue; it does not require the transaction to originate from the Bread frontend.

## Event Journal

The canonical event journal is extended to admit a venue role such as `V3_POOL` for exact registered graduated pools.

A retained V3 pool event stores the same canonical identity fields already used for Bread events:

- chain ID;
- transaction hash;
- log index;
- block number/hash/timestamp;
- transaction index;
- contract address;
- stack version;
- token/curve launch association;
- event name/topic/data/payload.

The canonical primary key remains `(chainId, transactionHash, logIndex)`.

This keeps rollback/replay/rebuild semantics uniform instead of maintaining a second DEX-specific journal.

## Database Projection

The existing `trades` table remains the trade ledger and gains venue-neutral columns rather than being replaced.

Required additions:

- `venue_kind` (`BREAD_CURVE` or `UNISWAP_V3`);
- `venue_address`;
- `venue_fee_bps` nullable.

Compatibility:

- existing `curve_address` remains populated for historical launch association;
- existing curve rows are backfilled/treated as `venue_kind = BREAD_CURVE`, `venue_address = curve_address`;
- existing primary key and token/time ordering indexes remain valid;
- no migration may rewrite transaction/log identity;
- curve-only amount columns remain backward compatible and are nullable/zero for V3 as explicitly defined by the repository layer.

A schema migration must be additive and rebuild-safe.

## Public API Contract

`IndexedTokenTrade` becomes venue-aware while retaining old curve fields for compatibility.

Required public additions:

```ts
venue: Readonly<{
  kind: 'BREAD_CURVE' | 'UNISWAP_V3';
  address: string;
  feeBps: string | null;
}>;

executionPrice: Readonly<{
  numerator: string | null;
  denominator: string | null;
  source: 'CURVE_EXECUTION' | 'V3_SWAP_EXECUTION';
}>;
```

For V3 trades:

- `baseFee = 0`;
- `creatorTax = 0`;
- opening-tax values are zero/null according to the existing API's compatibility convention;
- `netCurveInput` and `grossCurveQuoteOut` remain null because no curve execution occurred;
- `executionPrice.source = V3_SWAP_EXECUTION`.

No endpoint split is introduced. Existing token trades pagination continues over one ordered trade stream.

## Candles and Metrics

The existing candle/metrics pipeline must consume venue-neutral normalized trades.

For both curve and V3 trades it uses:

- exact normalized `tokenAmount`;
- exact normalized `quoteAmount`;
- exact execution price numerator/denominator;
- canonical block timestamp;
- canonical transaction/log ordering.

Therefore graduation does not reset or fork token history. The token has one chronological market-data series that spans curve trading followed by V3 trading.

No indexed curve reserve is used to price a V3 swap.

## Token-Page Behavior

The existing Trades, chart and volume surfaces continue to use the same API endpoints.

UI compatibility requirements:

- pre-graduation curve trades render unchanged;
- post-graduation V3 trades appear in the same chronological trade list;
- V3 rows may label the venue as V3/pool, but must not show Bread curve fee/tax labels for the V3 trade;
- chart and volume must continue after graduation instead of freezing at the final curve trade;
- the trade execution panel remains separately chain-authoritative and never uses this indexed projection to select a write route.

This design does not implement the separate Graduated Explore feed.

## Reorg, Replay and Rebuild

V3 events obey the same canonical rollback contract as Bread events.

On reorg/rebuild:

- orphaned pool logs are removed by canonical event identity/block lineage;
- normalized V3 trades, candles and metrics are rebuilt from retained canonical events;
- if the graduation event itself is orphaned, the corresponding pool registry entry and all dependent V3 events in the orphaned branch disappear with it;
- replay is idempotent under the existing `(chainId, transactionHash, logIndex)` identity;
- a pool mapping conflict or malformed Swap fails closed rather than partially applying an ambiguous trade.

## Failure Handling

Fail the affected range before DB commit for:

- unknown/unregistered pool address;
- pool mapped to more than one Bread launch;
- malformed V3 Swap amounts;
- missing exact transaction sender needed for actor attribution;
- pool pair/fee identity inconsistent with the retained canonical graduation mapping;
- unsafe integer conversion or impossible sign semantics;
- contradictory canonical log identity.

Do not silently drop a known registered-pool `Swap` event merely because normalization is inconvenient; silent loss would make volume/history incorrect.

## TDD and Verification

Implementation is TDD-first.

Minimum RED/GREEN coverage must include:

1. discovery of an already-known graduated pool across a normal range;
2. same-block graduation followed by Swap capture;
3. exact address chunking with multiple pools;
4. rejection of unregistered/conflicting pools;
5. BUY and SELL decoding for both token0/token1 orderings;
6. Router02 sender attribution using transaction `from` rather than pool `sender`;
7. exact quote/token amount and execution-price normalization;
8. V3 Bread fee/tax fields remain zero/null as specified;
9. append-only DB write with venue fields;
10. token trades API returns mixed curve+V3 activity in canonical order;
11. candles/volume/trade counts continue across graduation;
12. rollback/replay removes and rebuilds V3 activity deterministically;
13. all existing curve indexing/API tests remain green;
14. post-graduation browser fixture proves a submitted Router02 trade becomes visible in the indexed token read surface once the indexer applies the range.

The final exact-head matrix must include the new indexer/DB/API tests plus the already-authored post-graduation execution/controller/UI/browser tests.

## Explicit Non-Goals

This lane does not:

- implement the Graduated Explore feed;
- add arbitrary multi-hop DEX routing;
- index every V3 pool on Arc;
- trust an explorer or DEX API as canonical trade history;
- add vendor-specific Synthra business logic;
- calculate LP fee revenue accounting not directly represented by Bread's current product contract;
- change launch/graduation Solidity;
- perform a live BTST write before deterministic exact-head verification is green;
- merge PR #93, mark Day 9 PASS, create an RC tag, or start Day 10.

## Rollover / Multi-Stack Compatibility

The indexer and pool registry remain keyed by `chainId + stackVersion + factoryAddress`, consistent with Bread's existing protocol-stack model.

When a future stack is deployed, old launches retain their historical factory/stack and their graduated pools remain independently indexable. The browser execution context has a separate already-documented future requirement to resolve token-specific verified contexts when more than one stack exists; this indexing design must not collapse historical pools into the newest stack.

## Completion Criteria

This design is implementation-complete only when:

- canonical graduated V3 pool swaps enter the event journal;
- one venue-neutral `trades` projection contains both curve and V3 activity;
- API, candles, volume and token trade history continue correctly after graduation;
- reorg/rebuild/replay behavior is proven;
- existing curve behavior remains unchanged;
- exact-head deterministic verification is green;
- external/physical Day-9 gates remain truthfully classified separately.

Until then, the bounded status remains implementation in progress and not Day-9 PASS.
