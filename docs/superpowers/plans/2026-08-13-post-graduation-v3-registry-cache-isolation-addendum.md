# Post-Graduation V3 Indexing — Registry, Reconciliation & Cache-Isolation Addendum

Date: 2026-08-13
Status: IMPLEMENTATION-PLAN ADDENDUM — NO PRODUCTION CHANGE
Applies to:
- `docs/superpowers/specs/2026-08-13-post-graduation-v3-trade-indexing-design.md`
- `docs/superpowers/plans/2026-08-13-post-graduation-v3-trade-indexing.md`
- `docs/superpowers/plans/2026-08-13-post-graduation-v3-trade-indexing-determinism-addendum.md`
- `docs/superpowers/plans/2026-08-13-post-graduation-v3-read-consumer-continuity-addendum.md`
- `docs/superpowers/specs/2026-08-13-post-graduation-v3-zero-output-swap-semantics-addendum.md`

## Purpose

This addendum closes implementation ambiguity found during the blocked RED-execution window. It does not authorize production GREEN before the committed repository RED has genuinely executed.

The controlling source requirements remain:

- chain is the financial source of truth;
- protocol-stack identity is `chainId + stackVersion + factoryAddress`;
- `launch_state` is rebuildable current curve/graduation projection state;
- event application is deterministic and idempotent;
- checkpoint and projections advance atomically;
- cache invalidation occurs only after durable DB apply;
- old stack versions remain independently operable/indexable;
- performance-affecting changes rerun relevant Day-8 capacity regressions.

## A. Graduated-V3 Registry Ownership

### Use the existing rebuildable graduation projection

Do not create a second authoritative V3 registry table.

For each launch whose snapshotted graduation adapter family is `UNISWAP_V3`, enrich the existing rebuildable `launch_state` projection with DEX-neutral venue identity sufficient for later exact-address log discovery:

- `graduated_venue_kind` — `UNISWAP_V3` for this lane;
- `graduated_venue_address` — verified canonical TOKEN/USDC pool address;
- `graduated_venue_fee_tier` — exact `uint24` V3 fee value.

These fields are derived projection data, not independent financial authority. They are deleted/rebuilt with the selected stack and must be reproduced by canonical replay.

Do not persist Router02/Quoter as historical launch identity. They are current write-route periphery, not required to identify an old launch's canonical graduated pool.

### Verification timing

Verify the venue identity when canonical graduation reaches the pool-created outcome, then persist the derived projection in the same DB transaction as the canonical graduation event projection.

The verification path uses the launch's snapshotted adapter identity and immutable/current-head reads only:

1. launch snapshot graduation adapter address + family + config hash;
2. adapter immutable `family`, `configHash`, `usdc`, `positionManager`, V3 factory and fee;
3. factory `getPool(token, usdc, fee)`;
4. pool immutable/canonical identity `token0`, `token1`, `fee`;
5. coordinator `poolId` must decode to the same canonical pool address.

Do not use historical/archive block-tag reads for these immutable identity facts. Do not use mutable V3 liquidity as historical indexing identity.

### Existing pre-migration graduated rows

Migration `0005` may add the new launch-state venue fields as nullable to preserve repeatable migration semantics.

However, a graduated V3 launch with `POOL_CREATED` state and missing projected venue identity is not considered registry-ready. Normal V3 log discovery must fail closed for that launch until the required Day-9 rebuild/reconcile path has regenerated the projection.

Do not silently infer or backfill the pool from a current network manifest alone.

## B. Bounded V3 Log Discovery

### Registry read

Add one bounded DB read owned by the indexer/read-model package, e.g. `listGraduatedVenueIdentities(...)`, scoped by the full protocol-stack identity:

- chain ID;
- stack version;
- factory address.

The result should include, per graduated launch:

- token address;
- curve address;
- venue kind/address/fee tier;
- graduation completion block;
- graduation completion transaction index;
- graduation completion log index.

The completion ordering can be reconstructed by joining the retained canonical `GraduationCompleted` journal row to the launch/state projection; no duplicate ordering column is required merely for convenience.

### Query bounds

Reuse the existing `DAY6_LOG_ADDRESS_CHUNK_SIZE = 64` for exact-address V3 pool log queries. Do not introduce an independent larger capacity number.

For pools already active before a requested replay range, query exact pool-address chunks from the requested `fromBlock` through `toBlock`.

For pools whose graduation completion occurs inside the requested range, query from their own completion block and then canonically retain only pool logs ordered strictly after that launch's completion `(blockNumber, transactionIndex, logIndex)`.

