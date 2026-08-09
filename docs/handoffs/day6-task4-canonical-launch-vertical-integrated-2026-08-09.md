# Day 6 Task 4 — Canonical launch vertical integrated handoff

Date: 2026-08-09
Repository: `Dtwosam/bread`
Handoff PR: #44

## Integrated baseline

- Previous durable Day-6 baseline: `cf1078109297f56f060113576d364e920e368d17` (Task-3 handoff merge, PR #42).
- Task-4 implementation PR: #43.
- Task-4 merge-authorizing head: `2d0a5c121cbafab61bfbff6c513c24f896eaf44c`.
- Task-4 merge-authorizing CI: `31314165450`.
- Task-4 guarded merge: `0ce425e15d72202d82fa8d8b47f017e46202187c`.
- `main` was verified identical to `0ce425e15d72202d82fa8d8b47f017e46202187c` immediately after merge.

## Exact accepted Task-4 surface

Task 4 integrated the first canonical launch vertical only:

- deterministic two-pass Factory-first log discovery;
- bounded inclusion of already indexed + newly discovered launch token/curve addresses;
- canonical identity dedupe and chain-order sorting;
- constructor-mint-aware launch normalization;
- launch initial supply derived only from same-transaction `Transfer(0x0 -> curve, amount)` before `LaunchCreated`;
- immutable/snapshotted Factory, curve, and launch-token identity/economic cross-checks before DB apply;
- display metadata sanitization before persistence;
- later-range classification seeded from already indexed launch identities in PostgreSQL;
- write-once launch snapshot projection through Task 3's journal + reducer + checkpoint transaction boundary;
- `GET /v1/status`;
- `GET /v1/feed` for the deterministic New view;
- `GET /v1/tokens/:address`;
- approved indexed success envelope `{ data, meta, page? }`;
- malformed/unindexed token handling without RPC fallback;
- deterministic New-feed ordering: launch block/time DESC, launch log DESC, token address ASC;
- bounded versioned opaque base64url keyset cursor, no offset pagination;
- malformed/unsupported cursors rejected with bounded 400 before DB access;
- observed head/lag in freshness/status;
- explicit unavailable queue/backlog status rather than fabricated counts;
- no secret-bearing status fields.

Chain/contracts remain financial authority. PostgreSQL/indexer/API remain deterministic rebuildable read surfaces.

## TDD evidence

### Original Task-4 RED

- Head: `8f8524022117ebbd4ac56b2a1a20b648150e90eb`
- CI: `31312344848`
- Result: prior Task-3 PostgreSQL suites remained 8/8 PASS; Task-4 discovery/apply/API behavior was absent as expected.

`DAY6_TASK4_ORIGINAL_RED = PROVEN`

### First launch vertical GREEN

- Head: `f3d9e466c89026805c3a2cc31baaefa041cf3644`
- CI: `31312972457`
- All four jobs PASS; real PostgreSQL total 11/11.
- Not accepted because final source review found additional Task-4 conformance gaps.

### Source-conformance RED / GREEN

- Invalid harness head: `01e07f933dc1b6a0825592fbb992a9de728871dc`, CI `31313135858` — explicitly NOT RED because test syntax prevented assertions.
- Valid RED head: `a1b98b5993247373709cea5c6b5c3eec168a4a92`, CI `31313242911`.
- RED proved missing later-range indexed-launch classification, display metadata sanitizer, and bounded status-data builder.
- Corrected GREEN head: `65d5346180d94dc348cf57b3d549e8f7eebb4616`, CI `31313461703`, all four jobs PASS.

`DAY6_TASK4_SOURCE_CONFORMANCE_RED = PROVEN`

### Cursor RED / GREEN

- Unit RED: `f92b10c95f5405e2d26f38a0685435b849539e3f`, CI `31313542854`.
- Real-PostgreSQL RED: `8793c0538ac9a4e5db1043e368658776b70ec1c2`, CI `31313641157`; inherited 11 PG tests PASS, keyset pagination 1 expected FAIL.
- GREEN: `80ef10c4ac5d63ed7d79e86a6444a25f24b4afe4`, CI `31313790023`, all four jobs PASS and PG 12/12.

`DAY6_TASK4_CURSOR_CONTRACT = PASS`

### Status queue/backlog RED

- Head: `7f6575311bc651815a8ae4c826fc77e6d0167706`
- CI: `31313871623`
- Result: 20 prior active tests PASS, exactly one intended failure because backlog/queue were omitted.
- Repair used explicit `UNAVAILABLE`; it did not invent queue/backlog counts.

`DAY6_TASK4_STATUS_QUEUE_BACKLOG_RED = PROVEN`

### Final implementation GREEN

- Head: `e1d83d223bb262b857ff6bac541698d61c1d131a`
- CI: `31313920503`
- All four jobs PASS.
- Real PostgreSQL total: 12/12 PASS.

### Final merge-authorizing docs-bearing head

- Head: `2d0a5c121cbafab61bfbff6c513c24f896eaf44c`
- CI: `31314165450`
- bootstrap-validation: PASS
- dependency-build: PASS, including validation, all active Day-6 tests, compile-time shared contract, root typecheck, build, and clean tracked tree
- foundry-bootstrap: PASS, including exact generated ABI drift check and Solidity tests
- infrastructure-health: PASS
  - PostgreSQL ready
  - Redis PONG
  - `db-schema.test.ts`: 4/4 PASS
  - `db-schema-contract.test.ts`: 4/4 PASS
  - `launch-vertical.test.ts`: 3/3 PASS
  - `feed-cursor-db.test.ts`: 1/1 PASS
  - exact real-PostgreSQL total: 12/12 PASS
- guarded expected-head merge: `0ce425e15d72202d82fa8d8b47f017e46202187c`
- merged `main`: verified identical immediately after integration

`DAY6_TASK4_SOURCE_DESIGN_CONFORMANCE = PASS`

`DAY6_TASK4_CANONICAL_LAUNCH_VERTICAL_INTEGRATED_PASS = TRUE`

## Explicit exclusions / unresolved gates

This handoff does not claim or introduce:

- Task-5 BUY/SELL correlation, trade projection, candles, token metrics, or trade API;
- fee/creator/admin/graduation reducers;
- holder/portfolio projections;
- replay/finality/cache/fanout implementation beyond existing Task-3/Task-4 primitives;
- `DELETE_DB_REBUILD_PASS`;
- `OVERLAP_REPLAY_IDEMPOTENT`;
- full Day-6 `RECONCILE_PASS`;
- full Day-6 concurrency/cache/fanout closeout gate;
- server-side signing, relaying, transaction submission, queueing, or key custody;
- production economics/admin values;
- Arc mainnet values or canonical Arc DEX values;
- Pons parity/audit conclusions;
- a fabricated Buyback authority/event surface.

## Exact continuation

Task 5 stays blocked until this documentation/state-only handoff receives its own exact-head full CI and guarded merge.

After that, start Task 5 from the newly integrated `main`, RED-first. Task 5 is restricted to transaction-local BUY/SELL correlation, exact trade projection/candles/token metrics, `GET /v1/tokens/:address/trades`, and the approved token/feed read enrichment. Canonical BUY trade identity is the `CurveBuy` log identity; refund/opening-protection logs enrich that trade but do not create separate trades. Canonical SELL identity is `CurveSell`.
