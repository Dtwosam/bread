# Day 6 Task 8 — Replay, Finality, Cache and Fanout Durable Handoff

Date: 2026-08-09

## Integrated baseline

Task-8 implementation PR: #51

Task-8 accepted head: `71bb29d7525028f3c952ead3a8098fa197b0cfee`

Task-8 merge: `cbedc075ec5c041602290c5f79acff92bc70bbca`

Task-7 durable predecessor: `74f6629937eccc0cae3f4a4549be27715f6926e4`

Task-8 evidence: `docs/evidence/day6-task8-replay-finality-cache-fanout.md`

Durable handoff PR: #52

## Accepted Task-8 behavior

- overlap replay is bounded restart/idempotency behavior and is not confirmation depth;
- the committed checkpoint block hash is verified before replay range load/apply when the canonical verifier is supplied;
- a checkpoint hash contradiction fails closed as `CHECKPOINT_BLOCK_HASH_MISMATCH` before projection rewrite;
- journal/projection/checkpoint durability remains PostgreSQL-owned;
- cache invalidation and realtime fanout happen only after the DB transaction has committed successfully;
- post-commit acceleration failure surfaces as degraded and never rolls back the committed DB state;
- logical channels are coalesced and invalidation hints are bounded and causal;
- API/indexer pin exact `redis@6.1.0` with the pnpm-generated lock;
- cache generations plus bounded payload TTL provide deterministic invalidation with stale-healing bounds;
- process-local and Redis cross-instance single-flight reduce hot-miss duplication with bounded waiting;
- Redis failures fall back to DB-backed reads and do not become financial/read authority;
- real node-redis operations are proven against the Bread Redis container.

## TDD and exact-head evidence

Initial RED: `bd2b13955890d0eb6cfb4775356cedabf75a5650`

First implementation GREEN: `45bd2640d8b39caa7113ff824bd6896c59d4a034`

Strengthened conformance RED: `aa3af1363631e26941447969a13ec92cc3a04f28`

Final docs-bearing merge-authorizing head: `71bb29d7525028f3c952ead3a8098fa197b0cfee`

Final workflow set:

- inherited CI `31329811060`: PASS all four jobs with real steps;
- retained Task-5 `31329811046`: PASS;
- retained Task-6 `31329811089`: PASS;
- retained Task-7 `31329811049`: PASS;
- dedicated Task-8 `31329811051`: PASS;
- dedicated Task-8 suite: 10/10 PASS across two files;
- real `redis@6.1.0` integration: 2/2 PASS;
- PostgreSQL ready / Redis PONG;
- frozen install PASS with 328 supply-chain policy entries;
- root validation, Day-6 tests, typecheck, workspace build/clean-tree, Foundry/ABI and inherited PostgreSQL integration PASS.

## Actions budget incident disposition

During Task 8, GitHub Actions temporarily created jobs with `steps:null` across the repo while account Actions spend capacity was unavailable. Those executions were treated as external runner blockage only; none was counted as code failure or PASS, no gate was weakened, and no commit was created merely to escape the blocker.

After the account Actions budget was increased, the unchanged/frozen candidate resumed real runner execution and passed the required gates.

`GITHUB_ACTIONS_ZERO_STEP_BLOCKER = RESOLVED_BY_ACCOUNT_ACTIONS_BUDGET_CAPACITY`

## Authority and scope boundaries retained

- chain/contracts remain authoritative for financial state;
- PostgreSQL/indexer/Redis/API remain deterministic read projections/accelerators;
- no server-side signing, key custody, transaction submission or financial relay was added;
- Redis cannot authorize or mutate financial state;
- finality contradictions halt/reconcile rather than silently rewrite accepted history;
- Task 9 search, rate limiting and first meaningful concurrent read/replay/cache/fanout proof remain next-lane work;
- Task 10 delete-DB rebuild and reconciliation remain later-lane work.

## Continuation gate

Task 9 MUST NOT start from the implementation merge alone.

Required continuation order:

1. freeze this Task-8 durable handoff branch after the PR #52/current-state identity write;
2. run the inherited full CI plus retained Task-5/6/7 and dedicated Task-8 exact-head gates;
3. guarded-merge PR #52 only if all required jobs execute real steps and pass;
4. verify `main` exactly matches the handoff merge;
5. only then start Day-6 Task 9 from that durable `main` baseline, RED-first.

`DAY6_TASK8_IMPLEMENTATION = GUARDED_MERGE_PASS`

`DAY6_TASK8_DURABLE_HANDOFF = PENDING_EXACT_HEAD_CI_AND_MERGE`

`DAY6_TASK9 = BLOCKED_BY_TASK8_DURABLE_HANDOFF`