This prevents a pre-existing V3 pool from contributing pre-graduation activity to Bread while preserving same-block post-completion activity.

### No per-range identity call amplification

After the venue projection has been verified and rebuilt, ordinary catch-up ranges must not issue repeated adapter/factory/pool identity `eth_call`s for every historical graduated launch.

Normal range work is:

- bounded exact-address log reads;
- bounded transaction reads required for actor attribution;
- bounded block reads/timestamp reuse;
- DB projection/replay.

Identity re-verification belongs to canonical graduation projection/rebuild/reconciliation, not every 500-block catch-up range.

Add a focused capacity regression proving retained graduated pools cause zero repeated identity `eth_call`s during a normal later range.

## C. Generic Journal + Canonical Merge Contract

External V3 pool logs must not be pushed through Bread's `DecodedBreadEvent`/Bread ABI decoder.

The V3 indexing module constructs generic `CanonicalIndexedEvent` rows with:

- `contractRole = 'V3_POOL'`;
- `eventName = 'Swap'`;
- explicit `tokenAddress` and `curveAddress` association;
- raw topics/data retained;
- signed `amount0`/`amount1` serialized losslessly through the existing bigint journal envelope.

Bread-normalized events and V3 generic events are merged before `IndexerRepository.applyCanonicalRange()` and sorted by canonical `(blockNumber, transactionIndex, logIndex)` order.

Do not rely on `IndexerRepository` to sort events; reducers execute in supplied order.

If independently discovered inputs claim the same canonical event identity with contradictory content, fail closed before projection rather than choosing one silently.

## D. V3 Read-Client Capability Boundary

Current pre-graduation Day-6 tests and rebuild fixtures often provide only `readContract` and optional `getBlock`.

Do not force every non-V3 range/rebuild caller to implement external-pool methods.

The V3 path may require an explicit narrowed capability containing the provider-safe versions of:

- `getLogs`;
- `getTransaction`;
- `getBlock` as needed;
- `readContract` for one-time/reconciliation identity verification.

If there is no graduated V3 candidate/registry row for the selected stack/range, existing pre-graduation execution remains compatible without `getLogs`/`getTransaction` additions.

If V3 evidence exists but the required capability is absent, fail closed rather than silently skipping V3 events.

The LAN provider-safe client remains the RPC pacing/retry owner; do not create a second V3-specific retry loop.

## E. Reconciliation Extension

Do not add a seventh ad-hoc reconciliation verdict merely for V3.

Extend `REC-04` so its existing graduation identity check also verifies projected graduated venue identity when the selected launch is a V3 pool-created launch.

For such launches, authoritative reconciliation must confirm:

- snapshotted adapter family is V3;
- adapter immutable config/USDC/factory/fee identity matches the launch snapshot;
- factory canonical pool equals projected venue address;
- pool token pair + fee equal expected TOKEN/USDC/fee;
- coordinator `poolId` resolves to the same pool;
- projected `graduated_venue_kind/address/fee_tier` match those authoritative immutable facts.

Pre-graduation/non-V3 fixtures remain valid without the V3-specific authoritative read.

`REC-06` remains exact journal-identity reconciliation and must include every retained canonical V3 `Swap`, including journal-only zero-output dust swaps.

Do not relax `REC-06` to compare only projected trade rows.

## F. Single-Trade-Ledger Persistence Contract

Migration `0005` should cover the additive venue fields required by the single `trades` ledger and the additive rebuildable venue identity on `launch_state`.

For `trades`:

- `venue_kind` text;
- `venue_address` address text;
- `venue_fee_tier` integer nullable.

Backfill existing rows as `BREAD_CURVE`, `venue_address = curve_address`, `venue_fee_tier = NULL`.

PostgreSQL repeatability rule:

- columns may use `ADD COLUMN IF NOT EXISTS`;
- table constraints must use an explicit catalog/`pg_constraint` guard in a repeatable `DO $$ ... $$` block rather than unsupported `ADD CONSTRAINT IF NOT EXISTS` syntax.

The V3 fee constraint should enforce representability/exact identity, not invent a protocol fee policy absent from the adapter contract:

- V3 fee tier must fit `uint24` (`0..16777215`);
- correctness comes from exact adapter/factory/pool equality;
- do not independently require `fee > 0` unless a source/adapter invariant explicitly requires it.

Curve rows keep their existing strict accounting semantics.

A normal priced V3 row keeps generic `tokenAmount`, `quoteAmount`, actor/recipient and exact execution price, with:

