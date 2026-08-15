# Day 9 Release Candidate & Rehearsal — Current Final Verdict

Status: **DAY_9_RELEASE_CANDIDATE_REHEARSAL_BLOCKED_PHYSICAL_MATRIX_ONLY**

Bread's source-defined Day-9 money-path, deployment, rollback/reconcile, recovery, post-graduation V3 continuity and automated browser/release gates are now passing on executed repository evidence. The candidate is still **not** a Day-9 PASS because the required supported physical/current branded-device matrix is incomplete. No RC tag is authorized and Day 10 remains stopped.

## Current integrated Arc-Testnet evidence

Canonical bounded Day-9 Arc Testnet evidence includes:

- verified current Arc Testnet network identity and canonical 6-decimal USDC;
- verified generic `UNISWAP_V3` dependency manifest with Synthra as Arc-Testnet provider provenance only;
- real-dependency fork integration PASS at Arc block `56439192`;
- genuine chain-specific Safe v1.4.1 Protocol Admin `0x9004e285521d69197cd9965c301b02161eb1d0d8`, threshold 2-of-3;
- canonical Bread Arc Testnet deployment/ownership/config verification PASS from source commit `db0f6ed28e4a2475f54e84efadd7cf9693701353`, deployment start block `56448201`;
- public launch/buy/graduation/permanent-lock/creator-claim/replay lifecycle smoke PASS with token `0x9dc6c650929b641f93269a3b6d7d5237297d938b`, curve `0x68db37eea822d42af898b9777a96bef022a0e36d`, and Position Manager NFT `265870` permanently owned by Bread locker `0xecf66a3a221d90a413d9015803417aa8d4ba97fe`;
- real reversible Safe threshold signer recovery PASS, with nonce `0 -> 2`, exact original owner set restored, and the temporary recovery signer participating in the restore transaction;
- post-graduation V3 indexing/rebuild/reconcile continuity PASS, including one canonical trades ledger, journal-only valid dust semantics, REC-04 venue identity, REC-06 retained Swap identity, deterministic rebuild, malformed/conflicting-evidence atomic abort and runtime canonical-event scanning;
- production web build and service rollback PASS after restoring the chain-authoritative graduated-route contract;
- exact code-head automated browser evidence at `5a8a6ab49c0f4dd6cd41f200792665ae26a1168e` for Chromium desktop/mobile and the Chromium/Firefox/WebKit Day-9 release matrix.

All live-money language remains bounded to **Arc Testnet / non-production faucet assets**. No production economics, Arc-mainnet DEX, unrestricted-public-money, or production-authority claim is made.

## Current Day-9 requirement matrix

| Requirement | Result | Evidence boundary |
| --- | --- | --- |
| Source/environment reconciliation | PASS | Arc Testnet identity and canonical USDC reconciled. |
| Clean-environment scripted rehearsal | PASS | Controlled local rehearsal plus canonical public Arc Testnet deployment/lifecycle prove the scripted path. |
| Canonical Arc Testnet deployment | PASS_VERIFIED | Canonical manifest is `VERIFIED`; exact deployed addresses/hashes/start block retained. |
| Public Arc Testnet lifecycle | PASS | Exact launch token/curve/LP position, creator claim, zero graduation residue and replay rejection retained in `docs/evidence/day9-public-arc-lifecycle-smoke.md`. |
| Post-graduation V3 indexing/rebuild/reconcile | PASS | RED -> GREEN continuity is closed through the V3 final regression and deterministic rebuild/reconciliation checks. |
| Service rollback | PASS | Exact-head GitHub Actions run `31847657797` passed rollback rehearsal and the post-rollback root build. |
| Recovery/admin drills | PASS | Real Safe-compatible threshold owner replacement and restoration is retained in `docs/evidence/day9-safe-threshold-recovery.json`. |
| Browser-engine matrix | PASS | Exact-head Chromium desktop/mobile E2E run `31847657870` passed; exact-head Chromium/Firefox/WebKit release matrix run `31847657841` passed with canonical-manifest restoration. |
| macOS Safari physical | PARTIAL_PASS_EXTERNAL_USER_EXECUTION | Actual Safari navigation/responsive/Rabby connect/network-add/switch evidence exists. Buy/Sell/Create/Claim were not executed in that physical Safari run. |
| iOS Safari physical | EXTERNAL_EXECUTION_REQUIRED | Required physical/current coverage not yet available. |
| Android Chrome physical | PARTIAL_PASS_EXTERNAL_USER_EXECUTION | Real physical Android automatic-graduation failure/recovery evidence exists through `POOL_CREATED`, permanent lock and zero residue, but the remaining representative Android checklist rows are still required. |
| Desktop Edge branded | EXTERNAL_EXECUTION_REQUIRED | Current Edge branded execution not yet available; Chromium engine coverage is not relabeled. |
| Wallet/in-app browsers | NO_FIRST_CLASS_WALLET_BROWSER_CLAIM | No wallet brand is promoted to first-class without full claimed-path Create/Buy/Sell/Claim/network-switch execution. |
| Exact-head local release matrix | PASS_RETAINED | Prior exact-head local matrix remains historical evidence and is not relabeled as the current GitHub Actions run. |
| Exact-head GitHub Actions automated release surface | PASS | Code-bearing head `5a8a6ab49c0f4dd6cd41f200792665ae26a1168e`: V3 final regression `31847654814`, service rollback `31847657797`, Chromium E2E `31847657870`, and release browser matrix `31847657841` all succeeded. |

