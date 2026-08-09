# Day 6 Task 3 — PostgreSQL journal / projection transaction boundary evidence

Date: 2026-08-09
Repository: `Dtwosam/bread`
Task baseline: `b6edc45a7a680b15b40b6616473b8569a8ed0ae2`
PR: #41

## Scope

Task 3 is restricted to the accepted Day-6 database boundary:

- `event_journal` plus all source-defined projection table families;
- repeatable PostgreSQL migration;
- canonical event identity dedupe;
- one PostgreSQL transaction covering journal insert, synchronous injected projection reducers, and checkpoint advancement;
- reducers run only for journal rows newly inserted in that transaction;
- checkpoint continuity / non-regression guard;
- generic read repository boundary;
- no Task-4 launch normalization, discovery, API, or projection semantics.

## Original RED — PROVEN

Head: `267e1666c847e2100e27109ad1a09b60e5b3b9ec`
CI: `31310360021`

The real PostgreSQL infrastructure lane reached the new Task-3 integration test and failed because the Day-6 DB schema/repository surface did not yet exist. Bootstrap, prior Day-6 behavior, Foundry, PostgreSQL startup, and Redis health remained valid.

Verdict:

`DAY6_TASK3_ORIGINAL_RED = PROVEN`

## Initial transaction-boundary GREEN

Implementation head: `e5d10151fec6ec0f07bc2cc1f529265a8a888f78`

The real PostgreSQL integration passed migration, table-family availability, canonical journal dedupe, reducer-on-new-insert behavior, rollback of journal + projection + checkpoint, and forward-gap rejection. Root TypeScript then exposed a static `@bread/db` typing issue; this was not treated as PASS.

Static-repair head: `c6d8917339344408a24a29a467d345c532f1a43d`
CI: `31310853814`

Result:

- bootstrap-validation: PASS
- dependency-build: PASS, including root typecheck/build/clean-tree
- foundry-bootstrap: PASS
- infrastructure-health: PASS, including real PostgreSQL Task-3 integration

Verdict:

`DAY6_TASK3_TRANSACTION_BOUNDARY_GREEN = PROVEN`

## Source/design conformance RED — PROVEN

During final review against the accepted Day-6 plan/design, four schema-contract gaps were identified:

1. `event_journal` lacked nullable deterministic token/curve context and decoder/schema version;
2. `protocol_stacks` identity did not include Factory;
3. `launches` did not enforce one canonical curve per chain;
4. `indexer_checkpoints` did not use full stack identity or carry the committed-boundary metadata required by the source.

A dedicated real-PostgreSQL schema-contract suite was wired into CI.

RED head: `cc8aadef74770be8186bdf318a6d7e7bd4532447`
CI: `31311512834`

Expected result:

- bootstrap-validation: PASS
- dependency-build: PASS
- foundry-bootstrap: PASS
- original Task-3 PostgreSQL test: 4/4 PASS
- schema-contract PostgreSQL test: 4/4 FAIL on exactly the four missing source-defined requirements

Verdict:

`DAY6_TASK3_SOURCE_DESIGN_CONFORMANCE_RED = PROVEN`

## Source/design conformance GREEN — PROVEN

Exact implementation head: `e6729308a346eb3991ddd8be12e69dedb74b5012`
CI: `31311697220`

The repair added only Task-3 database-contract behavior:

- `event_journal.token_address`, `curve_address`, and `decoder_schema_version`;
- contract/block, token/block, and event-family journal indexes;
- `protocol_stacks` PK `(chain_id, stack_version, factory_address)`;
- unique launch curve constraint `(chain_id, curve_address)`;
- `indexer_checkpoints` PK `(chain_id, stack_version, factory_address)`;
- checkpoint deployment start, committed block timestamp, last canonical event identity fields, decoder/schema version, status, applied time, and update time;
- indexer advisory/checkpoint lookup keyed by full stack identity;
- read repository checkpoint lookup keyed by full stack identity;
- exported `DAY6_DB_SCHEMA_VERSION` marker.

Fresh exact-head CI result:

- bootstrap-validation: PASS
- dependency-build: PASS
  - `pnpm validate`: PASS
  - bootstrap tests: PASS
  - `pnpm test:day6`: PASS
  - compile-time shared contract: PASS
  - `pnpm typecheck`: PASS
  - `pnpm build`: PASS
  - tracked workspace clean: PASS
- foundry-bootstrap: PASS
  - Foundry build: PASS
  - generated ABI drift check: PASS
  - Solidity tests: PASS
- infrastructure-health: PASS
  - PostgreSQL ready
  - Redis PONG
  - original Task-3 DB suite: 4/4 PASS
  - exact schema-contract suite: 4/4 PASS
  - total real PostgreSQL Task-3 tests: 8/8 PASS

Verdicts:

`DAY6_TASK3_SOURCE_DESIGN_CONFORMANCE = PASS`

`DAY6_TASK3_TRANSACTION_BOUNDARY = PASS`

## Scope exclusions preserved

Task 3 does **not** introduce:

- Task-4 launch discovery or constructor-mint normalization;
- API routes or freshness envelopes;
- trade/candle/holder/fee/graduation reducer semantics;
- cache/fanout behavior;
- reconciliation PASS claims;
- server-side signing or financial write authority;
- production economics/admin values;
- Arc mainnet values or a canonical Arc DEX;
- Pons parity/audit conclusions;
- a fabricated Buyback source.

`DAY6_TASK3_INTEGRATED_PASS = PENDING_FINAL_DOCS_BEARING_EXACT_HEAD_CI_AND_GUARDED_MERGE`

`DAY6_TASK4 = BLOCKED_BY_TASK3_ACCEPTANCE_GATE`
