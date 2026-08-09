# Day 6 Task 9 — Read API, Search and Concurrency Durable Handoff

Date: 2026-08-09

## Integrated baseline

Task-9 implementation PR: #53

Task-9 accepted head: `c2d8a91544ae179bd9e5f0c2f15a27aa9ba227dc`

Task-9 merge: `faa4e6a5c76433b2724ed54b957f90a397d7716c`

Task-8 durable predecessor: `5549f236460e923159eda3b1e12864b8a4d0ed0a`

Task-9 evidence: `docs/evidence/day6-first-concurrent-read-replay-cache-fanout.md`

Durable handoff PR: #54

## Accepted Task-9 behavior

- all eight required public read endpoints now exist;
- `/v1/search` is DB/projection-owned and bounded;
- exact contract/creator plus normalized ticker/name prefix search is deterministic and stack/factory scoped;
- search has its own stricter protection namespace and cannot consume the feed limiter bucket;
- malformed search/address/cursor/limit requests fail before projection-read repository work;
- API DB work has finite active concurrency, finite queue depth and finite queue wait;
- Feed and Token hot reads are cache-first through the Task-8 generation/single-flight cache;
- 100 concurrent identical Feed reads collapse to one DB load per miss generation;
- 50 concurrent hot Token reads collapse to one indexed launch load;
- Redis-down Feed fallback remains bounded and truthful rather than producing a 500 storm;
- Search fails boundedly if its protective limiter cannot safely enforce policy;
- bounded DB/Search overload yields intentional backpressure rather than an unbounded queue;
- realtime fanout has bounded subscribers and bounded pending work per subscriber;
- slow consumers are dropped rather than accumulating an unbounded queue;
- replay -> durable apply -> post-commit invalidation/fanout composition is proven without duplicate financial effects;
- no route uses raw RPC as the primary read source;
- this is the source-defined first meaningful Day-6 concurrency proof, not the later Day-8 10,000-client production-like stress target.

## TDD and exact-head evidence

Initial RED: `a7e50f31b77d78380dde3a857e48181265c1aeb5`

Initial RED dedicated run: `31330747066`

Primitive GREEN: `d2803bfb61a9f3c7e4c87b93acade7ff1b5a2d12`

Primitive GREEN dedicated run: `31331025910` — 6/6 PASS.

Combined concurrency conformance RED: `9fbd5b208b122d0da878a0a6f669ab06f5cd2323`

Conformance RED dedicated run: `31331158501` — primitive 6/6 remained PASS; only hot-Token cache and bounded realtime-fanout assertions were RED while DB-overload containment already passed.

Corrected combined proof head: `8eb43a8107260781e6d5e038f2bf0bbc63bb78bf`

Combined dedicated run: `31331341467` — 9/9 PASS.

Final implementation/conformance pre-evidence head: `98be3af69a76fd22f3748dce4dfe1579b5a0f11f`

Final pre-evidence dedicated run: `31331499687` — 10/10 PASS, including direct validation-before-DB proof.

Final docs-bearing merge-authorizing head: `c2d8a91544ae179bd9e5f0c2f15a27aa9ba227dc`

Final workflow set:

- inherited CI `31331597034`: PASS all four jobs with real steps;
- retained Task-5 `31331597042`: PASS;
- retained Task-6 `31331597040`: PASS;
- retained Task-7 `31331597048`: PASS;
- retained Task-8 `31331597038`: PASS;
- dedicated Task-9 `31331597046`: PASS;
- Task-9 dedicated proof remains 10/10 PASS;
- PostgreSQL ready / Redis PONG;
- frozen install PASS with 328 supply-chain policy entries;
- root validation, Day-6 tests, typecheck, workspace build/clean-tree, Foundry/ABI and inherited PostgreSQL integration PASS.

## Source/design conformance

`DAY6_TASK9_SOURCE_DESIGN_CONFORMANCE = PASS`

`FIRST_MEANINGFUL_CONCURRENT_READ_REPLAY_CACHE_FANOUT_TESTS_PASS = PASS`

No Task-10 delete-DB rebuild/reconciliation implementation is included in Task 9.

## Authority boundaries retained

- chain/contracts remain financial authority;
- PostgreSQL/indexer/Redis/API remain rebuildable read surfaces and accelerators;
- no centralized trade server, signer, key custody, relay or transaction-submit surface was added;
- Redis and rate-limit state cannot authorize financial state;
- Search cannot resolve or mutate financial state from metadata;
- API freshness remains tied to committed indexer checkpoints;
- raw RPC remains outside the primary route read path.

## Continuation gate

Task 10 MUST NOT start from the implementation merge alone.

Required continuation order:

1. freeze this Task-9 durable handoff branch after the PR #54/current-state identity write;
2. run inherited CI plus retained Task-5/6/7/8 and dedicated Task-9 exact-head gates;
3. guarded-merge PR #54 only if all required jobs execute real steps and pass;
4. verify `main` exactly matches the handoff merge;
5. only then start Day-6 Task 10 from that durable `main` baseline, RED-first.

`DAY6_TASK9_IMPLEMENTATION = GUARDED_MERGE_PASS`

`DAY6_TASK9_DURABLE_HANDOFF = PENDING_EXACT_HEAD_CI_AND_MERGE`

`DAY6_TASK10 = BLOCKED_BY_TASK9_DURABLE_HANDOFF`
