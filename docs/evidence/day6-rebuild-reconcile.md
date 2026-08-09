# Day 6 Task 10 — Deterministic Rebuild and Reconciliation Evidence

Date: 2026-08-09

## Scope and baseline

- Durable Task-9 baseline: `d6b6b26631f3e70f127595c55074d8cc20edce7a`.
- Implementation PR: #55 (`agent/day6-task10-rebuild-reconcile`).
- Controlling architecture: `TRANSACTIONAL_EVENT_JOURNAL_WITH_SYNCHRONOUS_PROJECTIONS`.
- Chain/contracts remain financial authority. PostgreSQL/indexer/API/cache state remains a deterministic rebuildable projection.

## TDD history

An early conformance run was invalid because its fixture inserted `event_journal.topics` as a PostgreSQL text array while the real schema stores JSONB. That setup error was repaired without production changes and was not counted as behavioral RED.

Meaningful RED after fixture repair:

- head: `75cbc0f04c8cc54319e84dd3d5debd3e2d53b871`
- dedicated workflow: `31334380509`
- result: 12 tests executed, 3 PASS / 9 FAIL
- retained Task-5 through Task-9 regressions remained green.

The meaningful failures covered the missing injected command router, launch identity reconciliation, full curve/graduation state comparison, registered runtime hash coverage, journal/checkpoint continuity, report identity, and mandatory authoritative reconciliation after rebuild.

Additional source-conformance REDs were introduced and observed before repair for:

- authoritative chain/canonical quote identity and decoder schema binding;
- selected journal-row decoder schema continuity;
- curve graduated-state reconciliation;
- canonical operator CLI argument parsing and injected resolution;
- pre-delete isolated rebuild-target verification;
- deterministic rebuild report hashing.

No syntax/configuration failure was accepted as RED.

## Accepted Task-10 behavior

### Deterministic rebuild

- Rebuild is scoped to the selected `(chainId, stackVersion, factory)` read model.
- `protocol_stacks` registration is retained.
- The selected journal/projections/checkpoint are removed and replayed from `deploymentStartBlock` through the same production `applyRange()` path used by normal indexing.
- Another stack on the same chain remains untouched in the deterministic rebuild proof.
- Launch creation initializes canonical zero-trade `launch_state`, so a launch is reconcilable before its first trade.
- Legacy launch rows without persisted launch state receive deterministic reconciliation fallback state rather than silently disappearing from checks.

### Destructive-target safety

`rebuildStack()` refuses destructive work unless an injected verifier first proves the target is either:

- `LOCAL_TEST`, or
- `ISOLATED_REPLACEMENT`.

The target verifier executes before repository deletion. Missing/invalid target verification fails closed. No production DSN or deployment address is guessed by Task 10.

### Mandatory reconciliation

A rebuild cannot report success without an authoritative `ReconciliationChainReader`. Reconciliation failure throws and cannot be converted to a success verdict.

REC-01 through REC-06 are fail-closed:

- **REC-01** — Factory `LaunchCreated` count plus exact transaction/log/token identities.
- **REC-02** — tracked quote/tokens, fee buckets, real/virtual reserve components, reserved/remaining sellable tokens, readiness and graduated state.
- **REC-03** — projected FeeEscrow credits minus claims equals onchain `totalOutstanding`; custody must be at least outstanding; surplus is allowed and reported.
- **REC-04** — graduation phase, swept token/USDC amounts, pool identity, position identity, position-lock status and locked token supply.
- **REC-05** — every registered active-stack deployment has a frozen expected runtime hash and matching runtime code; authoritative chain ID, canonical quote asset and quote decimals match the registered stack.
- **REC-06** — deployment start, checkpoint head/hash/status, active decoder schema, selected journal-row decoder schema, no journal row beyond checkpoint, and independently scanned canonical event identities.

Reconciliation produces a typed operator report carrying report version, chain/stack/factory identity, manifest/source hashes, deployment start, checked block/hash, canonical event count, timings and all REC rows.

### Operator boundary

The indexer exposes:

- injected `runIndexerCommand()` routing for `rebuild` and `reconcile`;
- `parseIndexerCliArgs()` for the canonical `rebuild|reconcile --network <network> --stack <version>` selection;
- `runIndexerCli()` using an injected runtime resolver.

CLI parsing does not accept addresses, keys, DB handles, RPC clients, economics or authority overrides. Those remain the responsibility of validated runtime resolution.

### Rebuild report

Successful rebuild returns a deterministic `day6-rebuild-v1` report containing:

- verdict;
- chain ID;
- stack version;
- factory address;
- source and manifest hashes;
- deployment start block;
- target block/hash;
- canonical event count;
- ranges applied;
- isolated target mode and target identity;
- SHA-256 report hash over the canonical report fields.

## Pre-evidence exact-head verification

Verified head before this evidence commit:

`580e1ac06f9d4b77199e3d6f800fc194d0af55ab`

Exact-head workflows:

- root CI `31338288080`: PASS all four jobs with real steps;
- retained Task-5 `31338288098`: PASS;
- retained Task-6 `31338288072`: PASS;
- retained Task-7 `31338288109`: PASS;
- retained Task-8 `31338288074`: PASS;
- retained Task-9 `31338288101`: PASS;
- dedicated Task-10 `31338288107`: PASS.

Dedicated Task-10 proof:

- PostgreSQL ready;
- Redis PONG;
- five Task-10 files;
- **23/23 tests PASS**;
- includes deterministic rebuild/reconcile, source-conformance, pre-graduation, CLI, isolated-target safety and rebuild-report hash tests.

Root CI also passed frozen install/supply-chain policy validation, repository validation, bootstrap tests, Day-6 tests, strict shared-contract type assertion, formatting, TypeScript typecheck, workspace build, clean-tree verification, Foundry compile/tests, ABI drift check and inherited PostgreSQL integration.

## Verdicts

`DAY6_TASK10_SOURCE_DESIGN_CONFORMANCE = PASS_PENDING_FINAL_DOCS_BEARING_EXACT_HEAD_CI`

`DELETE_DB_REBUILD_PASS = PASS_PENDING_FINAL_DOCS_BEARING_EXACT_HEAD_CI`

`RECONCILE_PASS = PASS_PENDING_FINAL_DOCS_BEARING_EXACT_HEAD_CI`

`DAY6_TASK10_GUARDED_ACCEPTANCE = NOT_CLAIMED_UNTIL_THIS_EVIDENCE_BEARING_HEAD_PASSES_ALL_REQUIRED_WORKFLOWS`

`DAY6_TASK11 = BLOCKED_UNTIL_TASK10_IMPLEMENTATION_AND_DURABLE_HANDOFF_ARE_MERGED`
