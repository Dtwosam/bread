# Day 9 Release Candidate & Rehearsal — Final Verdict

Status: **DAY_9_RELEASE_CANDIDATE_REHEARSAL_BLOCKED**

Bread's executable Day-9 rehearsal work is complete enough to evaluate the source-defined end gate truthfully, but the release-candidate PASS conditions are not all satisfied. This document therefore records a blocked verdict. It is not an RC PASS, testnet deployment claim, production-money claim, or authorization to begin Day 10.

## Controlling pre-final integrated checkpoint

The last accepted pre-final integrated Day-9 checkpoint before this verdict was `5c0e6ce15af30f406a8c367dc906c188451406c8` on PR #88. On that head, root CI, retained Day-6 gates, retained Day-7 primary Playwright, Day-8 security/invariant gates naturally affected by the branch, Day-9 Tasks 1–7, recovery drills, and the four-engine browser matrix were green. Task 8 adds the final blocked verdict and intentionally re-runs the complete source-required exact-head matrix, including retained Day-8 failure-recovery and 10k capacity/catch-up/cache gates.

Final Task-8 exact-head workflow run IDs are recorded in PR #88 metadata after those workflows complete so this evidence file does not create self-referential commit churn.

## Task 1–7 result matrix

| Requirement | Result | Evidence boundary |
| --- | --- | --- |
| Source/environment reconciliation | PASS | Arc Testnet RPC/WS identity reconciled; read-only chain ID and canonical 6-decimal USDC checks passed. |
| Clean-environment scripted rehearsal | PASS_NON_CANONICAL | Empty temporary Anvil environment executed Bread's real deploy → configure → verify → launch/buy → graduate → permanent lock → creator claim path. It is a controlled fixture proof, not a canonical Arc Testnet deployment. |
| Canonical Arc Testnet deployment | EXPLICIT_BLOCKER | `ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED` and `ARC_TESTNET_DEPLOYMENT_MANIFEST_NOT_READY`; no live deploy/smoke broadcast was performed. |
| Service rollback | PASS | Candidate application failure was isolated; routing returned to the known-good Day-8 release; web/API/indexer recovery and authoritative reconcile passed without contract mutation. |
| Indexer rebuild/reconcile | PASS | Retained authoritative rebuild/reconcile evidence passed. |
| Recovery/admin drills | PASS_EXECUTABLE_WITH_MULTISIG_BLOCKER | Nine executable drills passed. Safe-compatible threshold recovery remains `DAY9_RECOVERY_DRILL_BLOCKED_MULTISIG_ENVIRONMENT`. |
| Browser-engine matrix | PASS | Desktop Chromium, Firefox engine, WebKit engine, and mobile Chromium emulation executed with retained journeys, keyboard/focus/reduced-motion coverage, and manifest restoration. |
| Physical/current-device matrix | EXTERNAL_EXECUTION_REQUIRED | Current macOS Safari, iOS Safari, representative physical Android Chrome, and branded Edge were not executed by the available tooling. Engine/emulation results are not relabeled as physical/branded execution. |
| Wallet/in-app browser matrix | NO_FIRST_CLASS_WALLET_BROWSER_CLAIM | Bread V1 claims generic injected EIP-1193 behavior only; no brand-specific wallet/in-app browser compatibility claim is fabricated. |

## Non-waivable Day-9 end gate

```text
EMPTY_ENVIRONMENT_TO_USABLE_LAUNCHPAD = BLOCKED_CANONICAL_ARC_TESTNET_DEPLOYMENT_NOT_EXECUTED
ROLLBACK = PASS
RECONCILE = PASS
SUPPORTED_MATRIX = BLOCKED_EXTERNAL_EXECUTION_REQUIRED

DAY_9_RELEASE_CANDIDATE_REHEARSAL_BLOCKED
RC_TAG_CREATED = false
LIVE_ARC_DEPLOY_BROADCAST = NOT_PERFORMED
LIVE_ARC_SMOKE_BROADCAST = NOT_PERFORMED
DAY10_STARTED = false
```

The controlled local rehearsal cannot substitute for the source-required canonical Testnet deployment when the canonical DEX/deployment manifest is unresolved. Likewise, `EXTERNAL_EXECUTION_REQUIRED` on required supported physical/current-device rows prevents `SUPPORTED_MATRIX = PASS` under the frozen Day-9 plan.

## Why no RC tag exists

The frozen Task-8 plan permits `bread-day9-rc1` only after every required Day-9 gate is PASS on one immutable exact head. That condition is false. The final RC workflow therefore asserts that the tag does not exist while this blocked verdict is active.

## Active blockers at the Day-9 boundary

Day-9-specific blockers:

- `ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED`
- `ARC_TESTNET_DEPLOYMENT_MANIFEST_NOT_READY`
- `DAY9_RECOVERY_DRILL_BLOCKED_MULTISIG_ENVIRONMENT`
- `PHYSICAL_DEVICE_EXTERNAL_EXECUTION_REQUIRED`

Existing release/mainnet truthfulness gates remain unchanged:

- `CURRENT_PONS_FACTORY_SOURCE_PARITY`
- `PONS_V2_RUNTIME_REFERENCE`
- `BREAD_PRODUCTION_ECONOMICS_CONFIG`
- `PONS_AUDIT_FINDINGS`
- `ARC_MAINNET_VALUES`

No blocker is satisfied by inventing an address, economics value, admin/Safe identity, DEX deployment, browser compatibility claim, or mainnet value.

## Safe continuation

The final exact-head Task-8 matrix must pass while asserting this blocked verdict. If it does, the Day-9 implementation/rehearsal repairs and blocker evidence may be made durable without creating an RC PASS tag. Day 10 remains stopped. A later continuation must first satisfy the real external prerequisites (or obtain an explicit controlling source amendment), rerun the affected Day-9 gates on a fresh exact head, and only then reconsider RC freeze/tagging.
