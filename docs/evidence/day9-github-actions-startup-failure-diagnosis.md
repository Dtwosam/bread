# Day 9 — GitHub Actions startup-failure diagnosis

Status: **EXTERNAL ACTIONS STARTUP BLOCK — ROOT ACCOUNT/BILLING/POLICY CAUSE NOT CONFIRMED**

This document records the exact evidence for the Day-9 external-CI blocker. It does **not** convert GitHub Actions to PASS and it does not waive the external-CI gate.

## Exact observed symptom

At branch head `19790babf7765e38d2d80164a66e31ea75139c2e`, GitHub Actions creates synthetic workflow runs with:

- `path: BuildFailed`
- empty workflow name
- `conclusion: startup_failure`
- `jobs: []`
- no job logs because no job is created

The same exact-head commit produced both:

- a `push`-event synthetic `BuildFailed` startup failure; and
- a `pull_request`-event synthetic `BuildFailed` startup failure.

The synthetic workflow resource is workflow id `331759944`. GitHub reports that workflow as:

- `path: BuildFailed`
- `state: deleted`

This is not the repository's actual `ci.yml` workflow.

## Real workflow registration

GitHub's workflow inventory still reports `.github/workflows/ci.yml` as:

- name: `ci`
- workflow id: `329799923`
- state: `active`

The repository currently has 45 registered workflows.

However, querying the real `ci.yml` workflow for PR runs on branch `day9/synthra-arc-testnet-v3-candidate` returns **zero runs**.

The same is true for the path-filtered `day9-final-rc-gate.yml` workflow even though PR #93 changes files covered by that workflow's `pull_request.paths` filter.

Therefore the observed external-CI failure is occurring before the repository's real workflow jobs execute.

## Workflow-change audit

Relative to durable `main` (`c21b49a1f8edaaad999e461edb0ce602071bda5c`), PR #93 changes four workflow files:

- `.github/workflows/ci.yml`
- `.github/workflows/day9-final-rc-gate.yml`
- `.github/workflows/day9-lane3-clean-local-rehearsal.yml`
- `.github/workflows/day9-lane7-live-arc-rehearsal-gate.yml`

The changed sections were inspected directly. They contain ordinary GitHub Actions syntax:

- `ci.yml` only excludes `test/fork/**` from the ordinary Foundry regression;
- Lane 3 makes the same deterministic fork exclusion;
- Lane 7 updates retained Arc-Testnet read-only evidence checks;
- the final RC gate updates retained deployment/lifecycle/recovery evidence assertions while preserving the blocked Day-9 verdict.

No changed section contains an identified malformed YAML/expression construct that explains a repository-wide zero-job startup failure.

This inspection is not a substitute for GitHub's own workflow parser, but it means there is currently no evidence that Bread test/code execution is what failed.

## GitHub API constraints

Attempts to read repository Actions permissions through the connected GitHub integration return HTTP 403 (`Resource not accessible by integration`).

Attempts to read the owning account's Actions billing usage through the connected GitHub integration also return HTTP 403.

A rerun request for the synthetic startup-failure workflow is likewise blocked by the connected-tool safety boundary.

Therefore this session cannot directly prove whether the upstream cause is billing lock, Actions budget exhaustion, account policy, or another GitHub account-level startup restriction.

## External platform interpretation

GitHub documents `startup_failure` as a check-suite failure during startup, before check-run/job execution. GitHub's Actions troubleshooting documentation also explicitly directs users to review billing errors and states that setting an Actions budget may unblock workflows failing due to billing or storage errors.

The exact `BuildFailed` + empty workflow name + zero jobs symptom has also been publicly reported in a GitHub Support case as an account billing-lock condition. That external report is corroborative only; it is not treated here as proof of this account's state.

## Engineering consequence

Do **not** classify these runs as:

- a Bread test failure;
- a TypeScript/build failure;
- a Solidity failure;
- a V3 route/execution failure; or
- external CI PASS.

The correct classification is:

`GITHUB_ACTIONS_EXTERNAL_STARTUP_FAILURE_ZERO_JOBS_ACCOUNT_LEVEL_CAUSE_UNCONFIRMED`

The existing local/supplemental verification evidence remains independent of this external platform failure.

## Release boundary

This diagnosis does not authorize:

- merging PR #93;
- creating an RC tag;
- marking Day 9 complete;
- starting Day 10;
- waiving physical-device evidence;
- waiving exact-head repository verification; or
- performing any new live Arc Testnet financial write.

## Next external action

The remaining platform-side check is to inspect the repository/account GitHub **Billing / Budgets** and **Settings → Actions → General** state using an account session with the required administration/billing permissions. If a billing or Actions budget lock is present, it must be resolved before a real workflow run can serve as external-CI evidence.
