# Day 6 — SDK, Indexer & API Closeout Evidence

Date: 2026-08-09

Task-11 PR: #57

Durable Task-10 baseline: `bf16727a51b8b12cc51e638e12512991fd57e3d9`

candidate_head: `581c9eb9bf790944b91ff45131e356152ba22691`

The candidate above is the observed Task-11 validator RED head. Its repository bootstrap validation passed every inherited Day-1–Day-5 validator and all Day-6 structural assertions before failing only because this closeout evidence file did not yet exist. It is not a merge-authorizing head.

## Mandatory Day-6 gates assembled from accepted exact-head evidence

`DELETE_DB_REBUILD_PASS = PASS`

Evidence owner: Task 10 deterministic rebuild/reconciliation. Accepted implementation/evidence head `04647d9c359959422803b95358c0ef693cfb0708`; dedicated Task-10 workflow `31338461147` PASS with real PostgreSQL/Redis steps; implementation merge `08e38978ebf48d533556b7f57e0a1c1cab10bf17`; durable Task-10 handoff merge `bf16727a51b8b12cc51e638e12512991fd57e3d9`.

`OVERLAP_REPLAY_IDEMPOTENT = PASS`

Evidence owner: Task 8 replay/finality/cache/fanout. Accepted evidence proves bounded overlap replay, journal/reducer idempotency, checkpoint-hash contradiction fail-closed behavior, and post-commit-only acceleration. The final durable Task-8 handoff merge is `5549f236460e923159eda3b1e12864b8a4d0ed0a`.

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

The Day-6 migration contains the approved event journal plus the 12 source-defined data-model table families. Canonical event identity is `(chain_id, transaction_hash, log_index)`. The selected-stack rebuild starts from registered `deploymentStartBlock` and reuses production `applyRange()` rather than a second reconstruction algorithm.

`DAY6_RECONCILIATION_REPORT_IDENTITY = PASS`

The reconciliation report carries report version, chain/stack/factory identity, manifest/source hashes, deployment start, checked block/hash, canonical-event count, timings and typed REC-01..REC-06 rows. The rebuild report additionally carries isolated target identity/mode, range count, verdict and deterministic SHA-256 report hash.

`DAY6_NO_OPEN_CRITICAL_HIGH = PASS`

The completed task-level source/design/security reviews through Task 10 found no unresolved critical/high Day-6 SDK/indexer/API issue and no competing financial authority. This is a Day-6 implementation review result only; existing release/mainnet blockers remain in force and Day 8 retains the full attack-system/security/load gate.

## Task-11 validator RED

Task-11 validator head: `581c9eb9bf790944b91ff45131e356152ba22691`

Root CI run: `31339286733`

Observed bootstrap failure:

`Day-6 closeout evidence is required before PASS: docs/evidence/day6-sdk-indexer-api-closeout.md (ENOENT)`

Before that intended failure, manifest/build-gate/build-state and Day-2 through Day-5 source-integrity validators all passed. The new Day-6 validator had already checked route registration, read-only API surface, freshness type contract, all approved table families, journal/checkpoint identity constraints and ABI-drift wiring.

`DAY6_TASK11_VALIDATOR_RED = PROVEN`

## Closeout status

This evidence assembly does **not** yet declare Day 6 closed.

Still required by the committed Task-11 plan:

1. validator GREEN with this evidence present;
2. focused full Day-6 suite and exact ABI/validation/typecheck/build gates;
3. prior repository/bootstrap and Solidity regressions;
4. exact-head repository CI with the new Day-6 validator/test step;
5. guarded merge of the exact green audited Task-11 head;
6. fresh post-closeout handoff from actual merged main and docs-only exact-head guarded integration.

`DAY6_TASK11_CLOSEOUT = PENDING_EXACT_HEAD_FULL_SUITE_AND_GUARDED_MERGE`

`DAY6_DURABLE_CLOSEOUT = NOT_CLAIMED`

`DAY7 = BLOCKED_BY_DAY6_TASK11_CLOSEOUT_AND_POST_MERGE_HANDOFF`
