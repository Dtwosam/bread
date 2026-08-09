# Day 6 Task 6 — fees, admin, graduation and creator projections

Date: 2026-08-09
Repository: `Dtwosam/bread`
Branch: `agent/day6-task6-fees-admin-graduation`
Baseline: `966a5dccdd0c002db51ed1739e4a0bc4ffa28ca4`
PR: #47

## Scope

Task 6 implements only the approved Day-6 fee/admin/graduation/creator read-model lane:

- FeeEscrow `FeeCredited` as the only canonical entitlement-creation source;
- FeeEscrow `FeeClaimed` as the only canonical entitlement-reduction source;
- upstream curve/factory/coordinator fee and dust events as attribution/audit context only;
- deterministic token attribution only when exact; unavailable or ambiguous attribution is not guessed;
- graduation readiness/sweep/completion/rescue and permanent-lock evidence into rebuildable launch state;
- append-only privileged/config/recovery evidence in `admin_events`;
- exact graduation progress in basis points from projected sellable inventory;
- creator launch relationships, exact credited revenue, aggregate claims, indexed claimable, and deterministic canonical trade counts;
- DB-only `GET /v1/creators/:address` with freshness metadata.

No Task-7 holder/portfolio projection, reconciliation implementation, server-side signing/submission/relaying, key custody, production economics, Arc mainnet values, DEX values, buyback state or vesting state is introduced.

## Initial RED — proven

Exact head: `ef857f5bea40061c8a12670189281602c15d1667`

Inherited CI: `31320645853`

- bootstrap validation: PASS;
- Foundry/ABI: PASS;
- inherited PostgreSQL/Redis regression: PASS;
- dependency-build failed only on the missing Task-6 reducer surface.

Dedicated Task-6 workflow: `31320645878`

- PostgreSQL ready: PASS;
- Redis `PONG`: PASS;
- Task-6 suite: **4/4 expected FAIL** because `createFeeAdminGraduationReducer` and downstream behavior did not exist.

Verdict: `DAY6_TASK6_RED = PROVEN`.

## First implementation GREEN

Exact head: `8e611464df6c42c6615d0e41905a8a15d4628272`

Inherited CI: `31321060364` — all four jobs PASS.

Dedicated Task-6 workflow: `31321060353` — original Task-6 PostgreSQL suite **4/4 PASS**.

This proved FeeEscrow-only entitlement rows, graduation/lock state, admin ordering, and creator aggregate API behavior. Source review then identified missing typed-schema parity and non-terminal graduation-progress projection.

## Source-conformance RED — proven

Exact head: `25157240b5d2fa39967774681ed3374c410e212c`

Inherited CI: `31321168773`.

Dedicated Task-6 workflow: `31321168776`.

- original Task-6 suite: 4/4 PASS;
- typed Task-6 schema assertion: expected FAIL;
- graduation-progress assertion: expected FAIL;
- Factory/coordinator contextual attribution values were already semantically correct; that assertion initially failed only because the test assumed an invalid PostgreSQL row order and was corrected without changing product semantics.

Valid product REDs: typed schema parity and graduation progress.

## Source-conformance GREEN

Exact head: `c60bc9fd3d5363389cb65eb42659038b90b6c4c7`

Inherited CI: `31321561339` — PASS.
Retained Task-5 regression: `31321561378` — PASS.
Dedicated Task-6 workflow: `31321561340` — **7/7 PASS**.

This proved:

- Task-6 migration/Drizzle typed-schema parity;
- exact curve, Factory same-transaction and coordinator same-transaction fee attribution;
- non-terminal graduation progress as exact integer bps;
- the original four Task-6 authority/API behaviors remained green.

## Creator trade-count RED — proven

Exact head: `66ce7eeecef779d883a0faabb9e12596bf8bd606`

Dedicated Task-6 workflow: `31321725015`.

- prior Task-6 tests: 7 PASS;
- creator canonical trade-count assertion: 1 expected FAIL because no rollup row was produced.

Verdict: deterministic creator activity projection was missing without affecting revenue accounting.

## Creator trade-count GREEN and retained-regression repair

