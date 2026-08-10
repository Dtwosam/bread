# Day 7 Task 5 — Allowance / Simulation Continuity Repair Handoff

Date: 2026-08-10

## Status

`TRADE_ALLOWANCE_SIMULATION_RECOVERY_REPAIR_INTEGRATED_PASS_DURABLE`

This document became the controlling durable post-Task-5 repair handoff after docs-only handoff PR #70 passed exact-head CI, was guarded-merged to `main`, and actual `main` was freshly reverified at `e1a5f0d7959e601f08b490df7702cccc9ac8111e`.

## Durable start baseline

- Prior durable Day-7 baseline: `7aae446aa0913f84255a3a7b3b00018f27acc3d1`
- Prior durable lane: Day-7 Task 5 — Trade preparation, wallet lifecycle and transaction recovery
- Continuity repair PR: #69
- Exact reviewed repair head: `606223eb70a5333acded9e40f8ba906e42d56b19`
- Guarded repair merge: `acfcbab75338086ff1f3b151af4b05f5934e6a98`
- Durable repair handoff PR: #70
- Durable repair handoff merge/readback: `e1a5f0d7959e601f08b490df7702cccc9ac8111e`

## Why the repair was required

Task-6 preflight exposed a Task-5 first-time-wallet defect. The accepted flow attempted final Buy/Sell simulation before establishing required ERC-20 allowance. A wallet with insufficient allowance could therefore fail simulation before it ever reached the approval path.

The repair remained inside the accepted direct-wallet transaction boundary. It did not change Solidity, Bread financial formulas, protocol economics, API authority, deployment configuration, package dependencies or mainnet values.

## What the repair integrated

- User-facing Review now performs a canonical finance reread and exact transaction/review build without requiring allowance or simulating an as-yet-unapprovable trade.
- Required exact ERC-20 allowance is established and mined while the transaction remains `PREPARING`.
- Only after allowance confirmation does Bread reread transaction-critical economics and simulate the exact Buy/Sell immediately before the trade-signature boundary.
- If the post-approval canonical reread changes the user-approved financial review, Bread blocks trade signature/broadcast until the refreshed values are reviewed.
- Approval hashes are persisted immediately after wallet broadcast and before receipt waiting.
- Approval replacement hashes are persisted and recovery continues from the replacement.
- Receipt transport loss after approval broadcast remains `UNKNOWN`; it is never rewritten as an onchain revert.
- App startup resumes unresolved allowance confirmations alongside unresolved trade confirmations.
- Any unresolved approval serializes the same chain/account/token/spender lane, even if the user changes the UI amount, preventing duplicate approval broadcasts after reload.
- `UNKNOWN` and `REPLACED` trade states remain duplicate-action locked until recovery resolves them.
- The local approval record is operational recovery metadata only. Canonical ERC-20 allowance remains chain-authoritative.

## Meaningful RED evidence

### RED 1 — allowance before final simulation

- Run: `31374346434`
- Existing Task-5 assertions: 40 PASS
- New assertions: 3 FAIL
- Failure proved that approval did not precede the final transaction-critical reread/simulation.

### RED 2 — approval confirmation uncertainty

- Run: `31376115756`
- Prior assertions: 43 PASS
- New assertion: 1 FAIL
- Failure proved that network loss after an approval hash had already been broadcast was incorrectly classified as `REVERTED` rather than recoverable `UNKNOWN`.

### RED 3 — unresolved UNKNOWN duplicate lock

- Run: `31376851158`
- Prior assertions: 42 PASS
- New assertions: 2 FAIL
- Failure proved that recoverable `UNKNOWN` transactions were incorrectly submit-enabled.

### RED 4 — cross-reload changed-amount approval serialization

- Run: `31377038613`
- Prior assertions: 43 PASS
- New assertion: 1 FAIL
- Failure proved that changing the requested trade amount while an earlier approval was still unresolved could broadcast a second `approve` transaction.

## Final exact-head implementation evidence

Exact reviewed repair head: `606223eb70a5333acded9e40f8ba906e42d56b19`

