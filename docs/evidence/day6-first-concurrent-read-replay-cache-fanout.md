# Day 6 — First Meaningful Concurrent Read / Replay / Cache / Fanout Evidence

Date: 2026-08-09

Baseline: `5549f236460e923159eda3b1e12864b8a4d0ed0a` (Task-8 durable handoff merge)

PR: #53

## Accepted Task-9 scope

- complete the eighth required read endpoint, `GET /v1/search`;
- DB-owned deterministic search by exact contract/creator and normalized ticker/name prefixes;
- bounded search term/page inputs with approximately two-character text threshold;
- isolated search and feed rate-limit buckets;
- bounded API database concurrency, bounded queue depth and bounded queue wait;
- cache-first Feed and Token reads;
- Redis-loss process-local collapse / bounded DB fallback without a 500 storm;
- validation failures before repository work;
- no route-level RPC as the primary read path;
- first meaningful Day-6 concurrent read/replay/cache/fanout proof including slow-consumer containment.

Task 10 delete-DB rebuild/reconciliation remains out of scope.

## Initial TDD RED

Head: `a7e50f31b77d78380dde3a857e48181265c1aeb5`

Dedicated Task-9 run: `31330747066`

- frozen install PASS;
- PostgreSQL ready;
- Redis PONG;
- 6/6 Task-9 assertions executed and failed on the intended missing behavior:
  1. search route absent;
  2. 100 identical concurrent Feed requests caused 100 DB loads instead of one;
  3. isolated Search limiter absent;
  4. deterministic contract/creator/ticker/name Search absent;
  5. Redis-down Feed fallback caused 40 DB loads instead of one;
  6. malformed Search requests were unhandled rather than bounded validation failures.

Retained exact-head regressions:

- Task-5 `31330747047`: PASS;
- Task-6 `31330747063`: PASS;
- Task-7 `31330747049`: PASS;
- Task-8 `31330747052`: PASS;
- root CI `31330747061`: bootstrap, Foundry/ABI and infrastructure PASS; dependency-build failed only because the new Task-9 RED was included in `pnpm test:day6`.

`DAY6_TASK9_INITIAL_RED = PROVEN`

## Primitive GREEN

Head: `d2803bfb61a9f3c7e4c87b93acade7ff1b5a2d12`

Implementation introduced:

- `SearchRepository` in `@bread/db` with exact stack/factory scoping, exact contract/creator matches and normalized ticker/name prefix matches;
- bounded `BoundedReadGate` with finite active work, finite queue and finite queue timeout;
- Redis-backed isolated `feed` and `search` limiter namespaces;
- eighth `/v1/search` route with validation before repository work;
- cache-first Feed using Task-8 cache generations/single-flight while preserving indexed checkpoint metadata;
- bounded Redis-down Feed fallback;
- all eight required routes registered by the API server.

Dedicated Task-9 run `31331025910`: 6/6 PASS against real PostgreSQL/Redis.

Same-head workflow set:

- inherited CI `31331025918`: PASS;
- retained Task-5 `31331025894`: PASS;
- retained Task-6 `31331025909`: PASS;
- retained Task-7 `31331025895`: PASS;
- retained Task-8 `31331025893`: PASS;
- dedicated Task-9 `31331025910`: PASS 6/6.

## Source-conformance RED

Source review found two missing Day-6 concurrency requirements:

1. hot Token reads were still uncached;
2. realtime fanout had no bounded slow-consumer containment layer.

Tests-only conformance head: `9fbd5b208b122d0da878a0a6f669ab06f5cd2323`

Dedicated run: `31331158501`

- primitive Task-9 suite stayed 6/6 PASS;
- bounded DB/search overload assertion already PASS;
- exactly three new assertions FAIL:
  - bounded realtime fanout export absent;
  - replay/cache/fanout slow-consumer composition absent;
  - hot-token concurrent reads were not collapsed.

`DAY6_TASK9_CONCURRENCY_CONFORMANCE_RED = PROVEN`

## Conformance repair

Production repairs:

