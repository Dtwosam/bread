# Post-Graduation V3 Trade Indexing Implementation Plan

Date: 2026-08-13
Status: IMPLEMENTATION PLAN — APPROVED DESIGN EXECUTION ONLY
Scope: Day-9 post-graduation V3 trade indexing continuity

> Required method: execute this plan as small RED -> GREEN TDD slices. Do not write production behavior for a slice until its real repository test has been observed failing for the intended missing behavior.

## Goal

Implement the already-approved `docs/superpowers/specs/2026-08-13-post-graduation-v3-trade-indexing-design.md` without changing Bread protocol economics, custody, graduation authority, or financial write routing.

A Bread launch that has canonically graduated into its exact verified `UNISWAP_V3` TOKEN/USDC pool must continue to produce one chronological indexed trade history, current execution price, candles, volume, trade counts, creator trade counts, holder concentration, and token-page trade activity after curve trading ends.

## Frozen constraints

- PR #93 stays draft/open/unmerged through this lane.
- No Day-9 PASS, RC tag, Day-10 start, or live BTST write.
- `trades` remains the single normalized trade ledger. Do not create `dex_trades`.
- Existing Bread two-pass discovery remains intact.
- V3 raw logs are not fed through the Bread event decoder/`DecodedBreadEvent` union.
- Canonical V3 journal rows use the generic canonical journal contract with `contractRole = V3_POOL`, `eventName = Swap`, and explicit token/curve association.
- Existing curve trade semantics remain unchanged.
- V3 trades never mutate projected Bread curve reserves or invent Bread base fee, creator tax, opening tax, refund, or curve accounting.
- Historical indexing verifies exact launch-snapshotted adapter/config plus exact V3 factory/pair/fee/pool identity, but does not require current pool `liquidity() > 0`. Positive current liquidity remains a fresh write-route condition only.
- Actor attribution for V3 is `transaction.from`; `Swap.sender` is not treated as the Bread trader.
- All DB/journal/projection/checkpoint effects for one range remain atomic.
- Same-block `GraduationCompleted` followed by a later `Swap` must be captured without an intermediate DB commit.
- `REC-06` canonical event-identity equality remains a hard reconciliation gate and must not be weakened.
- No Graduated Explore feed work in this lane.

## Ownership map

Primary owners:

- shared venue/domain types: `packages/types/src/*`
- generic external V3 read/event ABIs: `packages/protocol-sdk/src/*`
- Bread log discovery: `apps/indexer/src/discovery.ts` — preserve behavior
- Bread normalization: `apps/indexer/src/normalize.ts` — preserve Bread-only decoding
- normalized trades: `apps/indexer/src/trades.ts`
- graduated-pool registry/discovery: new indexer module
- V3 Swap normalization: new indexer module
- range composition/atomic handoff: `apps/indexer/src/apply-range.ts`
- DB schema/migrations: `packages/db/src/schema/projections.ts`, `packages/db/drizzle/*`, `packages/db/src/client.ts`
- trade/candle/metric projection: `packages/db/src/repositories/trades.ts`
- creator trade count: `packages/db/src/repositories/creator-trade-count.ts`
- holder protocol-address wiring: `apps/indexer/src/apply-range.ts`; keep holder repository generic
- read model/API: `packages/db/src/repositories/read.ts`, `apps/api/src/routes/trades.ts`, `packages/types/src/api.ts`
- rebuild/reconciliation verification: existing rebuild/reconcile owners and Day-6 tests
- browser indexed-visibility proof: `apps/web/e2e/fixtures/indexed-api.ts`, `apps/web/e2e/specs/graduated-v3-trading.spec.ts`

`apps/indexer/src/lan/indexer-runner.ts` remains a composition/runtime owner and should not acquire a second V3 indexing model. `rebuildStack()` must gain V3 behavior through the same `applyRange` path used by normal catch-up.

---

## Slice A — Shared venue/schema contract and curve compatibility

### RED

Create `tests/day9/post-graduation-v3-indexing.test.ts` with focused non-DB checks proving:

1. the shared trade venue contract admits exactly `BREAD_CURVE | UNISWAP_V3`;
2. execution-price source admits exactly `CURVE_EXECUTION | V3_SWAP_EXECUTION`;
3. existing curve normalization returns the same current curve amounts/fees/refund/accounting plus:
   - `venueKind = BREAD_CURVE`;
   - `venueAddress = curve`;
   - `venueFeeTier = null`;
4. the Drizzle `trades` schema exports `venueKind`, `venueAddress`, and `venueFeeTier`;
5. `IndexedTokenTrade` exposes the approved venue object and both execution-price sources.

Run the focused test and observe RED for the missing venue contract/schema.

### GREEN

Implement minimally:

- shared `TradeVenueKind` and `TradeExecutionPriceSource` types under `packages/types/src/` and export them;
- extend `NormalizedTrade` in `apps/indexer/src/trades.ts` with venue metadata while preserving curve values byte-for-byte/economically;
- add additive migration `0005_day9_v3_trade_venues.sql`:
  - `venue_kind text`;
  - `venue_address text`;
  - `venue_fee_tier integer`;
  - backfill existing rows as `BREAD_CURVE` / `curve_address` / null;
  - make kind/address non-null after backfill;
  - constrain supported kind and V3 uint24 fee range without rewriting transaction/log identity;
- register migration in `packages/db/src/client.ts`;
- update Drizzle schema;
- extend public `IndexedTokenTrade` shape without removing existing fields.

Run focused test GREEN, then existing curve normalization/type tests.

---

## Slice B — Canonical graduated-pool registry and bounded pool discovery

### RED

Add unit coverage for a new registry/discovery owner proving:

1. an already-known canonical graduated pool is included for a normal range;
2. an in-range `GraduationCompleted` creates a verified in-memory pool mapping before DB apply;
3. same-block pool queries start at the exact graduation block and discard any `Swap` canonically before/equal to the completion event;
4. multiple exact pools are queried in deterministic chunks using `DAY6_LOG_ADDRESS_CHUNK_SIZE`;
5. a pool cannot map to two Bread tokens and one Bread token cannot map to two pools;
6. malformed/nonzero-prefix/zero `poolId` fails closed;
7. launch snapshot adapter family/config/coordinator mismatch fails;
8. completion adapter/position-manager mismatch fails;
9. adapter `family/coordinator/configHash/usdc/positionManager/v3Factory/fee` mismatch fails;
10. V3 factory `getPool` or pool `token0/token1/fee` mismatch fails;
11. historical registry verification does not consult current `liquidity()`.

Observe RED before adding production modules.

### GREEN

- Refactor generic external V3 read/event ABI fragments into a Bread-owned protocol-SDK ABI module; keep vendor SDKs out of the runtime path.
- Preserve existing write-route semantics by importing the shared ABI definitions from `trade-route.ts` / `v3-trading.ts` rather than changing route rules.
- Add a DB read that returns retained canonical `GraduationCompleted` evidence before `fromBlock`, joined to the exact launch snapshot for the selected `chainId + stackVersion + factoryAddress`.
- Add `apps/indexer/src/graduated-pools.ts` to:
  - build candidates from retained canonical journal evidence and current-range Bread completion events;
  - use same-range `LaunchSnapshot` when the launch is not persisted yet;
  - verify the exact immutable adapter/factory/pair/fee/pool identity read-only;
  - cache duplicate immutable adapter reads within the range only;
  - build a stack-aware conflict-checked registry;
  - query only exact verified pool addresses with bounded chunking;
  - canonical-dedupe returned logs and fail on contradictory identity.

Do not add a chain-wide Swap scan and do not commit partial DB state to discover a pool.

Run registry/discovery tests GREEN plus existing Bread discovery tests.

---

## Slice C — V3 Swap normalization and originator attribution

### RED

Add independent tests for:

