# Day 6 Task 4 — Canonical launch vertical evidence

Date: 2026-08-09
Repository: `Dtwosam/bread`
Task baseline: `cf1078109297f56f060113576d364e920e368d17`
PR: #43

## Scope

Task 4 is restricted to the accepted first Day-6 vertical slice:

- deterministic two-pass Factory-first launch discovery;
- bounded expansion to known + newly discovered launch token/curve addresses;
- canonical log dedupe and chain-order sorting;
- constructor-mint-aware launch normalization;
- immutable Factory/curve/token snapshot cross-checks before DB apply;
- write-once launch projection through Task 3's journal + reducer + checkpoint transaction boundary;
- first read routes: `GET /v1/status`, `GET /v1/feed`, `GET /v1/tokens/:address`;
- approved success envelope `{ data, meta, page? }`;
- deterministic New-feed ordering and bounded opaque keyset cursor pagination;
- malformed/unindexed address and malformed/unsupported cursor handling without RPC fallback;
- sanitized display metadata before persistence;
- later-range classification for previously indexed launch token/curve addresses;
- bounded status head/lag and explicit unavailable queue/backlog state.

No Task-5 trade/candle normalization or later Day-6 replay/cache/reconciliation behavior is claimed here.

## Original Task-4 RED — PROVEN

Head: `8f8524022117ebbd4ac56b2a1a20b648150e90eb`
CI: `31312344848`

Result:

- bootstrap-validation: PASS;
- foundry-bootstrap: PASS;
- prior active Day-6 tests remained green;
- discovery assertion failed because `discoverRange` was absent;
- PostgreSQL/Redis startup and health passed;
- inherited Task-3 PostgreSQL suites remained 8/8 PASS;
- Task-4 launch vertical failed 3/3 only because the required Task-4 indexer/API surface was absent.

`DAY6_TASK4_ORIGINAL_RED = PROVEN`

## First complete launch-vertical GREEN — PROVEN, NOT FINAL

Head: `f3d9e466c89026805c3a2cc31baaefa041cf3644`
CI: `31312972457`

All four jobs passed and the real PostgreSQL lane reached 11/11 PASS (Task-3 8 + Task-4 launch 3). This was not accepted because source review found missing later-range launch-role preservation, display-metadata sanitization, and status head/lag exposure.

## Invalid conformance harness run — NOT RED

Head: `01e07f933dc1b6a0825592fbb992a9de728871dc`
CI: `31313135858`

The conformance file contained a TypeScript syntax error (`readonly Array<...>`), so its assertions did not execute. This run is explicitly not RED evidence.

## Source-conformance RED — PROVEN

Head: `a1b98b5993247373709cea5c6b5c3eec168a4a92`
CI: `31313242911`

The three intended assertions executed and failed exactly because:

1. a later-range log from a previously indexed launch token was not classified;
2. `sanitizeDisplayMetadata` was absent;
3. `buildStatusData` was absent.

Previously green launch/PostgreSQL behavior stayed green.

`DAY6_TASK4_SOURCE_CONFORMANCE_RED = PROVEN`

## Source-conformance GREEN — PROVEN

After behavior repair, head `f96fd850c762417a55a8d0bfcfabe6b5ded83d6d` showed the intended tests and PostgreSQL lane green but root TypeScript caught one invalid cache-state comparison. That static issue was corrected without changing runtime behavior.

Corrected head: `65d5346180d94dc348cf57b3d549e8f7eebb4616`
CI: `31313461703`

All four jobs passed. Source review then found the remaining required feed cursor contract.

## Cursor unit RED — PROVEN

Head: `f92b10c95f5405e2d26f38a0685435b849539e3f`
CI: `31313542854`

Two intended failures:

- versioned opaque New-feed cursor helpers were absent;
- malformed cursor fell through to DB/server failure instead of returning bounded 400.

Existing launch/conformance behavior stayed green.

`DAY6_TASK4_CURSOR_UNIT_RED = PROVEN`

## Real-PostgreSQL cursor RED — PROVEN

Head: `8793c0538ac9a4e5db1043e368658776b70ec1c2`
CI: `31313641157`

Inherited PostgreSQL behavior remained 11/11 PASS, while the new keyset-pagination proof failed only because page one incorrectly reported `hasMore:false`. This proved real `limit+1` keyset pagination was still missing.

`DAY6_TASK4_CURSOR_POSTGRES_RED = PROVEN`

