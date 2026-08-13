# Post-Graduation V3 Trade Indexing — Determinism Addendum

Date: 2026-08-13
Status: IMPLEMENTATION-PLAN ADDENDUM
Applies to: `docs/superpowers/plans/2026-08-13-post-graduation-v3-trade-indexing.md`, Slice B

## Source-aligned rule

Slice-B canonical graduated-pool registry reconstruction must remain deterministic **without introducing a historical archive-state dependency**.

The controlling Day-6 indexer design already establishes the rule: deterministic rebuild must not depend on historical archive-state reads for mutable values, while immutable/snapshotted getters may be read at the current reconciliation head when accepted contract semantics guarantee that the historical identity cannot be rewritten.

Bread's `BreadV3GraduationAdapter` pins the relevant launch-specific V3 configuration as immutables (`coordinator`, `usdc`, `locker`, `positionManager`, `v3Factory`, `fee`, tick configuration and `configHash`), and its `family()` value is pure. For the exact canonical V3 pool, `token0`, `token1`, and `fee` are pool identity properties. The canonical factory's exact TOKEN/USDC/fee pool mapping is used only as an identity cross-check for the retained pool address.

## Additional Slice-B RED requirements

Before Slice-B production code, add failing coverage proving that registry verification:

1. reconstructs the candidate from retained canonical Bread graduation evidence plus the launch's snapshotted adapter/config identity;
2. verifies only immutable/snapshotted V3 identity facts needed by the approved design;
3. does **not** require a historical block-tag/archive read to rebuild a past graduation;
4. does **not** consult mutable current pool `liquidity()` as a historical indexing invariant;
5. fails closed when current immutable identity facts contradict the retained canonical Bread mapping;
6. derives the historical V3 factory/fee/USDC/position-manager identity from the launch's snapshotted adapter rather than requiring the newest network manifest's router/quoter/factory tuple.

## Additional Slice-B GREEN rule

Historical registry verification may read the immutable/snapshotted adapter/factory/pool identity at the current reconciliation head. Do not add an archive-node requirement merely because the canonical `GraduationCompleted` block is known.

The durable historical authority remains Bread's retained launch snapshot plus canonical `GraduationCompleted` evidence. Current-head external reads are cross-checks only for immutable identity and may not replace or rewrite that retained Bread authority.

For indexing, read the exact historical adapter's immutable `v3Factory`, `fee`, `usdc`, `positionManager`, `coordinator`, `configHash`, and family, then verify the retained pool through **that adapter-bound V3 factory** plus the pool's exact TOKEN/USDC ordering and fee. Do not require the current network manifest's Router02/Quoter tuple to reconstruct an old pool. Router/quoter identity remains part of fresh write-route verification, not historical trade-indexing authority.

This is required by the approved rollover contract: an old `chainId + stackVersion + factoryAddress` must remain independently rebuildable after a newer stack or DEX dependency becomes current.

Do not use mutable current V3 state such as `liquidity()` to decide whether a historical canonical Swap is indexable. Positive current liquidity remains a fresh financial write-route condition only.

## Same-block behavior

An in-range `GraduationCompleted` still registers its pool in memory before the atomic DB apply so a later `Swap` in the same block can be captured. This does not require an intermediate database commit or an archive-state read.

Pool log eligibility is bounded by the canonical Bread graduation point:

- a pool already graduated before `fromBlock` is eligible from `fromBlock`;
- a pool graduated inside the range is eligible from its completion block;
- within the completion block, pool logs at or before the canonical completion order are discarded so pre-Bread/pre-completion pool activity is not reclassified as Bread post-graduation trading.

## Range-client capability boundary

The existing LAN `PublicClient` already exposes `getLogs`, `getTransaction`, `getBlock`, and `readContract` through one provider-wide bounded rate gate, but `applyRange` is currently typed only for `readContract/getBlock` because pre-V3 normalization did not need to originate additional pool-log or transaction-origin reads.

Slice B/C must make this capability explicit instead of hiding it behind `as never` casts:

- preserve the existing Bread `ChainReadClient` contract for Bread normalization;
- define/narrow an indexer range client capability for exact V3 `getLogs` and transaction-origin reads;
- old/pre-graduation ranges may short-circuit without requiring V3-only methods;
- once a canonical graduated-pool candidate exists, missing required V3 read capabilities fail the affected range explicitly rather than silently skipping Swap activity;
- the LAN provider-safe proxy remains the single RPC pacing/retry owner; do not create a second provider/retry loop in the V3 registry or normalizer.

## Decoder/schema marker

The V3 journal extension uses the existing generic canonical journal envelope: `contract_role` and `event_name` are stored as text and token/curve context is explicit. The approved design does not introduce a second journal schema.

Therefore do not gratuitously bump the common `day6-v1` journal/checkpoint decoder-schema marker merely because a new approved external event family is admitted through the same envelope. A version bump would require its own migration/rebuild/reconciliation design and is not part of this lane unless a failing conformance test proves the existing envelope cannot represent the approved V3 row.

## Unchanged boundaries

This addendum does not alter:

- the approved V3 indexing architecture;
- protocol economics or authority;
- the single `trades` ledger;
- atomic same-range discovery/apply;
- `REC-06`;
- current V3 financial write-route verification;
- the requirement to observe the real repository RED before Slice-B production code.