1. BUY and SELL when USDC is token0;
2. BUY and SELL when USDC is token1;
3. exact one-positive/one-negative signed Swap amount requirement;
4. zero/zero and same-sign amount pairs reject;
5. exact normalized `quoteAmount` and `tokenAmount`;
6. `actor = transaction.from`, never `Swap.sender`;
7. `recipient = Swap.recipient`;
8. transaction lookup is deduplicated per transaction hash;
9. exact block timestamp is reused/cached and missing timestamps are chain-read rather than guessed;
10. V3 output fields:
    - `venueKind = UNISWAP_V3`;
    - `venueAddress = pool`;
    - `venueFeeTier = verified fee`;
    - historical launch `curve` retained;
    - `baseFee = 0`, `creatorTax = 0`;
    - opening/refund/curve-only accounting fields null under the repository compatibility convention;
    - execution price numerator/denominator = exact quote/token amounts;
11. missing transaction sender or malformed/unsafe value fails the range.

Observe RED first.

### GREEN

Add `apps/indexer/src/v3-swaps.ts` using the Bread-local minimal V3 `Swap` ABI. Produce both:

- generic `CanonicalIndexedEvent` rows with `V3_POOL`, `Swap`, explicit token/curve association;
- venue-neutral `NormalizedTrade` rows.

Do not change the Bread `DecodedBreadEvent` union.

Run focused GREEN and existing curve trade-correlation regressions.

---

## Slice D — Atomic apply/projection continuity

### RED

Add PostgreSQL integration tests proving:

1. `applyRange()` uses retained/current pool registry, discovers V3 logs, merges Bread+V3 canonical events, and calls the existing journal/projection/checkpoint transaction once;
2. same-block `GraduationCompleted` + later `Swap` creates the completion journal row, V3 journal row, V3 trade, market data and one advanced checkpoint without an intermediate commit;
3. V3 trade INSERT uses the additive venue fields and same `(chainId, transactionHash, logIndex)` identity;
4. V3 trade does not modify `launch_state.tracked_quote`, tracked tokens, curve fee buckets, real/virtual curve reserves, remaining sellable inventory, or curve readiness;
5. V3 trade updates shared candles and token trade/volume/unique-trader metrics;
6. latest token execution price becomes `V3_SWAP_EXECUTION`;
7. pre-graduation curve rows/candles/metrics remain unchanged;
8. creator `trade_count` increments for a canonical V3 trade but accrued/claimed Bread fee revenue does not;
9. the verified graduated pool is in the launch protocol/venue address set for holder classification, so pool liquidity custody is not treated as a non-protocol user holder;
10. replaying an already-journaled V3 identity does not duplicate the trade or downstream aggregates.

### GREEN

- Extend `applyRange()` as the single composition boundary. Do not add a second LAN/rebuild path.
- Build a generic canonical-order merge with contradiction checking.
- Extend `createTradeReducer` to consume both curve events and `V3_POOL/Swap` normalized trades.
- Extend `CanonicalTradeProjection`/repository insert with venue metadata and nullable compatibility fields.
- Gate `projectCurveState()` strictly to `BREAD_CURVE`.
- Always run the shared candle/metric projection for supported normalized venues.
- Set metric price source from venue rather than hardcoding `CURVE_EXECUTION`.
- Extend creator trade-count attribution for `V3_POOL/Swap` by explicit token association, with zero invented revenue.
- Add verified pool address to the existing per-launch holder protocol-address map; do not make the holder repository V3-specific.

Run the focused DB suite GREEN, then Day-6 trade/creator/holder regressions.

---

## Slice E — Mixed API contract and deterministic browser indexed visibility

### RED

Add API/DB tests proving:

1. one token trade stream can contain old curve and new V3 rows in canonical reverse order;
2. cursor pagination crosses the graduation boundary without overlap/skip;
3. curve API rows expose `venue = BREAD_CURVE/curve/null-fee-tier` and `CURVE_EXECUTION`;
4. V3 rows expose `venue = UNISWAP_V3/pool/fee-tier` and `V3_SWAP_EXECUTION`;
5. V3 Bread fee/tax fields are zero and curve-only compatibility fields remain null;
6. no endpoint split and no RPC fallback is introduced.