Initial creator trade-count GREEN head: `14f9682389b9958279acd4a91f3084c5ce3ac023`.

- inherited CI `31321862939`: PASS all four;
- dedicated Task-6 `31321862979`: **8/8 PASS**;
- retained Task-5 `31321862940`: FAIL because an older generic Task-5 launch fixture had no `creator_fee_recipient` and the new creator activity projection treated unavailable attribution as fatal.

This was a real cross-task compatibility defect. The source rule is fail-unavailable, not guess and not block unrelated canonical trade projection when optional attribution is absent.

Final implementation head after repair:
`d21b58d3d3ef63a448921d752c808f9c0c086e32`

Exact workflows:

- inherited CI `31322120558`: PASS all four jobs with real steps;
- retained Task-5 PostgreSQL/conformance `31322120555`: PASS;
- dedicated Task-6 PostgreSQL/conformance `31322120557`: **8/8 PASS**.

The compatibility repair skips creator trade-count attribution only when `creator_fee_recipient` is absent; a present malformed address remains an integrity failure. Exact launch creator attribution still increments trade count and never invents fee revenue.

## Proven behavior

- Only resolved FeeEscrow canonical events create/reduce indexed entitlement rows.
- Curve `FeesSwept`, Factory `LaunchFeeCredited`, coordinator dust and related upstream events cannot mint duplicate entitlements.
- Curve FeeEscrow credits map exactly through `launches.curve_address`.
- Factory and coordinator credits use exact same-transaction prior journal context; ambiguous/missing context is not guessed.
- FeeEscrow authoritative event values retain recipient balance and total outstanding.
- Creator per-token accrued fees are updated only for exact token attribution and the exact launch creator fee recipient.
- Claims remain creator-level aggregates because FeeEscrow claims do not carry token identity.
- Creator `indexedClaimable = indexed credits - indexed claims` is explicitly non-authoritative versus on-chain FeeEscrow state.
- Canonical CurveBuy/CurveSell activity increments the exact launch fee recipient's per-token trade count but does not create revenue.
- GraduationReady, AutoAttemptFailed, CurveGraduationReleased, GraduationSwept, GraduationCompleted, GraduationRescued, PositionLocked and TokenSupplyLocked update deterministic rebuildable launch/metric state.
- Graduation progress is exact integer bps derived from projected initial sellable versus remaining sellable inventory; no floating point.
- Admin/config/recovery event history is append-only and chain ordered.
- `/v1/creators/:address` validates addresses before DB access, uses DB-only reads, returns `{data, meta}`, distinguishes deployer launches from fee-recipient launches, and marks unavailable buyback/vesting state instead of fabricating it.
- Status checkpoint/decoder/degraded fields remain present; reconciliation remains explicitly unavailable until the later reconciliation lane.
- All Task-6 effects wired through `applyRange()` inherit the existing journal + projections + checkpoint PostgreSQL transaction boundary.

## Scope review

Final implementation diff contains no Task-7 holder/portfolio work and no centralized financial write authority. No production economics, Arc mainnet, DEX, Pons parity or audit status is guessed.

## Current gate

Implementation is source-conformant and GREEN at `d21b58d3d3ef63a448921d752c808f9c0c086e32`, but guarded acceptance is not yet claimed because this evidence file and the canonical build-state update intentionally move the PR head.

Required next step:

1. update `docs/current-build-state.yaml` while preserving the full history;
2. freeze the documentation-bearing PR head;
3. require fresh exact-head inherited CI, retained Task-5 regression, and dedicated Task-6 8/8 to PASS;
4. verify `main` remains the Task-5 durable baseline `966a5dccdd0c002db51ed1739e4a0bc4ffa28ca4`;
5. guarded-merge PR #47 with expected-head protection;
6. verify merged `main`;
7. create/integrate a docs-only Task-6 durable handoff before Task 7 begins.

`DAY6_TASK6_IMPLEMENTATION_GREEN = PROVEN`

`DAY6_TASK6_GUARDED_ACCEPTANCE = NOT_CLAIMED_PENDING_DOCS_BEARING_EXACT_HEAD_CI_AND_MERGE`
