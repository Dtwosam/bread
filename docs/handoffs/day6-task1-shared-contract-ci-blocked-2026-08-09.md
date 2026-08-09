# Day 6 Task 1 — Shared Protocol Contract CI-Blocked Handoff

Date: 2026-08-09

## Durable integrated baseline

- Current accepted `main` before Task 1: `81db147ef7be8191981fb10afd425fa4f2f0e280`.
- Day-6 written design/spec PR #35 merged at `f734d6cee2deb447928f94e6928cba2ca51b9b12` after user approval and exact-head CI `31287828150` PASS.
- Day-6 detailed RED -> GREEN plan PR #36 merged at `81db147ef7be8191981fb10afd425fa4f2f0e280` after self-review and exact-head CI `31287991273` PASS.
- Frozen architecture remains `TRANSACTIONAL_EVENT_JOURNAL_WITH_SYNCHRONOUS_PROJECTIONS`.

## Active lane

Day 6 Task 1 — canonical shared protocol contract.

Branch:

`agent/day6-task1-shared-protocol-contract`

Draft PR:

`#37`

Task-1 baseline:

`81db147ef7be8191981fb10afd425fa4f2f0e280`

## TDD state

### RED proven

Initial RED:

- head `aaf1ab20c5502d8f56d2738f1df906c73bbc9a92`;
- CI `31288048867`;
- focused Vitest: 3/3 expected missing-export failures;
- existing repository validation/bootstrap tests green before the focused failure.

Expanded RED:

- head `df8f1a6b315d06622855cbf6b2a1b2da7125ae56`;
- CI `31288144341`;
- focused Vitest: 4/4 expected missing-behavior failures;
- `pnpm validate` PASS and existing `pnpm test` 9/9 PASS before the focused failure.

Durable evidence:

`docs/evidence/day6-task1-shared-contract-red.md`

`DAY6_TASK1_SHARED_CONTRACT_RED = PROVEN`

### GREEN candidate written, not accepted

The current Task-1 branch contains the minimal shared-contract implementation required by the approved design:

- canonical `chainId + transactionHash + logIndex` identity/types;
- approved `{ data, meta, page? }` API envelope types;
- reconciliation report types;
- strict `@bread/config` network/deployment manifest schemas;
- `resolveProtocolContext()` that consumes validated manifests and rejects unresolved/null deployment values rather than guessing addresses;
- canonical/known-ignored/unknown Bread event policy;
- generated ABI registry target + deterministic Foundry artifact generator/checker;
- focused Day-6 CI hook and root ABI/test scripts;
- no DB/indexer/API financial authority and no server-side transaction submission.

The checked-in ABI registry at this checkpoint is only the generation target placeholder. It is **not** accepted as exact. The Foundry drift checker must produce/verify the exact generated registry before Task 1 can PASS.

A local auxiliary TypeScript structure/syntax check was run with stubbed `viem`/`zod` declarations and passed. This is non-authoritative and does not replace the pinned repository toolchain.

## Exact external blocker

After the GREEN candidate was written, GitHub Actions stopped executing repository steps for PR #37.

Two consecutive workflow attempts:

- `31288355378`;
- `31288420878`.

Both created all four repository jobs as immediate failures with **zero steps**. Job-step queries returned empty arrays and job logs were unavailable/BlobNotFound. Therefore no repository command, test, typecheck, Foundry build, ABI checker, infrastructure check, or validation command executed in those attempts.

Disposition:

`GITHUB_ACTIONS_ZERO_STEP_FAILURES = EXTERNAL_EXECUTION_BLOCKER`

Do not classify those runs as code failure and do not classify the current candidate as PASS.

GitHub's public status page reported Actions operational at the time, so the exact cause appears repository/account/runner-local or transient rather than a declared global incident. No architecture or source decision is implied by the blocker.

## Required next action

1. Reverify `main`. It must still equal `81db147ef7be8191981fb10afd425fa4f2f0e280` or every intervening commit must be reconciled before continuing.
2. Inspect PR #37 and its latest head; do not discard the proven RED or current candidate.
3. Trigger a fresh exact-head PR #37 CI only when GitHub Actions actually begins recording job steps.
4. In the Foundry job, `forge build` must run before `node ../scripts/abi/check-bread-abi.mjs`.
5. If the ABI checker reports drift, replace `packages/protocol-sdk/src/abi/generated.ts` with the exact generator output and rerun the exact-head suite.
6. Require all of the following on the exact candidate head:
   - focused `tests/day6/shared-contract.test.ts` PASS;
   - `pnpm validate` PASS;
   - prior bootstrap tests PASS;
   - `pnpm typecheck` PASS;
   - `pnpm build` PASS and clean tracked tree;
   - Foundry build/tests PASS;
   - generated Bread ABI drift check PASS;
   - infrastructure-health PASS.
7. Only then mark PR #37 ready, perform source/design conformance review, guarded-merge with expected-head protection, verify merged `main`, and write a fresh durable Task-1 handoff.
8. **Do not begin Task 2 before Task 1 is exact-head green and guarded-merged.**

## Authority and release blockers unchanged

The following remain non-Day-6-local implementation/release gates and must not be guessed:

- `CURRENT_PONS_FACTORY_SOURCE_PARITY`;
- `PONS_V2_RUNTIME_REFERENCE`;
- `BREAD_PRODUCTION_ECONOMICS_CONFIG`;
- `PONS_AUDIT_FINDINGS`;
- `ARC_MAINNET_VALUES`;
- canonical Arc DEX activation values.

Chain/contracts remain financial authority. PostgreSQL/indexer/Redis/API remain deterministic rebuildable read projections only.

## No PASS claim

`DAY6_TASK1_PASS = NOT_CLAIMED`

`DAY6_TASK2 = BLOCKED_BY_TASK1_ACCEPTANCE_GATE`
