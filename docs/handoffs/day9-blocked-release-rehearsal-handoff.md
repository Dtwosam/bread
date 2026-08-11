# Day 9 Blocked Release-Rehearsal Durable Handoff

Status: **DAY_9_RELEASE_CANDIDATE_REHEARSAL_BLOCKED — IMPLEMENTATION/REHEARSAL STATE MERGED, RC NOT CREATED**

This handoff preserves the actual merged Day-9 rehearsal state without converting a blocked release gate into a PASS.

## Durable repository identity

- Previous durable Day-8 main: `fe9b13f1ce271fd5423fdd76de13034dac18fee1`
- Day-9 implementation/rehearsal PR: #88
- Exact reviewed Day-9 head: `b889d6676672d96315c4f5e53cc68f639ea8e944`
- Day-9 implementation/rehearsal merge: `b45e749077cd30430496ce2173e65783ee5675b5`
- Actual `main` was verified identical to that merge immediately after PR #88 merged.
- `bread-day9-rc1`: **NOT CREATED**
- Day 10: **NOT STARTED**

## What Day 9 proved

- Arc Testnet network identity/read surface reconciliation: PASS.
- Clean scripted deploy/configure/verify/smoke from an empty controlled local environment: PASS, explicitly non-canonical/non-production.
- Service rollback to the known-good Day-8 release: PASS.
- Authoritative indexer rebuild/reconcile: PASS.
- Nine executable recovery/admin drills: PASS.
- Browser-engine matrix: Desktop Chromium, Firefox engine, WebKit engine and mobile Chromium emulation PASS.
- Final retained integration matrix: root CI, Day-6 Tasks 5–10, Day-7 Tasks 1–10, Day-8 security/failure/capacity lanes and all Day-9 lanes PASS on exact head `b889d667...`.

## Exact final-head evidence

Root:
- CI `31446449291`

Day 8 retained:
- Lane 1 extended invariants `31446449767`
- Lane 2 static security `31446449297`
- Lane 3 frontend security `31446449276`
- Lane 4 failure/recovery `31446449200`
- Lane 5 cache budget `31446449143`
- Lane 5 indexer catch-up `31446449279`
- Lane 5 hot-launch 10k capacity `31446449111`

Retained Day 6:
- Task 5 `31446449235`
- Task 6 `31446449404`
- Task 7 `31446449247`
- Task 8 `31446449257`
- Task 9 `31446449248`
- Task 10 `31446449170`

Retained Day 7:
- Task 1 `31446449241`
- Task 2 `31446449296`
- Task 3 `31446449300`
- Task 4 `31446449234`
- Task 5 `31446449698`
- Task 6 `31446449295`
- Task 7 `31446449125`
- Task 8 `31446449309`
- Task 9 `31446449183`
- Task 10 primary Playwright `31446449313`
- alternate-browser probe `31446449250`

Day 9:
- Lane 1 environment reconciliation `31446449267`
- Lane 2 rehearsal readiness `31446449087`
- Lane 3 clean local rehearsal `31446449245`
- Lane 4 service rollback `31446449304`
- Lane 5 recovery drills `31446449368`
- Lane 6 browser matrix `31446449266`
- Lane 7 live Arc gate `31446449258`
- Task 8 blocked RC verdict gate `31446449231`

All listed runs concluded PASS on the exact reviewed Day-9 head.

## Why Day 9 remains blocked

The source-defined release gate is not satisfied:

```text
EMPTY_ENVIRONMENT_TO_USABLE_LAUNCHPAD = BLOCKED_CANONICAL_ARC_TESTNET_DEPLOYMENT_NOT_EXECUTED
ROLLBACK = PASS
RECONCILE = PASS
SUPPORTED_MATRIX = BLOCKED_EXTERNAL_EXECUTION_REQUIRED
DAY_9_RELEASE_CANDIDATE_REHEARSAL_BLOCKED
RC_TAG_CREATED = false
DAY10_STARTED = false
```

Current Day-9-specific blockers:

- `ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED`
- `ARC_TESTNET_DEPLOYMENT_MANIFEST_NOT_READY`
- `DAY9_RECOVERY_DRILL_BLOCKED_MULTISIG_ENVIRONMENT`
- `PHYSICAL_DEVICE_EXTERNAL_EXECUTION_REQUIRED`

Existing release/mainnet gates remain unchanged:

- `CURRENT_PONS_FACTORY_SOURCE_PARITY`
- `PONS_V2_RUNTIME_REFERENCE`
- `BREAD_PRODUCTION_ECONOMICS_CONFIG`
- `PONS_AUDIT_FINDINGS`
- `ARC_MAINNET_VALUES`

A controlled local deployment is not a canonical Arc Testnet deployment. Linux Playwright WebKit is not branded/current Safari. Mobile emulation is not a physical device. A single EOA is not substituted for the Safe-compatible threshold recovery requirement.

## Changes made during Day 9

- Reconciled Arc Testnet RPC/WS endpoint host to the current verified official read surface.
- Added explicit canonical-vs-controlled rehearsal readiness gates.
- Added controlled clean-environment deployment/recovery tooling and evidence.
- Fixed the Day-5 smoke script so an intentional replay-revert assertion is outside the broadcast boundary.
- Added service rollback and recovery drill orchestration.
- Added truthful automated browser/device/wallet/accessibility matrix evidence.
- Fixed browser fixture network identity drift by deriving it from canonical Arc Testnet config.
- Removed a deterministic transaction-recovery test race without changing production recovery semantics or timeouts.
- Added a fail-closed live Arc rehearsal classifier; no live deploy/smoke broadcast occurred.

No production financial economics, accounting, custody, wallet signing/relaying authority, canonical DEX activation, production admin/Safe values or Arc mainnet values were invented or changed.

## Safe next action

Do **not** begin Day 10 and do **not** create `bread-day9-rc1` from this state.

A future continuation should first re-verify actual `main` and this handoff, then determine whether the external prerequisites have become satisfiable. RC freeze may be reconsidered only after a fresh candidate proves the real canonical Arc Testnet deployment/DEX prerequisites, Safe-compatible threshold recovery execution, and required supported physical/current-device execution—or after a controlling Project Source amendment explicitly changes those requirements. Re-run the affected Day-9 gates and the final exact-head matrix before tagging any RC.
