# Day 6 — SDK, Indexer & API Closeout Evidence

Date: 2026-08-09

Task-11 PR: #57

Durable Task-10 baseline: `bf16727a51b8b12cc51e638e12512991fd57e3d9`

candidate_head: `6b53714739e7ec59c885bf4215bda5d1e7c0ffc5`

The candidate above is the exact pre-final Task-11 head after the validator RED was repaired by adding this closeout evidence surface. It is fully green, but the documentation/CI/state-bearing head created after this evidence freeze still requires its own exact-head CI before merge.

## Mandatory Day-6 gates

`DELETE_DB_REBUILD_PASS = PASS`

Evidence owner: Task 10 deterministic rebuild/reconciliation. Accepted implementation/evidence head `04647d9c359959422803b95358c0ef693cfb0708`; dedicated Task-10 workflow `31338461147` PASS with real PostgreSQL/Redis steps; implementation merge `08e38978ebf48d533556b7f57e0a1c1cab10bf17`; durable Task-10 handoff merge `bf16727a51b8b12cc51e638e12512991fd57e3d9`.

`OVERLAP_REPLAY_IDEMPOTENT = PASS`

Evidence owner: Task 8 replay/finality/cache/fanout. Accepted evidence proves bounded overlap replay, journal/reducer idempotency, checkpoint-hash contradiction fail-closed behavior, and post-commit-only acceleration. Final durable Task-8 handoff merge: `5549f236460e923159eda3b1e12864b8a4d0ed0a`.

`API_FRESHNESS_METADATA_PRESENT = PASS`

Evidence owner: Task 4 canonical launch/read vertical and subsequent API tasks. Successful indexed API responses use `{ data, meta, page? }`; `FreshnessMeta` includes chain/schema identity, indexed-through block/hash/timestamp, served-at time, source and freshness status. Freshness derives from committed indexer checkpoint plus observed head. No raw RPC fallback is used for primary indexed route data.

`RECONCILE_PASS = PASS`

Evidence owner: Task 10 authoritative REC-01 through REC-06 reconciliation. Exact accepted Task-10 head `04647d9c359959422803b95358c0ef693cfb0708`; source/design/security conformance PASS; reconciliation mismatch is fail-closed and rebuild cannot return successful completion without PASS reconciliation.

`FIRST_MEANINGFUL_CONCURRENT_READ_REPLAY_CACHE_FANOUT_TESTS_PASS = PASS`

Evidence owner: Task 9 API/search/concurrency. Accepted implementation head `c2d8a91544ae179bd9e5f0c2f15a27aa9ba227dc`; dedicated Task-9 workflow `31331597046` PASS; durable Task-9 handoff merge `d6b6b26631f3e70f127595c55074d8cc20edce7a`. The proof covers hot Feed/Token collapse, bounded DB/search overload, Redis-loss fallback, replay/post-commit invalidation/fanout composition and slow-consumer containment.

## Cross-layer closeout assertions

`DAY6_API_ROUTE_COVERAGE = PASS`

All source-defined read endpoints are implemented and registered:

- `GET /v1/feed`
- `GET /v1/search`
- `GET /v1/tokens/:address`
- `GET /v1/tokens/:address/trades`
- `GET /v1/tokens/:address/holders`
- `GET /v1/portfolio/:address`
- `GET /v1/creators/:address`
- `GET /v1/status`

The production API remains read-only for protocol financial actions; no POST/PUT/PATCH/DELETE `/v1` transaction-submission route is registered.

`DAY6_ABI_DRIFT = PASS`

The canonical generated Bread ABI registry remains guarded by `scripts/abi/check-bread-abi.mjs`, root `abi:check` wiring and the Foundry CI ABI-drift step.

`DAY6_MIGRATION_REBUILD_IDENTITY = PASS`

The Day-6 migration contains the approved event journal plus all 12 source-defined data-model table families. Canonical event identity is `(chain_id, transaction_hash, log_index)`. The selected-stack rebuild starts from registered `deploymentStartBlock` and reuses production `applyRange()` rather than a second reconstruction algorithm.

