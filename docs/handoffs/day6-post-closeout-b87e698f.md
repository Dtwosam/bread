# Day 6 — Post-Closeout Durable Handoff

Date: 2026-08-09

## Actual merged-main baseline

Task-11 implementation/closeout PR: #57

Accepted Task-11 exact head:

`9d84fafbf0be36337e9a362eeeecb01010a0f255`

Expected-head-protected Task-11 merge:

`b87e698f382d2a226c2914a4ddd556b7925ed001`

Fresh verification after merge:

`main == b87e698f382d2a226c2914a4ddd556b7925ed001`

Post-closeout handoff branch:

`docs/day6-post-closeout-b87e698f`

Post-closeout handoff PR: #58

## Day-6 final acceptance

The controlling Day-6 scope from the Project Sources is complete at the implementation level:

- shared event/API/domain contracts are frozen and consumed;
- protocol SDK/ABI/address/transaction-builder/error-decoding surfaces are implemented;
- PostgreSQL event journal, transactional projections and checkpoints are implemented;
- replay/finality contradiction handling is fail-closed;
- bounded cache/realtime/search/API concurrency behavior is proven;
- Feed/Search/Token/Trades/Holders/Portfolio/Creator/Status read routes are implemented and carry indexed freshness metadata;
- API remains read-only for protocol financial actions;
- selected-stack delete/rebuild starts at registered `deploymentStartBlock` and reuses production `applyRange()`;
- destructive rebuild requires verified `LOCAL_TEST` or `ISOLATED_REPLACEMENT` target isolation before deletion;
- authoritative reconciliation REC-01 through REC-06 is mandatory and fail-closed;
- rebuild cannot report success without PASS reconciliation;
- deterministic rebuild/reconciliation reports carry explicit identity/provenance;
- chain/contracts remain financial authority; PostgreSQL/indexer/Redis/API remain deterministic rebuildable projections/accelerators.

Mandatory Day-6 end gates:

`DELETE_DB_REBUILD_PASS = PASS`

`OVERLAP_REPLAY_IDEMPOTENT = PASS`

`API_FRESHNESS_METADATA_PRESENT = PASS`

`RECONCILE_PASS = PASS`

`FIRST_MEANINGFUL_CONCURRENT_READ_REPLAY_CACHE_FANOUT_TESTS_PASS = PASS`

## Task-11 RED -> GREEN closeout evidence

Validator RED head:

`581c9eb9bf790944b91ff45131e356152ba22691`

Root CI `31339286733` reached the new Day-6 validator after inherited validators passed and failed only because `docs/evidence/day6-sdk-indexer-api-closeout.md` did not yet exist. This was the intended closeout RED.

Pre-final GREEN head:

`6b53714739e7ec59c885bf4215bda5d1e7c0ffc5`

That head passed the full root CI and retained Tasks 5–10 with real runner steps and supplied the exact evidence used to freeze the final Task-11 closeout state.

Intermediate later failures were formatting-only CI hygiene, not behavioral RED. The repository's pinned Prettier output was diagnosed and applied without changing validator semantics.

Final accepted Task-11 head:

`9d84fafbf0be36337e9a362eeeecb01010a0f255`

Exact-head workflows:

- root CI `31340057842` — PASS;
- retained Task 5 `31340057843` — PASS;
- retained Task 6 `31340057870` — PASS;
- retained Task 7 `31340057861` — PASS;
- retained Task 8 `31340057846` — PASS;
- retained Task 9 `31340057838` — PASS;
- retained/dedicated Task 10 `31340057859` — PASS.

All seven workflows executed substantive runner steps. No zero-step run is used as evidence.

Root CI passed:

- repository validation including `validate-day6-read-stack.mjs`;
- explicit Day-6 closeout validation;
- bootstrap tests/smoke;
- `pnpm validate`;
- full test suite;
- full Day-6 suite;
- strict Day-6 shared-contract type assertion;
- exact source-integrity/Prettier gate;
- TypeScript typecheck;
- workspace build;
- tracked-workspace clean-tree verification;
- Foundry compile/tests;
- generated Bread ABI drift check;
- PostgreSQL/Redis health;
- Day-6 PostgreSQL schema/transaction/launch/feed-cursor integration.

## Source/design/security closeout

`DAY6_TASK11_SOURCE_DESIGN_SECURITY_CLOSEOUT = PASS`

The final Task-11 diff is validation/evidence/state/CI only. It introduces no protocol/runtime financial authority, production economics, Arc mainnet values, transaction relay/custody surface, dependency/database rewrite or unreviewed financial-interface sweep.

Existing release/mainnet blockers remain active and unchanged:

- `CURRENT_PONS_FACTORY_SOURCE_PARITY` — reference/parity-claim gap only;
- `PONS_V2_RUNTIME_REFERENCE` — reference numeric observation remains pending; do not guess;
- `BREAD_PRODUCTION_ECONOMICS_CONFIG` — public/mainnet release gate;
- `PONS_AUDIT_FINDINGS` — continuing watch; Bread independent review still required;
- `ARC_MAINNET_VALUES` — official-publication mainnet deployment gate.

The Source-of-Truth deadline rule remains controlling: no later calendar milestone may waive a failed security/accounting/deployment gate.

## Durable-closeout gate

The Task-11 implementation merge does not by itself make Day 6 durably closed.

Required sequence from this actual merged main:

1. bind this handoff and `docs/current-build-state.yaml` to the post-closeout handoff PR;
2. run exact-head root CI plus retained Task-5/6/7/8/9/10 workflows on the final docs-bearing handoff head;
3. require substantive runner-step PASS for all seven workflows;
4. guarded-merge the handoff with expected-head protection;
5. verify actual merged `main`;
6. only then set `DAY6_DURABLE_CLOSEOUT = PASS` and use that verified main as the Day-7 Public Web baseline.

`DAY6_TASK11_IMPLEMENTATION_CLOSEOUT = GUARDED_MERGE_PASS`

`DAY6_DURABLE_CLOSEOUT = PENDING_POST_CLOSEOUT_HANDOFF_EXACT_HEAD_CI_AND_MERGE`

`DAY7 = BLOCKED_BY_POST_CLOSEOUT_HANDOFF`