## Cursor GREEN — PROVEN

Head: `80ef10c4ac5d63ed7d79e86a6444a25f24b4afe4`
CI: `31313790023`

All four jobs passed. Cursor unit tests passed, and real PostgreSQL pagination passed with stable New ordering, opaque `nextCursor`, no overlap, and no offset pagination.

## Status queue/backlog RED — PROVEN

Head: `7f6575311bc651815a8ae4c826fc77e6d0167706`
CI: `31313871623`

`pnpm test:day6` had 20 prior active tests PASS and exactly one failure: status omitted source-required backlog/queue state. The expected behavior was explicit `UNAVAILABLE`, not fabricated zero counts.

`DAY6_TASK4_STATUS_QUEUE_BACKLOG_RED = PROVEN`

## Final implementation GREEN — PROVEN

Exact implementation head: `e1d83d223bb262b857ff6bac541698d61c1d131a`
CI: `31313920503`

Fresh exact-head result:

- bootstrap-validation: PASS;
- dependency-build: PASS;
  - frozen install / supply-chain policy: PASS;
  - validation: PASS;
  - bootstrap tests: PASS;
  - `pnpm test:day6`: PASS;
  - compile-time shared contract: PASS;
  - root `pnpm typecheck`: PASS;
  - root `pnpm build`: PASS;
  - tracked workspace clean: PASS;
- foundry-bootstrap: PASS;
  - pinned Foundry build: PASS;
  - generated ABI drift check: PASS;
  - Solidity tests: PASS;
- infrastructure-health: PASS;
  - PostgreSQL ready;
  - Redis PONG;
  - `db-schema.test.ts`: 4/4 PASS;
  - `db-schema-contract.test.ts`: 4/4 PASS;
  - `launch-vertical.test.ts`: 3/3 PASS;
  - `feed-cursor-db.test.ts`: 1/1 PASS;
  - exact real-PostgreSQL total: **12/12 PASS**.

## Accepted implementation properties

- Factory-first two-pass discovery captures constructor mint before `LaunchCreated` and supports later same-transaction logs.
- Address/range work is bounded; known + new token/curve identities are used rather than global ERC-20 scanning.
- Constructor mint is required to be `zero -> exact curve`, same transaction, before `LaunchCreated`, with positive exact supply.
- Launch initial supply never comes from current `totalSupply()`.
- Factory `getLaunch` / `stackVersion`, curve immutable/snapshotted getters, and launch-token metadata/identity getters are cross-checked before DB apply.
- Every getter used by normalization is present in the exact Foundry-artifact-derived ABI allowlist and remains protected by ABI drift CI.
- Previously indexed launch identities are read from `@bread/db` and used for later-range token/curve classification.
- Display metadata is sanitized/bounded before persistence; dangerous `javascript:` / `data:` URL schemes are rejected.
- Financial/contract snapshot fields stay exact; sanitization does not rewrite financial authority.
- Task-4 launch reducer executes inside Task 3's atomic journal + projection + checkpoint transaction.
- `GET /v1/tokens/:address` canonicalizes address before DB, returns bounded 400/404, and never RPC-falls back for malformed/unindexed tokens.
- `GET /v1/feed` implements New ordering: launch block/time DESC, launch log DESC, token address ASC.
- Feed pagination uses a bounded versioned base64url opaque keyset cursor over only deterministic New-feed sort fields; malformed/unsupported cursors return 400 before DB access.
- Non-New source-defined views return explicit bounded not-ready response rather than fake empty data.
- Successful indexed routes use `{ data, meta, page? }`; the superseded `{ data, freshness }` shorthand is not used.
- Freshness derives from committed checkpoint + observed head; status exposes head/lag and explicit unavailable queue/backlog without secrets or fabricated health counts.
- No server signing, relaying, transaction submission, transaction queueing, or key custody exists.
- No Task-5 trade/candle/fee/holder/graduation reducer semantics are introduced.

## Verdict

`DAY6_TASK4_SOURCE_DESIGN_CONFORMANCE = PASS`

`DAY6_TASK4_CANONICAL_LAUNCH_VERTICAL = PASS`

`DAY6_TASK4_INTEGRATED_PASS = PENDING_FINAL_DOCS_BEARING_EXACT_HEAD_CI_AND_GUARDED_MERGE`

`DAY6_TASK5 = BLOCKED_BY_TASK4_ACCEPTANCE_GATE`
