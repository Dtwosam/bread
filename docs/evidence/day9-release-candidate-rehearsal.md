# Day 9 Release Candidate & Rehearsal — Current Final Verdict

Status: **DAY_9_RELEASE_CANDIDATE_REHEARSAL_BLOCKED_PHYSICAL_MATRIX_AND_EXTERNAL_CI**

Bread's source-defined Day-9 money-path, deployment, rollback/reconcile, and recovery rehearsal gates have advanced materially since the original blocked verdict. The candidate is still **not** a Day-9 PASS because the required supported physical/branded-device matrix is incomplete and GitHub Actions is currently returning `startup_failure` before creating jobs. No RC tag is authorized and Day 10 remains stopped.

## Current integrated Arc-Testnet evidence

Canonical bounded Day-9 Arc Testnet evidence now includes:

- verified current Arc Testnet network identity and canonical 6-decimal USDC;
- verified generic `UNISWAP_V3` dependency manifest with Synthra as Arc-Testnet provider provenance only;
- real-dependency fork integration PASS at Arc block `56439192`;
- genuine chain-specific Safe v1.4.1 Protocol Admin `0x9004e285521d69197cd9965c301b02161eb1d0d8`, threshold 2-of-3;
- canonical Bread Arc Testnet deployment/ownership/config verification PASS from source commit `db0f6ed28e4a2475f54e84efadd7cf9693701353`, deployment start block `56448201`;
- public launch/buy/graduation/permanent-lock/creator-claim/replay lifecycle smoke PASS with token `0x9dc6c650929b641f93269a3b6d7d5237297d938b`, curve `0x68db37eea822d42af898b9777a96bef022a0e36d`, and Position Manager NFT `265870` permanently owned by Bread locker `0xecf66a3a221d90a413d9015803417aa8d4ba97fe`;
- real reversible Safe threshold signer recovery PASS, with nonce `0 -> 2`, exact original owner set restored, and the temporary recovery signer participating in the restore transaction.

All live-money language remains bounded to **Arc Testnet / non-production faucet assets**. No production economics, Arc-mainnet DEX, unrestricted-public-money, or production-authority claim is made.

## Current Day-9 requirement matrix

| Requirement | Result | Evidence boundary |
| --- | --- | --- |
| Source/environment reconciliation | PASS | Arc Testnet identity and canonical USDC reconciled. |
| Clean-environment scripted rehearsal | PASS | Controlled local rehearsal plus canonical public Arc Testnet deployment/lifecycle now prove the scripted path. |
| Canonical Arc Testnet deployment | PASS_VERIFIED | Canonical manifest is `VERIFIED`; exact deployed addresses/hashes/start block retained. |
| Public Arc Testnet lifecycle | PASS | Exact launch token/curve/LP position, creator claim, zero graduation residue and replay rejection retained in `docs/evidence/day9-public-arc-lifecycle-smoke.md`. |
| Service rollback | PASS | Existing Day-9 rollback rehearsal remains retained. |
| Indexer rebuild/reconcile | PASS | Existing authoritative rebuild/reconcile evidence remains retained. |
| Recovery/admin drills | PASS | Real Safe-compatible threshold owner replacement and restoration is retained in `docs/evidence/day9-safe-threshold-recovery.json`; recovery bundle now requires this executed evidence. |
| Browser-engine matrix | PASS | Desktop Chromium, Firefox engine, WebKit engine and mobile Chromium emulation executed with retained journey/accessibility coverage: 76 tests, 40 passed, 36 pre-existing task-ownership skips, 0 failed on the exact head. Two WebKit keyboard/focus failures were repaired at their owning layer without weakening or skipping any accessibility assertion. |
| macOS Safari physical | PARTIAL_PASS_EXTERNAL_USER_EXECUTION | Actual Safari navigation/responsive/Rabby connect/network-add/switch evidence exists. Buy/Sell/Create/Claim were not executed in that physical Safari run. |
| iOS Safari physical | EXTERNAL_EXECUTION_REQUIRED | Required physical/current coverage not yet available. |
| Android Chrome physical | EXTERNAL_EXECUTION_REQUIRED | Required representative physical Android Chrome coverage not yet available. |
| Desktop Edge branded | EXTERNAL_EXECUTION_REQUIRED | Current Edge branded execution not yet available; Chromium engine coverage is not relabeled. |
| Wallet/in-app browsers | NO_FIRST_CLASS_WALLET_BROWSER_CLAIM | Generic injected EIP-1193 only; no wallet brand is promoted to first-class without full Create/Buy/Sell/Claim/network-switch execution. |
| Exact-head local release matrix | PASS | Complete local matrix executed against head `57d1dc9f63ed4ba61e7dc1d16eb41d1c29fb3b71` with `DAY9_EXACT_HEAD_LOCAL_RELEASE_MATRIX_PASS`; retained deployment/smoke/Safe/fork evidence was not re-executed. See `docs/evidence/day9-exact-head-local-release-matrix.md`. |
| Exact-head GitHub Actions | EXTERNAL_STARTUP_FAILURE | Root `ci.yml` is byte-for-byte identical to main, but current PR runs conclude `startup_failure` with `jobs: []`; this is not a CI PASS. |

