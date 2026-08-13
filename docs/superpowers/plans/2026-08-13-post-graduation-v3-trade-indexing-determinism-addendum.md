# Post-Graduation V3 Trade Indexing — Determinism Addendum

Date: 2026-08-13
Status: IMPLEMENTATION-PLAN ADDENDUM
Applies to: `docs/superpowers/plans/2026-08-13-post-graduation-v3-trade-indexing.md`, Slice B

## Reason

The Slice-B canonical graduated-pool registry is rebuildable historical indexing state. Its identity verification must remain reproducible even if an external DEX dependency changes after a Bread graduation has already happened.

Bread's `BreadV3GraduationAdapter` pins the relevant launch-specific V3 configuration as immutables (`coordinator`, `usdc`, `locker`, `positionManager`, `v3Factory`, `fee`, tick configuration and `configHash`), and its `family()` value is pure. The V3 pool's TOKEN/USDC ordering and fee are likewise identity properties of the exact pool.

Therefore historical registry reconstruction must not accidentally verify a past graduation against mutable/current-head external state when an exact historical block is already known.

## Additional Slice-B RED requirement

Before Slice-B production code, add a failing test proving that registry identity reads are requested at the exact canonical `GraduationCompleted` block for the candidate being verified.

The required block-pinned reads are the candidate's:

- launch-snapshotted graduation adapter identity/config reads;
- exact V3 factory `getPool(TOKEN, USDC, fee)` read;
- exact pool `token0`, `token1`, and `fee` reads.

For retained graduations, use the retained canonical completion block. For a `GraduationCompleted` discovered in the current range, use that event's block number.

## Additional Slice-B GREEN rule

Every historical registry `readContract` request above must include that canonical block number. Do not default these historical identity checks to the current chain head.

Same-block completion remains valid: an EVM read at the completed block observes the completed block state, including the pool that was created earlier in that block/transaction before `GraduationCompleted` was emitted.

Do not add a historical `liquidity() > 0` requirement. Current positive liquidity remains a fresh financial write-route condition only and is not a historical-indexing identity invariant.

## Unchanged boundaries

This addendum does not alter:

- the approved V3 indexing architecture;
- protocol economics or authority;
- the single `trades` ledger;
- atomic same-range discovery/apply;
- `REC-06`;
- current V3 financial write-route verification;
- the requirement to observe the real repository RED before Slice-B production code.