- Root CI `31377182804`: PASS — repository/build-state validation, bootstrap tests, full Day-6 regression suite, shared-type compile, source/format checks, TypeScript typecheck, production build, clean-tree verification, Foundry/ABI tests and PostgreSQL/Redis integration.
- Day-7 Task-5 lifecycle `31377182825`: PASS — 10 test files / 44 assertions.
- Day-7 Task-1 UI foundation `31377182783`: PASS.
- Retained Day-6 Task 5 `31377182779`: PASS.
- Retained Day-6 Task 6 `31377182894`: PASS.
- Retained Day-6 Task 7 `31377182835`: PASS.
- Retained Day-6 Task 8 `31377182888`: PASS.
- Retained Day-6 Task 9 `31377182730`: PASS.
- Retained Day-6 Task 10 `31377182869`: PASS.

Day-7 Task 2, Task 3 and Task 4 workflows are path-filtered and did not run on the final repair head. No fresh exact-head PASS is invented for them.

## Durable-handoff evidence

Exact handoff head: `ce5430b0a4fc4782388b8d901ba20b2e8bcfd9f8`

- Root CI `31377956995`: PASS.
- Day-7 Task 1 `31377956950`: PASS.
- Day-7 Task 2 `31377956951`: PASS.
- Day-7 Task 3 Explore/Search `31377957004`: PASS.
- Day-7 Task 4 Token page `31377956946`: PASS.
- Day-7 Task 5 trade lifecycle `31377956954`: PASS.
- Retained Day-6 Task 5 `31377956872`: PASS.
- Retained Day-6 Task 6 `31377956919`: PASS.
- Retained Day-6 Task 7 `31377956888`: PASS.
- Retained Day-6 Task 8 `31377956889`: PASS.
- Retained Day-6 Task 9 `31377956934`: PASS.
- Retained Day-6 Task 10 `31377956949`: PASS.

## Source / design / security review

`DAY7_TASK5_ALLOWANCE_SIMULATION_RECOVERY_REPAIR_SOURCE_DESIGN_SECURITY_REVIEW = PASS`

Verified:

- direct wallet/provider -> Arc write authority remains unchanged;
- no `/v1` financial mutation path was added;
- no server signing, relay, transaction queue, custody or user-signing-material authority was added;
- no unlimited approval was introduced;
- no independent fee, price, reserve, allowance or transaction financial ledger was introduced;
- chain allowance remains authoritative; local approval records are bounded recovery metadata only;
- final canonical reread/simulation remains immediately before the trade signature boundary;
- stale reviewed financial consequences still block signing;
- transaction and approval transport uncertainty remain recoverable rather than falsely failed;
- unresolved trade/approval operations cannot be bypassed by duplicate submission or a changed UI amount;
- no Solidity, ABI authority, protocol configuration, dependency/lockfile, production economics or Arc mainnet value changed.

## Current project position

Task 5 remains durably complete, now with this continuity repair incorporated. The repair does not create a new Day-7 feature task and does not reopen Day 6.

The next implementation lane remains:

`DAY7_TASK6_CREATE_REVIEW_LAUNCH`

Task 6 may begin only from the freshly verified durable baseline containing PR #70 and this status-closeout correction.

## Task-6 route and authority boundary

- Review is a required screen/state inside canonical `/create`.
- `/create/review` remains forbidden under the controlling route correction.
- Task 6 reuses the repaired Task-5 wallet/network/allowance/double-submit/persistence/recovery behavior rather than creating a second transaction state machine.
- Launch/Launch+Buy consume accepted protocol SDK builders and canonical Factory/config/economics reads.
- No protocol-only launch controls, frontend-owned financial formulas, server transaction authority, guessed production economics or guessed Arc mainnet values may be introduced.

## Blockers unchanged

The repair does not resolve, broaden or reclassify these existing project-level gates:

- `CURRENT_PONS_FACTORY_SOURCE_PARITY`
- `PONS_V2_RUNTIME_REFERENCE`
- `BREAD_PRODUCTION_ECONOMICS_CONFIG`
- `PONS_AUDIT_FINDINGS`
- `ARC_MAINNET_VALUES`