`DAY6_RECONCILIATION_REPORT_IDENTITY = PASS`

The reconciliation report carries report version, chain/stack/factory identity, manifest/source hashes, deployment start, checked block/hash, canonical-event count, timings and typed REC-01..REC-06 rows. The rebuild report additionally carries isolated target identity/mode, range count, verdict and deterministic SHA-256 report hash.

`DAY6_NO_OPEN_CRITICAL_HIGH = PASS`

The completed task-level source/design/security reviews through Task 10 plus the Task-11 cross-layer validation review found no unresolved critical/high Day-6 SDK/indexer/API issue and no competing financial authority. This is a Day-6 implementation review result only; existing release/mainnet blockers remain in force and Day 8 retains the full attack-system/security/load gate.

## Task-11 RED -> GREEN proof

### Validator RED

Head: `581c9eb9bf790944b91ff45131e356152ba22691`

Root CI: `31339286733`

Observed bootstrap failure:

`Day-6 closeout evidence is required before PASS: docs/evidence/day6-sdk-indexer-api-closeout.md (ENOENT)`

Before that intended failure, manifest/build-gate/build-state and Day-2 through Day-5 source-integrity validators all passed. The new Day-6 validator had already checked route registration, read-only API surface, freshness type contract, approved table families, journal/checkpoint identity constraints and ABI-drift wiring.

`DAY6_TASK11_VALIDATOR_RED = PROVEN`

### Pre-final GREEN candidate

Exact head: `6b53714739e7ec59c885bf4215bda5d1e7c0ffc5`

All required workflows on this exact head executed real runner steps and passed:

- root CI `31339368671` — PASS all four jobs;
- retained Task 5 `31339368683` — PASS;
- retained Task 6 `31339368669` — PASS;
- retained Task 7 `31339368662` — PASS;
- retained Task 8 `31339368685` — PASS;
- retained Task 9 `31339368677` — PASS;
- retained/dedicated Task 10 `31339368673` — PASS.

Root CI proves the committed Task-11 plan's focused/prior regression requirements on the exact candidate:

- `pnpm validate` — PASS, including `validate-day6-read-stack.mjs`;
- bootstrap tests + smoke — PASS;
- `pnpm test` — PASS;
- `pnpm test:day6` — PASS;
- strict shared-contract type assertion — PASS;
- root TypeScript typecheck — PASS;
- workspace build — PASS;
- tracked workspace clean after build — PASS;
- Foundry compile — PASS;
- generated Bread ABI drift check — PASS;
- Solidity tests — PASS;
- PostgreSQL/Redis infrastructure health — PASS;
- Day-6 DB schema/transaction/launch/feed-cursor integration — PASS.

Retained Task 5–10 workflows independently executed their real PostgreSQL/Redis proof steps on the same SHA. No zero-step run is used as PASS evidence.

`DAY6_TASK11_PRE_FINAL_EXACT_HEAD_GATE = PASS_AT_6B53714739E7EC59C885BF4215BDA5D1E7C0FFC5`

## Closeout status

The next commit(s) update the root CI wording/integration and durable current-build-state using this exact proof. Those changes move the branch head, so this pre-final green candidate does not authorize merge by itself.

Still required:

1. final docs/state/CI-bearing Task-11 head exact repository CI;
2. retained Task 5–10 real-step PASS on that same head;
3. guarded merge with expected-head protection;
4. verify actual merged main;
5. create `docs/handoffs/day6-post-closeout-<actual-merged-main-short-sha>.md` only from actual merged main;
6. exact-head CI and guarded merge of that post-closeout handoff before Day 6 is durably closed.

`DAY6_TASK11_CLOSEOUT = PENDING_FINAL_DOCS_BEARING_EXACT_HEAD_CI_AND_GUARDED_MERGE`

`DAY6_DURABLE_CLOSEOUT = NOT_CLAIMED`

`DAY7 = BLOCKED_BY_DAY6_TASK11_CLOSEOUT_AND_POST_MERGE_HANDOFF`