The controlling 04D Browser / Device Release Matrix requires current Chrome and Edge, current Safari on macOS, current Firefox, current plus previous-major iOS Safari where practical, current Chrome on a representative mid-range Android device, and only the wallet/in-app browser paths explicitly claimed. Engine/emulation evidence is not a substitute for required physical/branded execution.

## Non-waivable Day-9 end gate — current truth

```text
EMPTY_ENVIRONMENT_TO_USABLE_LAUNCHPAD = PASS_ARC_TESTNET_DEPLOYMENT_AND_PUBLIC_LIFECYCLE
POST_GRADUATION_V3_INDEXING_REBUILD_RECONCILE = PASS
ROLLBACK = PASS
RECONCILE = PASS
RECOVERY_DRILLS = PASS_REAL_SAFE_THRESHOLD_RECOVERY
SUPPORTED_MATRIX = BLOCKED_EXTERNAL_EXECUTION_REQUIRED
EXACT_HEAD_GITHUB_ACTIONS_AUTOMATED_RELEASE = PASS_AT_5a8a6ab49c0f4dd6cd41f200792665ae26a1168e

DAY_9_RELEASE_CANDIDATE_REHEARSAL_BLOCKED_PHYSICAL_MATRIX_ONLY
RC_TAG_CREATED = false
LIVE_ARC_DEPLOY_BROADCAST = PERFORMED_AND_VERIFIED_TESTNET_ONLY
LIVE_ARC_SMOKE_BROADCAST = PERFORMED_AND_VERIFIED_TESTNET_ONLY
DAY10_STARTED = false
```

## Remaining Day-9 blocker

The only Day-9-specific blocker now is:

- `PHYSICAL_DEVICE_EXTERNAL_EXECUTION_REQUIRED`

That blocker contains the remaining non-waivable physical/current branded rows: physical iOS Safari, still-unexecuted representative physical Android Chrome checklist steps, and current branded Microsoft Edge. macOS Safari and Android have partial real-device evidence, but partial evidence is not relabeled as full matrix PASS.

The prior Arc DEX/deployment, public lifecycle smoke, Safe environment and threshold recovery, post-graduation V3 indexing continuity, and exact-head automated CI blockers are cleared for the bounded Day-9 Testnet rehearsal.

Existing public/mainnet truthfulness gates remain unchanged and are not silently converted into Day-9 Testnet blockers:

- `CURRENT_PONS_FACTORY_SOURCE_PARITY`
- `PONS_V2_RUNTIME_REFERENCE`
- `BREAD_PRODUCTION_ECONOMICS_CONFIG`
- `PONS_AUDIT_FINDINGS`
- `ARC_MAINNET_VALUES`

## GitHub Actions classification

GitHub Actions is executing normally again. The previous Aug-12/Aug-13 `startup_failure` / zero-job observations remain historical evidence only and are no longer the current repository state.

At code-bearing head `5a8a6ab49c0f4dd6cd41f200792665ae26a1168e`:

- `day9-v3-final-regression` run `31847654814`: **SUCCESS**;
- `day9-lane4-service-rollback` run `31847657797`: **SUCCESS**;
- `day7-task10-playwright-closeout` run `31847657870`: **SUCCESS**;
- `day9-lane6-browser-matrix` run `31847657841`: **SUCCESS**.

The final state/evidence commits that follow this code-bearing head must themselves retain green repository truthfulness/formatting gates; they do not reopen the already-passed product behavior unless a fresh regression is demonstrated.

## Safe continuation

Do not create `bread-day9-rc1` and do not begin Day 10 while the supported physical/current branded-device matrix remains incomplete. The remaining work is physical iOS Safari, the remaining representative physical Android Chrome checklist rows, and current branded Microsoft Edge, with evidence recorded without converting engine emulation or partial real-device runs into full PASS. After those rows are genuinely executed, rerun the final Day-9 release gate and release matrix on one immutable candidate head. Only then may Day 9 be marked complete and an RC tag be considered.
