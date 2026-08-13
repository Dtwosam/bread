# Post-Graduation V3 Indexing — Read-Consumer Continuity Addendum

Date: 2026-08-13
Status: IMPLEMENTATION-PLAN ADDENDUM — NO PRODUCTION CHANGE
Applies to: `docs/superpowers/plans/2026-08-13-post-graduation-v3-trade-indexing.md`

## Purpose

Read-only impact review after the approved V3 indexing design identified two existing downstream consumers that must be included before the post-graduation indexing lane can claim integrated continuity:

1. Portfolio valuation when the canonical indexed price source changes from the final Bread curve execution to a verified V3 execution; and
2. Redis cache-generation invalidation after durable indexer apply, so cached token/feed projections do not remain stale after a canonical V3 trade.

These are projection/read-surface integrations only. They do not change protocol economics, custody, authority, Solidity, trade routing, Arc-mainnet selection, or the chain-authoritative financial write path.

## A. Portfolio valuation continuity

### Existing behavior that must be preserved

The current Portfolio API intentionally treats a graduated token as unavailable for valuation because no ratified live DEX indexed price source existed when the Day-6/7 implementation shipped.

A graduated holding whose only retained price is the final `CURVE_EXECUTION` price must **remain unavailable**. Graduation alone must never make a stale curve price look like a live post-graduation valuation source.

### Required V3 behavior

Once the indexer has canonically applied a verified graduated-pool swap and `token_metrics.last_price_source = V3_SWAP_EXECUTION`:

- a graduated holding may expose price `AVAILABLE` using the exact indexed V3 numerator/denominator;
- `currentValue` uses the same exact integer ratio and wallet balance, without binary floating point;
- existing web wallet-total aggregation remains unchanged because it already sums generic `AVAILABLE` current values;
- no cost basis, PnL or LP-fee revenue is invented;
- Portfolio/indexed price never selects a financial write route.

### RED coverage to add when repository execution is available

Extend the affected Day-6 holder/portfolio regression to prove both sides explicitly:

1. `POOL_CREATED/GRADUATED + CURVE_EXECUTION` remains `UNAVAILABLE`;
2. `POOL_CREATED/GRADUATED + V3_SWAP_EXECUTION` becomes `AVAILABLE` with the exact ratio and exact current-value arithmetic;
3. nongraduated `CURVE_EXECUTION` remains unchanged;
4. unsupported/missing price source remains fail-closed.

Do not remove the graduated safety guard generically; make it source-aware.

## B. Post-commit Redis cache invalidation continuity

### Existing architecture

Bread already has:

- API `BreadCache` generation-based Redis caching;
- indexer `PostCommitPublisher` with fail-degraded post-commit invalidation/fanout semantics;
- replay/catch-up `publish(result)` support that runs only after successful DB apply and only when new event identities were inserted;
- `redis@6.1.0` already pinned in the indexer package;
- one Day-9 LAN composition that passes the same `BREAD_REDIS_URL` to the independent indexer and API processes.

The missing piece is runtime composition: the LAN indexer currently does not pass a publisher into `runIndexerCatchUp`, so cached token/feed data can remain on the previous generation until TTL expiry even after the DB projection has committed.

### Required behavior

After a canonical range commits new events:

- derive logical invalidation channels from **newly inserted** normalized events, not all replayed events;
- a newly inserted V3 `Swap` must invalidate its token channel;
- because token metrics appear in the implemented `new` feed surface, a token-affecting market event must also invalidate the stack feed channel used by that existing cache;
- duplicate overlap replay with zero inserted identities must publish nothing;
- DB failure must publish nothing;
- cache invalidation failure is degraded presentation only and must never roll back/retry a committed financial projection;
- do not create a new polling loop or a second cache authority.

`Trades` and `Portfolio` remain DB-backed uncached read routes; the immediate browser Trades visibility proof continues to rely on the existing transaction-confirmation query invalidation/refetch. Cache-generation invalidation is required for cached token/feed market-data continuity.

### Shared cache identity rule

Do not duplicate the Redis generation-key string in API and indexer implementations.

Introduce one pure shared cache identity helper in the existing shared-types layer (which already owns validated canonical identity helpers), covering only the operational cache contract needed by both apps, for example:

- cache schema/version identifier for API projection cache keys;
- token logical channel construction;
- stack-feed logical channel construction;
- generation-key construction.

This cache marker remains separate from the event-journal/checkpoint `decoder_schema_version`; do not globally rename or migrate `day6-v1` journal rows as part of this work.

### Apply-result / runtime composition rule

Prefer the existing replay/catch-up seam rather than publishing inside the DB transaction:

1. `applyRange()` normalizes and applies the canonical range exactly once;
2. after `IndexerRepository.applyCanonicalRange()` resolves, match `insertedEventIds` back to the normalized events from that range and derive bounded affected logical channels;
3. return those channels as additive apply-result metadata;
4. the LAN runner supplies the existing catch-up `publish(result)` hook;
5. that hook calls the existing indexer-owned `PostCommitPublisher` against the shared Redis instance.

Do not re-normalize raw logs in the publisher and do not issue DB/RPC reads merely to determine invalidation channels.

### Realtime boundary

The current `BoundedRealtimeFanout` is an in-process capacity primitive and the LAN processes do not currently expose a cross-process Redis pub/sub transport. This addendum does **not** authorize inventing a new realtime subscription system in the V3 indexing lane.

Required closeout is cache-generation invalidation plus the existing browser confirmation refetch path. A broader cross-process realtime transport remains separate unless a source-required failing test proves it is necessary.

### RED coverage to add when repository execution is available

Add focused tests proving:

1. a newly inserted V3 `Swap` returns the exact token + stack-feed channels;
2. overlap replay of the same swap returns zero inserted IDs and does not invalidate;
3. DB apply rejection produces zero invalidation calls;
4. successful commit invalidates only after the DB transaction resolves;
5. token/feed cache generation changes cause the next API read to load the new DB-backed V3 metrics rather than the stale payload;
6. invalidation failure is reported as degraded presentation and does not duplicate/retry the committed V3 trade.

Include the affected Day-6 replay/cache/fanout regression and Day-8 cache/catch-up capacity regressions in the final exact-head matrix.

## Unchanged release boundaries

- No production V3 indexing GREEN before the real repository RED is observed failing for the intended missing behavior.
- No live BTST write for this indexing lane.
- No PR #93 merge, Day-9 PASS, RC tag, or Day-10 start while any non-waivable gate remains open.
- No Graduated Explore feed implementation in this lane.
- No indexed read surface may become financial write-route authority.