- `baseFee = 0`;
- `creatorTax = 0`;
- legacy curve-context fields null;
- `executionPriceSource = 'V3_SWAP_EXECUTION'`.

Journal-only zero-output dust produces no trade row.

## G. Cache Identity Must Match Protocol-Stack Identity

The canonical protocol-stack identity includes factory address. The existing feed cache channel `stack:<chainId>:<stackVersion>:feed` omits factory address and can collide if two factories share a stack-version label.

When shared cache identities are centralized, correct the feed logical channel to a factory-scoped shape, e.g.:

`stack:<chainId>:<stackVersion>:<factoryAddress>:feed`

Requirements:

- factory address canonicalized lower-case;
- API feed cache and indexer `PostCommitPublisher` use one shared helper;
- parser/affected-identity tests include the full stack identity;
- two factories with the same chain ID + stack version must have different generation keys/cache payload namespaces;
- token cache remains `token:<chainId>:<tokenAddress>` because launch identity is chain ID + token address;
- no new wallet cache surface is created in this lane.

Do not change the event-journal decoder schema marker merely because the cache identity helper changes.

## H. Post-Commit Channel Derivation

Derive cache channels only from newly inserted events whose durable projections actually changed cached read data.

Normal priced V3 Swap:

- token channel invalidated;
- full factory-scoped stack feed channel invalidated because the implemented New feed embeds token metrics.

Journal-only zero-output dust:

- no token/feed data-cache invalidation;
- no price/candle/metric projection change;
- journal/checkpoint still advance canonically.

Preserve `PostCommitPublisher`'s maximum 128 unique channels per publish call. The LAN composition may deterministically sort/deduplicate and chunk a larger committed affected set into batches of at most 128.

Post-commit failure remains degraded presentation only; it must never roll back or financially replay an already committed DB range. Runtime evidence must surface whether any catch-up cycle had degraded publication.

## I. TDD Sequencing Once Real Execution Returns

The current committed Slice-A RED covers only part of the eventual feature. Do not use it to justify untested downstream GREEN.

Required sequence:

### A1 — existing RED + curve persistence RED

1. Execute the already committed `tests/day9/post-graduation-v3-indexing.test.ts` and observe intended RED.
2. Add/execute a focused RED proving a normal existing curve trade persists explicit `BREAD_CURVE` venue columns through PostgreSQL.
3. Only then implement the minimal schema/normalizer/repository GREEN required for those failures.
4. Run focused + affected Day-6 curve regressions.

### A2 — public type/API RED

1. Add compile/runtime RED for exact venue/execution-source shared type unions and `IndexedTokenTrade.venue`/execution-source shape.
2. Observe RED.
3. Implement minimal shared type/API serialization GREEN.
4. Preserve existing curve API values.

### B onward

Continue later registry/discovery/V3 normalization/projection/read/cache/rebuild slices through separate RED → GREEN steps. Do not implement a downstream slice merely because its architecture is documented here.

## J. Required Regression Matrix Before This Lane Can Close

At minimum rerun affected tests covering:

- existing curve trade normalization/persistence/API;
- PostgreSQL migration repeatability and constraints;
- V3 adapter/factory/pool identity verification;
- same-block completion/Swap ordering;
- token0/token1 direction both orderings;
- transaction `from` actor attribution rather than pool `Swap.sender`;
- journal-only zero-output dust;
- canonical merge contradictions;
- replay overlap idempotency;
- curve state unchanged by V3 trades;
- candles/metrics `V3_SWAP_EXECUTION` continuity;
- creator trade-count continuity with zero invented Bread fee revenue;
- holder concentration excluding verified V3 pool custody;
- source-aware graduated Portfolio valuation;
- factory-scoped cache isolation;
- post-commit invalidation/chunk/degraded semantics;
- rebuild + `REC-04` + `REC-06` V3 reconciliation;
- Day-8 RPC failover/concurrency/catch-up/cache-load regressions;
- exact-head typecheck/build/migration validation and full required CI matrix.

## Unchanged Release Boundaries

- No production V3 indexing GREEN before a genuine repository RED is observed.
- No live BTST write is authorized by this read-model lane.
- No second ledger, no chain-wide DEX scan, no DEX API truth and no indexed write-route authority.
- No Arc-mainnet DEX selection is made here.
- No Graduated Explore-feed implementation is added here.
- PR #93 remains draft/unmerged until all non-waivable Day-9 gates pass.
- No Day-9 PASS, RC tag or Day-10 start while post-graduation indexing, physical/current-device or exact-head CI gates remain open.