Extend the deterministic graduated V3 browser fixture/test so that:

- Router02 submission remains exactly as already proven;
- the indexed fixture exposes the canonical V3 trade only for the post-apply fixture state;
- the existing `onConfirmed` query invalidation rereads `/v1/tokens/:address/trades`;
- the V3 trade becomes visible in the existing Trades table;
- no raw RPC history, new polling loop, or optimistic fake trade row is introduced.

### GREEN

- Extend `TradeReadRow` with venue fields and accurate nullable compatibility fields.
- Select venue fields in `ReadRepository.listTrades`.
- Serialize venue/source in `apps/api/src/routes/trades.ts`.
- Update the deterministic indexed API fixture state and existing graduated trading browser proof only as needed.
- Production token table UI does not require a new component because it already renders generic side/quote/token/trader fields and does not show curve fee labels; a venue label remains optional under the approved design.
- The current token chart remains the indexed latest-price ratio surface; this lane does not invent unavailable historical chart data.

Run focused GREEN plus Day-7 token-page and graduated V3 browser regressions.

---

## Slice F — Rebuild/replay/reconciliation continuity

### RED

Extend Day-6 rebuild/reconcile coverage to prove:

1. delete/rebuild from deployment block reproduces canonical V3 journal rows, trades, candles and metrics;
2. rebuild discovers V3 through the same `applyRange` implementation as normal catch-up;
3. the retained pool mapping is reproducible from canonical launch/graduation evidence after rebuild;
4. the authoritative reconciliation fixture includes verified V3 `Swap` identities in `scanCanonicalEventIdentities`;
5. `REC-06` passes when the chain identity set includes the V3 row;
6. deliberately omitting that V3 identity causes `REC-06` to fail rather than weakening the check;
7. orphan/conflicting pool mapping and malformed Swap abort the range before commit.

### GREEN

Prefer no structural change to `RebuildRepository` or `REC-06` if explicit V3 journal token/curve association already makes existing stack deletion/snapshot selection work. Change only what a failing test proves is required.

Run rebuild/reconcile GREEN and overlap replay regressions.

---

## Final affected regression matrix

After all slices are integrated on one exact head, run fresh:

- new Day-9 V3 indexing tests;
- `tests/day6/trade-vertical.test.ts`;
- `tests/day6/trade-conformance.test.ts`;
- `tests/day6/creator-trade-count.test.ts`;
- `tests/day6/holders-portfolio-conformance.test.ts`;
- affected `tests/day6/rebuild-reconcile*.test.ts` and replay tests;
- `tests/day7/token-page*.test.tsx`;
- existing Day-9 post-graduation route/review/boundary/controller tests;
- `apps/web/e2e/specs/graduated-v3-trading.spec.ts`;
- `tests/day8/rpc-failover-under-load.test.ts`;
- `tests/day8/indexer-catchup-under-arrival.test.ts` because this lane adds indexer RPC work;
- root validation/state/gate checks;
- workspace lint, format check, typecheck and build;
- the existing exact-head Day-9 local release matrix.

External GitHub CI and required physical-device gates remain separate and cannot be inferred from local success.

## Completion boundary

This indexing lane may be called implementation-complete only when the exact integrated head has fresh evidence for:

- verified-pool discovery and same-block capture;
- V3 Swap exact normalization/originator attribution;
- one journal/trade ledger and atomic checkpoint behavior;
- no V3 mutation of curve reserve accounting;
- continuous candles/metrics/API/token read activity;
- creator/holder downstream correctness;
- deterministic rebuild/reconcile;
- existing curve behavior unchanged;
- deterministic browser indexed visibility after a graduated Router02 trade;
- relevant Day-8 capacity regressions;
- workspace/exact-head verification.

Even then: keep PR #93 draft/unmerged until the remaining Day-9 external CI and physical-device gates are separately satisfied. Do not perform a live BTST write merely to close this indexing implementation lane.