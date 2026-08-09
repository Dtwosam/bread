# Day 6 Task 7 — Holder Snapshots & Portfolio Read Model Evidence

Date: 2026-08-09

## Scope

Task 7 extends the accepted Day-6 transactional read stack with deterministic holder reconstruction and DB-only portfolio reads. It does not add replay/finality/cache/fanout/rebuild/reconciliation behavior owned by later tasks.

Authority remains unchanged: Bread contracts/chain are financial authority; PostgreSQL/indexer/API are rebuildable read projections only.

## Baseline

- Durable Task-6 baseline: `17aa7f6ceb7b742305ae5ff06791444a2e1d6d45`
- Branch: `agent/day6-task7-holders-portfolio`
- PR: #49

## Original RED — PROVEN

Exact RED head: `b92d01997b75aaec886aa0d5cb8c5473a78a28d8`

- inherited CI: `31323847555`
- retained Task-5 PostgreSQL/conformance: `31323847553` — PASS
- retained Task-6 PostgreSQL/conformance: `31323847564` — PASS
- dedicated Task-7 PostgreSQL workflow: `31323847602`

The dedicated Task-7 workflow reached healthy PostgreSQL and Redis and executed five Task-7 assertions. Failures were the intended missing holder reducer/schema/API behaviors, not runner, syntax, module-resolution, PostgreSQL, Redis, or test-plumbing failures.

`DAY6_TASK7_RED = PROVEN`

## Implemented behavior

### Holder projection

- canonical launch-token `Transfer` is the only holdings mutation surface;
- constructor mint, ordinary transfer and burn use zero-address semantics without creating a zero-address holder row;
- overlap replay does not double-apply because projection reducers run only for newly inserted canonical journal events;
- a projected negative holder balance is an integrity error and rolls back the journal/projection/checkpoint transaction;
- malformed transfer payloads, wrong contract role, chain mismatch, or unknown Bread launch token fail closed;
- `Approval` is an explicit holdings no-op;
- snapshots retain balance, protocol-address flag, as-of block, and last canonical transaction hash/log index;
- holder count is derived from positive indexed balances.

### Protocol-address classification

- global protocol addresses come from validated `ProtocolContext`;
- launch-specific curve/coordinator/adapter addresses are sourced from indexed launch snapshots;
- same-range normalized launch identities are passed into the holder reducer so constructor mint is classifiable before `LaunchCreated` is persisted;
- protocol balances remain visible and tagged rather than silently removed;
- Top-10 concentration explicitly excludes protocol addresses.

### Holder API

`GET /v1/tokens/:address/holders` is DB-only and provides:

- canonical address validation before DB work;
- bounded limit (max 100);
- versioned opaque deterministic keyset cursor;
- numeric balance-desc / holder-address-asc ordering;
- holder balances, protocol flags, as-of block and last event identity;
- exact supply/count context and exact non-protocol Top-10 balance;
- freshness metadata;
- bounded 400 for malformed cursor/address and 404 for valid unindexed token.

No concentration percentage was invented because the controlling source requires correct protocol-address exclusion but does not freeze a separate percentage formula at this API layer.

### Portfolio API

`GET /v1/portfolio/:address` is DB-only and provides:

- canonical wallet validation;
- bounded versioned cursor pagination over positive Bread holdings;
- token identity, indexed balance, protocol flag, graduation state and recent holder-event context;
- active curve current-price/current-value as exact rational indexed data only when a trustworthy indexed `CURVE_EXECUTION` price exists;
- graduated price/value explicitly `UNAVAILABLE` without a separately ratified live DEX-price source;
- no fabricated average entry or PnL.

## Defects found and repaired during GREEN

### Holder keyset numeric-order bug

The first runtime candidate passed 4/5 dedicated tests. PostgreSQL was ordering the `balance::text AS balance` output alias lexicographically instead of the numeric holder column. A diagnostic regression proved the emitted first-page cursor incorrectly used balance `600` rather than numeric second row `300`.

Repair: qualify the underlying numeric column (`h.balance`) in keyset predicates and ordering. The direct-repository regression remains in the Task-7 suite.

### TypeScript package-boundary bug

Runtime/PostgreSQL behavior was green, but root typecheck failed because `@bread/db` imported `packages/types/src/index.ts` by sibling source path and required the narrower `DecodedBreadEvent` hex-template identity.

Repair: the DB holder projector now consumes the DB-owned `CanonicalIndexedEvent` structural contract and validates the Transfer payload fail-closed. No runtime projection/API semantics changed.

Static-repair exact head: `cb01689fd9b60c9e3bd9e9239c5eee3227db0792`

- inherited CI `31324916807` — PASS all four jobs
- retained Task-5 `31324916802` — PASS
- retained Task-6 `31324916801` — PASS
- dedicated Task-7 `31324916814` — PASS

### Conformance fixture correction

An additional coverage-only fixture initially reused protocol addresses for multiple contract roles, causing valid normalizer role-conflict failure. This was a test-fixture error and is not counted as product RED evidence. It was replaced with globally unique fixture addresses.

## Final implementation/conformance GREEN before evidence commit

Exact head: `c7f0503bd267ff0b1f9fb113c5aeb62a1ce0f46a`

- inherited CI: `31325226954` — PASS
- retained Task-5: `31325226945` — PASS
- retained Task-6: `31325226943` — PASS
- dedicated Task-7: `31325226938` — PASS, **8/8**

The expanded Task-7 proof explicitly covers:

1. canonical reducer/schema surface;
2. mint/transfer/burn reconstruction + protocol tagging + overlap replay idempotency;
3. negative balance transaction rollback;
4. bounded holders + two-token portfolio without fabricated cost basis;
5. bounded invalid cursor/address errors;
6. explicit `Approval` no-op;
7. real same-range constructor mint through `applyRange()` before `LaunchCreated` persistence;
8. two-page portfolio cursor pagination without overlap.

## Source/design review

PASS.

- No Task-8 replay/cache/fanout/rebuild/reconciliation behavior leaked into Task 7.
- No server-side financial write/signing/relaying/custody surface was introduced.
- No raw-RPC balance fallback exists in holder/portfolio routes.
- Holder and portfolio amounts remain lossless indexed integers/rationals.
- Unknown/unratified market values remain unavailable rather than fabricated.
- Existing Task-5 and Task-6 database regressions stay green.

`DAY6_TASK7_HOLDERS_PORTFOLIO_SOURCE_DESIGN_CONFORMANCE = PASS`

## Acceptance boundary

This evidence commit intentionally changes the branch SHA. Task 7 is **not merge-authorized** by the earlier green runs. The documentation-bearing exact head must re-pass:

- inherited CI all four jobs;
- retained Task-5 PostgreSQL/conformance;
- retained Task-6 PostgreSQL/conformance;
- dedicated Task-7 PostgreSQL/conformance 8/8.

Only then may PR #49 be marked ready and guarded-merged with expected-head protection. Task 8 remains blocked until the subsequent Task-7 durable handoff is also exact-head green and merged.
