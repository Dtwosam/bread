# Day 6 Task 8 — Replay, Finality, Cache and Logical Fanout Evidence

Date: 2026-08-09

Baseline: `74f6629937eccc0cae3f4a4549be27715f6926e4` (Task 7 durable handoff merge)

PR: #51

## Accepted scope

- bounded overlap replay for restart/idempotency only;
- committed checkpoint hash contradiction fails closed before replay projection work;
- journal/projection/checkpoint durability remains PostgreSQL-owned;
- cache invalidation and realtime fanout happen only after durable DB commit;
- post-commit failures degrade availability but never roll back committed DB state;
- logical-channel coalescing with bounded causal invalidation hints;
- exact `redis@6.1.0` runtime dependency in API and indexer;
- cache generations, bounded payload TTL, process-local and Redis cross-instance single-flight;
- Redis remains an availability accelerator and never read/financial authority;
- real node-redis integration against the Bread Redis container.

Task 9 search/rate-limit/DB concurrency work and Task 10 rebuild/reconciliation remain out of scope.

## TDD RED

Initial RED head: `bd2b13955890d0eb6cfb4775356cedabf75a5650`

- PostgreSQL and Redis infrastructure healthy.
- Five Task-8 assertions failed because replay/post-commit/cache production surfaces were absent.
- Retained Task-5/6/7 regressions remained green.

First implementation GREEN head: `45bd2640d8b39caa7113ff824bd6896c59d4a034`

- inherited CI PASS;
- retained Task-5 PASS;
- retained Task-6 PASS;
- retained Task-7 PASS;
- initial Task-8 PostgreSQL/Redis proof 5/5 PASS;
- exact `redis@6.1.0` dependency/lock generated with pinned pnpm 11.15.1;
- frozen install recognized 328 supply-chain policy entries.

Source-conformance review found acceptance-level gaps in cross-instance single-flight/TTL, causal hint fields, degraded publication propagation and replay-integrated checkpoint verification.

Strengthened RED head: `aa3af1363631e26941447969a13ec92cc3a04f28`

Dedicated run: `31327795954`

- PostgreSQL and Redis healthy.
- Eight tests executed.
- Two existing behaviors PASS.
- Six expected missing-behavior assertions FAIL.
- Failures were limited to the source-conformance gaps; no infrastructure or dependency failure.

## GREEN repair

Repair modules:

- `apps/indexer/src/replay.ts`
- `apps/indexer/src/post-commit.ts`
- `apps/api/src/cache.ts`

The repair adds:

- checkpoint-anchor verification before range load/apply when replay is given the committed hash verifier;
- `CHECKPOINT_BLOCK_HASH_MISMATCH` fail-closed behavior before projection rewrite;
- bounded logical-channel causal hints carrying change domain, affected identity, causal event id and committed checkpoint identity;
- explicit `POST_COMMIT_DEGRADED` propagation while preserving the already-committed DB result;
- bounded Redis `SET NX PX` cross-instance lock ownership;
- ownership-safe Lua release with a TTL safety bound;
- bounded waiter polling, process-local single-flight and DB fallback;
- 30-second cache payload TTL plus generation invalidation;
- exact node-redis client integration against real Redis.

## GitHub Actions quota incident

Candidate execution was temporarily blocked by account-level Actions spend capacity.

Zero-step examples:

- root CI `31327984802` — all jobs `steps:null`;
- Task-8 `31327984840` — job `steps:null`;
- retained Task-5/6/7 failed in the same zero-step window;
- controlled reruns also returned zero-step before the account Actions budget was increased.

No zero-step run was treated as code failure, PASS or merge evidence. No workflow gate was weakened and no branch-content change was made merely to bypass the runner block.

After the account Actions budget was increased, the same frozen workflow runs were rerun and executed real steps successfully.

## Exact implementation/conformance proof before evidence write

Head: `ff7186de8729c26ac25807bf93bce0e44aab4759`

Rerun workflow identities:

- inherited CI: `31328299025` — PASS all four jobs with real steps;
- retained Task-5: `31328298989` — PASS;
- retained Task-6: `31328299013` — PASS;
- retained Task-7: `31328298986` — PASS;
- dedicated Task-8: `31328298983` — PASS.

Dedicated Task-8 command:

`pnpm exec vitest run tests/day6/replay-finality-cache-fanout.test.ts tests/day6/replay-cache-real-redis.test.ts`

Result:

- 2 test files PASS;
- 10/10 tests PASS;
- 8 replay/finality/cache/fanout contract + PostgreSQL boundary tests PASS;
- 2 real `redis@6.1.0` client tests PASS;
- PostgreSQL ready and Redis PONG before execution;
- frozen pnpm install PASS with 328 supply-chain policy entries.

Inherited CI on the same head additionally proves:

- validation PASS;
- bootstrap tests PASS;
- `pnpm test` PASS;
- `pnpm test:day6` PASS;
- compile-time shared contract PASS;
- root typecheck PASS;
- workspace build PASS;
- tracked workspace clean after build;
- generated ABI drift check PASS;
- Solidity bootstrap tests PASS;
- inherited PostgreSQL integration PASS.

## Source/design conformance verdict

`DAY6_TASK8_SOURCE_DESIGN_CONFORMANCE = PASS`

The implementation remains rebuildable/read-only relative to chain authority. Redis/cache/realtime are non-authoritative accelerators. A committed checkpoint hash contradiction halts replay before projection apply. Post-commit acceleration failure is surfaced as degraded without converting an already committed PostgreSQL transaction into a rollback or financial retry.

This evidence write intentionally moves the branch head. Therefore the `ff7186de...` proof does **not** authorize merge of the documentation-bearing head. A new full exact-head workflow set is required before guarded merge.

`DAY6_TASK8_GUARDED_ACCEPTANCE = PENDING_FINAL_DOCS_BEARING_EXACT_HEAD_CI_AND_MERGE`

`DAY6_TASK9 = BLOCKED_BY_TASK8_ACCEPTANCE_AND_DURABLE_HANDOFF`