The controlling 04D Browser / Device Release Matrix requires current Chrome and Edge, current Safari on macOS, current Firefox, current plus previous-major iOS Safari where practical, current Chrome on a representative mid-range Android device, and only the wallet/in-app browser paths explicitly claimed. Engine/emulation evidence is not a substitute for required physical/branded execution.

## Non-waivable Day-9 end gate — current truth

```text
EMPTY_ENVIRONMENT_TO_USABLE_LAUNCHPAD = PASS_ARC_TESTNET_DEPLOYMENT_AND_PUBLIC_LIFECYCLE
ROLLBACK = PASS
RECONCILE = PASS
RECOVERY_DRILLS = PASS_REAL_SAFE_THRESHOLD_RECOVERY
SUPPORTED_MATRIX = BLOCKED_EXTERNAL_EXECUTION_REQUIRED
EXACT_HEAD_LOCAL_RELEASE_MATRIX = PASS_AT_57d1dc9f63ed4ba61e7dc1d16eb41d1c29fb3b71
EXACT_HEAD_GITHUB_ACTIONS = EXTERNAL_STARTUP_FAILURE_BEFORE_JOB_CREATION

DAY_9_RELEASE_CANDIDATE_REHEARSAL_BLOCKED_PHYSICAL_MATRIX_AND_EXTERNAL_CI
RC_TAG_CREATED = false
LIVE_ARC_DEPLOY_BROADCAST = PERFORMED_AND_VERIFIED_TESTNET_ONLY
LIVE_ARC_SMOKE_BROADCAST = PERFORMED_AND_VERIFIED_TESTNET_ONLY
DAY10_STARTED = false
```

## Remaining Day-9 blockers

Day-9-specific blockers now are:

- `PHYSICAL_DEVICE_EXTERNAL_EXECUTION_REQUIRED`
- `DAY9_EXACT_HEAD_RELEASE_CI_REQUIRED`

The prior Arc DEX/deployment, public lifecycle smoke, Safe environment and threshold-recovery blockers are cleared for the bounded Day-9 Testnet rehearsal.

Existing public/mainnet truthfulness gates remain unchanged and are not silently converted into Day-9 Testnet blockers:

- `CURRENT_PONS_FACTORY_SOURCE_PARITY`
- `PONS_V2_RUNTIME_REFERENCE`
- `BREAD_PRODUCTION_ECONOMICS_CONFIG`
- `PONS_AUDIT_FINDINGS`
- `ARC_MAINNET_VALUES`

## GitHub Actions classification

The root `.github/workflows/ci.yml` blob on the active candidate is identical to `main`. Current PR workflow runs nevertheless terminate with GitHub `startup_failure` before any job is created (`jobs: []`). No test failure, compile failure or job-level log exists to repair from those runs. Until GitHub can start jobs again, the repository must not label that surface green.

Fresh exact-head local verification may provide independent code/test evidence, but it does not erase the external Actions availability fact. Both are recorded separately.

That local verification has now been performed and passed on head `57d1dc9f63ed4ba61e7dc1d16eb41d1c29fb3b71`. External Actions availability is unchanged: both runs at that exact head (`31512708748` for `pull_request`, `31512701643` for `push`) concluded `startup_failure` with zero jobs and zero check runs. Local inspection at this head found no repairable defect — all 34 workflow files parse as valid YAML with one `name:`, one `on:` trigger and a `jobs:` mapping, no tab indentation exists, and repository Actions are enabled with `allowed_actions: "all"`. The failing runs are attributed to a synthetic `BuildFailed` workflow record rather than any tracked workflow file. Account-level Actions billing/entitlement could not be inspected with the available token scopes. This surface therefore remains classified as unavailable, never as executed CI.

## Safe continuation

Do not create `bread-day9-rc1` and do not begin Day 10 while the supported physical/branded-device matrix remains incomplete or the final source-required exact-head release evidence has not been truthfully closed. The exact-head local release matrix has now been run and re-checked against GitHub Actions availability; the remaining work is the external browser/device rows — physical iOS Safari, representative physical Android Chrome, and current branded Microsoft Edge — plus a genuinely executed exact-head CI surface, before this verdict is rerun on one unified immutable candidate head.
