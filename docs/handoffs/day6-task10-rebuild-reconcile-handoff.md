# Day 6 Task 10 — Deterministic Rebuild and Reconciliation Durable Handoff

Date: 2026-08-09

## Integrated baseline

Task-10 implementation PR: #55

Task-10 accepted implementation/evidence head: `04647d9c359959422803b95358c0ef693cfb0708`

Task-10 implementation merge: `08e38978ebf48d533556b7f57e0a1c1cab10bf17`

Task-9 durable predecessor: `d6b6b26631f3e70f127595c55074d8cc20edce7a`

Task-10 evidence: `docs/evidence/day6-rebuild-reconcile.md`

Durable handoff branch: `docs/day6-task10-handoff`

Durable handoff PR: pending creation

## Accepted Task-10 behavior

- selected-stack read-model deletion/rebuild starts from the exact registered `deploymentStartBlock`;
- rebuild uses the same production `applyRange()` transaction/projection path used by normal indexing;
- deterministic journal/projection digest recovery is proven after deletion;
- the independent comparison stack on the same chain remains untouched;
- destructive rebuild work cannot begin until an injected verifier proves `LOCAL_TEST` or `ISOLATED_REPLACEMENT` target isolation;
- production DSN/address/economics authority is never guessed by rebuild code;
- `runIndexerCommand()` provides the injected rebuild/reconcile operator router;
- `parseIndexerCliArgs()` and `runIndexerCli()` expose only canonical command/network/stack selection and keep runtime authority injected;
- rebuild success always requires an authoritative `ReconciliationChainReader` and PASS reconciliation;
- `skipReconciliation` cannot produce successful rebuild completion;
- a FAIL reconciliation verdict throws with failed REC IDs rather than returning a successful rebuild;
- reconciliation/report identity includes chain/stack/factory, deployment start, checked block/hash, manifest/source hashes, canonical-event count and timings;
- rebuild report `day6-rebuild-v1` carries target identity/mode, range count, target block/hash, canonical-event count, verdict and deterministic SHA-256 report hash;
- chain/contracts remain financial authority; PostgreSQL/indexer/journal/API/cache remain deterministic rebuildable read surfaces.

## Authoritative reconciliation contract

REC-01 through REC-06 are fail-closed:

- **REC-01** — Factory `LaunchCreated` count and exact canonical transaction/log/token identity set must match indexed launches.
- **REC-02** — tracked quote/tokens, quote-fee/creator-tax buckets, real/virtual reserve components, reserved/remaining sellable tokens, readiness and graduated state must match authoritative curve state.
- **REC-03** — projected FeeEscrow credits minus claims must equal authoritative `totalOutstanding`; custody must cover outstanding; surplus is reported but does not invalidate solvency.
- **REC-04** — graduation phase, swept TOKEN/USDC amounts, pool identity, position identity, position lock and token-supply lock must match authoritative coordinator/locker state.
- **REC-05** — every registered active-stack deployment requires a frozen expected runtime code hash and matching runtime code; authoritative chain ID/canonical quote asset/quote decimals must match the registered stack.
- **REC-06** — deployment start/checkpoint block/hash/status, active checkpoint decoder schema, selected journal-row decoder schema, no journal row beyond checkpoint, and independently scanned canonical event identities must match.

Additional accepted edge behavior:

- a never-traded launch remains reconcilable from immutable launch snapshot state;
- persisted pre-graduation `graduation_phase = NULL` is normalized read-only to canonical `NOT_GRADUATED` at the reconciliation boundary;
- accepted contract readiness was independently rechecked: for a non-graduated curve `readyToGraduate()` is equivalent to zero remaining sellable inventory, matching the launch projection initialization;
- no second lifecycle, accounting or financial authority was introduced.

## TDD history

Initial Task-10 RED: `a9b3c9d3c129beb77aa4973c8381e7439f7991ef`.

Intermediate fixture-invalid head: `c5f68be8ba2107edd17b603787795de8ef2b7310`.

The fixture error inserted `event_journal.topics` as PostgreSQL `text[]` although the actual schema is JSONB. It was repaired without treating setup failure as behavioral RED.

Meaningful post-fixture RED head: `75cbc0f04c8cc54319e84dd3d5debd3e2d53b871`.

Meaningful dedicated run: `31334380509` — 12 tests, 3 PASS / 9 FAIL.

Subsequent source-conformance review intentionally added focused REDs for missing authoritative identity/state coverage, decoder continuity, graduated-state parity, fail-closed rebuild completion, pre-graduation normalization, operator CLI binding, destructive target isolation and rebuild report identity. Each was repaired in the owning subsystem rather than weakening expectations.

## Final implementation/evidence exact-head gate

Exact accepted head:

`04647d9c359959422803b95358c0ef693cfb0708`

All required workflows correspond to that same exact head and executed real runner steps:

- root CI `31338461162`: PASS;
- retained Task-5 `31338461161`: PASS;
- retained Task-6 `31338461160`: PASS;
- retained Task-7 `31338461169`: PASS;
- retained Task-8 `31338461165`: PASS;
- retained Task-9 `31338461174`: PASS;
- dedicated Task-10 `31338461147`: PASS.

Root CI executed repository/bootstrap validation, full tests + Day-6 tests, strict shared-contract type assertion, TypeScript typecheck/build, clean-tree verification, Foundry compile/tests, ABI drift check and PostgreSQL integration.

Dedicated Task-10 executed real PostgreSQL and Redis infrastructure plus deterministic rebuild/reconciliation, source-conformance, pre-graduation, injected operator CLI, target-isolation and rebuild-report proof.

## Source/design/security conformance

`DAY6_TASK10_SOURCE_DESIGN_CONFORMANCE = PASS`

`DELETE_DB_REBUILD_PASS = PASS`

`RECONCILE_PASS = PASS`

No source-of-truth conflict, unresolved critical/high Task-10 issue, hidden financial authority, new production economics, invented Arc mainnet value, critical-path placeholder/TODO, or unrelated framework/database rewrite remains in the accepted implementation.

## Guarded merge

PR #55 was marked ready only after exact-head seven-workflow PASS and final conformance review.

Expected-head-protected merge succeeded for:

`04647d9c359959422803b95358c0ef693cfb0708`

Actual merge commit:

`08e38978ebf48d533556b7f57e0a1c1cab10bf17`

`main` was freshly verified identical to that merge commit after merge.

## Durable continuation gate

Task 10 is implementation-integrated but MUST NOT be considered durably closed from the implementation merge alone.

Required continuation order:

1. update `docs/current-build-state.yaml` from the actual merged Task-10 main baseline;
2. freeze this Task-10 handoff branch/PR with the exact implementation merge and CI evidence;
3. run root CI plus retained Task-5/6/7/8/9 and dedicated Task-10 on the exact handoff head, requiring real runner steps and PASS;
4. guarded-merge the handoff PR with expected-head protection;
5. verify actual `main` equals the handoff merge;
6. only then determine the next approved Day-6 action / Task 11 from the controlling Day-6 implementation plan.

`DAY6_TASK10_IMPLEMENTATION = GUARDED_MERGE_PASS`

`DAY6_TASK10_DURABLE_HANDOFF = PENDING_EXACT_HEAD_CI_AND_MERGE`

`DAY6_TASK11 = BLOCKED_BY_TASK10_DURABLE_HANDOFF`
