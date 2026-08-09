# Day 6 Task 3 — PostgreSQL transaction boundary integrated handoff

Date: 2026-08-09
Repository: `Dtwosam/bread`

## Integrated baseline

- Previous durable Day-6 baseline: `b6edc45a7a680b15b40b6616473b8569a8ed0ae2` (Task-2 handoff merge, PR #40).
- Task-3 implementation PR: #41.
- Task-3 merge-authorizing head: `174f2cf6e141c961f1e63f85ad9be8030bc1c937`.
- Task-3 merge-authorizing CI: `31311780637`.
- Task-3 guarded merge: `457138c0b79bc20177437b871a8b258a54f83b49`.
- `main` was verified identical to `457138c0b79bc20177437b871a8b258a54f83b49` immediately after merge.

## Exact accepted Task-3 surface

Task 3 integrated the rebuildable PostgreSQL read-stack boundary only:

- canonical `event_journal` keyed by `(chain_id, transaction_hash, log_index)`;
- every source-defined Day-6 projection table family;
- repeatable Day-6 migration;
- canonical journal conflict-ignore dedupe;
- synchronous injected projection reducers only for journal rows newly inserted by the current transaction;
- checkpoint locking, continuity validation, and non-regression;
- one PostgreSQL transaction containing journal insert + reducer projection effects + checkpoint advancement;
- rollback of all three on reducer failure;
- full protocol-stack identity `(chain_id, stack_version, factory_address)` for stack/checkpoint boundaries;
- unique `(chain_id, curve_address)` launch mapping;
- journal token/curve context and decoder/schema version;
- checkpoint deployment start, committed block number/hash/timestamp, last canonical event identity when present, decoder/schema version, status, applied time, and update time;
- generic read repository boundary keyed by the same canonical stack identity.

Chain/contracts remain financial authority. PostgreSQL remains a deterministic rebuildable read surface.

## TDD evidence

### Original missing-DB RED

- Head: `267e1666c847e2100e27109ad1a09b60e5b3b9ec`
- CI: `31310360021`
- Result: real PostgreSQL infrastructure reached the Task-3 test; the required Day-6 DB surface was absent.

`DAY6_TASK3_ORIGINAL_RED = PROVEN`

### Initial transaction-boundary GREEN

- Static-repair head: `c6d8917339344408a24a29a467d345c532f1a43d`
- CI: `31310853814`
- Result: all four jobs PASS, including real PostgreSQL migration/dedupe/reducer-on-new-insert/rollback/continuity proof plus root typecheck/build/clean-tree.

`DAY6_TASK3_TRANSACTION_BOUNDARY_GREEN = PROVEN`

### Source/design conformance RED

- Head: `cc8aadef74770be8186bdf318a6d7e7bd4532447`
- CI: `31311512834`
- Existing Task-3 DB suite remained 4/4 PASS.
- Dedicated schema-contract suite failed 4/4 exactly on the four source-defined schema gaps.

`DAY6_TASK3_SOURCE_DESIGN_CONFORMANCE_RED = PROVEN`

### Source/design conformance GREEN

- Implementation head: `e6729308a346eb3991ddd8be12e69dedb74b5012`
- CI: `31311697220`
- All four jobs PASS.
- Real PostgreSQL lane: original Task-3 suite 4/4 PASS + schema-contract suite 4/4 PASS = 8/8 PASS.

### Final merge-authorizing exact head

- Head: `174f2cf6e141c961f1e63f85ad9be8030bc1c937`
- CI: `31311780637`
- bootstrap-validation: PASS
- dependency-build: PASS, including validation, Day-6 tests, compile-time shared contract, root typecheck, build, clean tracked tree
- foundry-bootstrap: PASS, including generated ABI drift check and Solidity tests
- infrastructure-health: PASS, including PostgreSQL, Redis, and both Task-3 DB suites
- guarded expected-head merge: `457138c0b79bc20177437b871a8b258a54f83b49`
- merged `main`: verified identical immediately after integration

`DAY6_TASK3_SOURCE_DESIGN_CONFORMANCE = PASS`

`DAY6_TASK3_DB_TRANSACTION_BOUNDARY_INTEGRATED_PASS = TRUE`

## Explicit exclusions / unresolved gates

This handoff does not claim or introduce:

- Task-4 launch discovery, constructor-mint normalization, launch reducers, or API routes;
- trade/candle/fee/holder/graduation reducer semantics;
- cache/fanout or replay implementation beyond the Task-3 transaction primitives;
- `DELETE_DB_REBUILD_PASS`, `OVERLAP_REPLAY_IDEMPOTENT`, `API_FRESHNESS_METADATA_PRESENT`, `RECONCILE_PASS`, or the full concurrency/cache/fanout Day-6 closeout gates;
- server-side signing, relaying, transaction submission, queueing, or key custody;
- production economics/admin values;
- Arc mainnet values or canonical Arc DEX values;
- Pons parity/audit conclusions;
- a fabricated Buyback authority/event surface.

## Exact continuation

Task 4 stays blocked until this documentation/state-only handoff receives its own exact-head CI and guarded merge.

After that, start Task 4 from the newly integrated `main`, RED-first. The accepted Task-4 scope is the first launch vertical only: deterministic two-pass Factory/dynamic-address discovery, transaction ordering that captures the constructor mint before `LaunchCreated`, canonical launch projection, and the first read routes (`/v1/status`, `/v1/feed`, `/v1/tokens/:address`) with the approved indexed-response freshness envelope.

Do not use the older plan shorthand `{ data, freshness }`; the approved Day-6 design controls and requires `IndexedResponse<T> = { data, meta, page? }`.