- Token detail became cache-first through the same Task-8 generation/single-flight discipline as Feed;
- added `BoundedRealtimeFanout` with finite subscriber capacity and finite per-subscriber pending work;
- slow subscribers are dropped rather than accumulating an unbounded queue;
- combined replay -> durable apply -> post-commit invalidation -> fanout composition remains non-authoritative and cache-aware;
- bounded DB/search overload returns intentional 503 backpressure rather than unbounded queue growth.

An intermediate composition test used the wrong already-accepted Task-8 replay parameter shape. That was a test-harness mismatch only; production behavior was not changed for it. The fixture was corrected to use `checkpoint: { blockNumber, blockHash }`.

Head `8eb43a8107260781e6d5e038f2bf0bbc63bb78bf` dedicated Task-9 run `31331341467`:

- 2 files PASS;
- 9/9 tests PASS;
- 100-way Feed hot miss collapses to one DB load;
- 50-way hot Token read collapses to one indexed launch load;
- bounded Search/DB overload yields only successful reads or intentional 503 backpressure;
- replay/post-commit cache invalidation causes one fresh load after the new committed event;
- fast fanout subscriber remains serviceable while the slow subscriber is dropped;
- maximum observed slow-subscriber pending work remains <= 1.

## Validation-before-DB hardening

The earlier malformed-input assertion inferred DB non-use indirectly. A standalone direct repository-spy proof was added without changing production behavior.

Final implementation/conformance head before this evidence write:

`98be3af69a76fd22f3748dce4dfe1579b5a0f11f`

Dedicated Task-9 run: `31331499687`

Result:

- 3 test files PASS;
- 10/10 tests PASS;
- PostgreSQL ready;
- Redis PONG;
- frozen install PASS with 328 supply-chain policy entries;
- direct validation-before-DB test proves malformed Search, Token, Feed cursor and limit requests return 400 without calling SearchRepository/ReadRepository projection methods.

Same-head workflow set:

- inherited CI `31331499693`: PASS all four jobs with real steps;
- retained Task-5 `31331499655`: PASS;
- retained Task-6 `31331499676`: PASS;
- retained Task-7 `31331499680`: PASS;
- retained Task-8 `31331499678`: PASS;
- dedicated Task-9 `31331499687`: PASS 10/10.

Inherited CI additionally proves:

- validation PASS;
- bootstrap tests PASS;
- root `pnpm test` PASS;
- `pnpm test:day6` PASS;
- shared compile-time contract PASS;
- formatting gate PASS;
- root typecheck PASS;
- workspace build PASS;
- build leaves tracked workspace clean;
- Foundry compile/ABI drift/tests PASS;
- inherited PostgreSQL integration PASS.

## Source/design conformance verdict

`DAY6_TASK9_SOURCE_DESIGN_CONFORMANCE = PASS`

The accepted surface now has all eight required read endpoints. Search is bounded and projection-owned; rate-limit namespaces are isolated; Feed/Token hot misses collapse; Redis loss is bounded; DB work and queue depth are bounded; validation happens before DB projection reads; no route uses raw RPC as a primary read source; replay/post-commit invalidation and fanout remain downstream of the durable DB transaction; slow realtime consumers cannot grow an unbounded per-subscriber queue.

The Day-8 full 10,000-client / production-like p95 stress target is intentionally not claimed here. This is the source-defined first meaningful Day-6 concurrency proof.

This evidence write intentionally moves the branch head. Therefore the `98be3af6...` proof does not authorize the documentation-bearing merge candidate. A fresh exact-head six-workflow gate is required before guarded merge.

`FIRST_MEANINGFUL_CONCURRENT_READ_REPLAY_CACHE_FANOUT_TESTS_PASS = PROVEN_PRE_EVIDENCE_HEAD`

`DAY6_TASK9_GUARDED_ACCEPTANCE = PENDING_FINAL_DOCS_BEARING_EXACT_HEAD_CI_AND_MERGE`

`DAY6_TASK10 = BLOCKED_BY_TASK9_ACCEPTANCE_AND_DURABLE_HANDOFF`
