# Day-9 physical Android automatic-graduation failure and recovery repair

Status: `REPAIR_IMPLEMENTED_EXACT_FOCUSED_TEST_EXECUTION_REQUIRED`

Date: 2026-08-13

PR: #93 (`day9/synthra-arc-testnet-v3-candidate`)

## Scope

This evidence records the real physical-Android Arc Testnet threshold-crossing Buy regression discovered while completing Day-9 device acceptance, the read-only root-cause investigation, and the bounded browser recovery repair. It does not declare Day 9 complete, does not authorize Day 10, and does not claim an onchain recovery has been executed.

No Solidity, deployment, economics, custody, fee, DEX-adapter, permanent-lock, or authority configuration changed in this repair.

## Physical incident

Existing user-created Arc Testnet launch:

- token: `0x9E9c161316FFA946E0D809Ba17345728478132f5`
- curve: `0x11960c4A51647593BbCD2F7ece11F5732b60276F`
- graduation coordinator: `0x239Da83Ec8294b2433848eA8C85155f41E76f60a`
- threshold-crossing Buy transaction: `0x0fa24e607ec2d5972bec8b6c87a8c68741216526194eaaecabc1f22b89212ac3`
- transaction gas limit: `454675`
- transaction gas used: `444327`
- transaction status: success

Authoritative post-transaction reads established:

- `sellableTokens() = 0`
- `readyToGraduate() = true`
- `graduated() = false`
- curve `graduationCoordinator()` equals the canonical coordinator above

The successful threshold-crossing user trade therefore persisted while automatic Stage-1 graduation did not commit, matching the intended INV-053 persistence boundary but leaving the source-required permissionless retry path necessary.

The transaction receipt emitted `GraduationReady` followed by `GraduationAutoAttemptFailed`. The recorded failure hash is:

`0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470`

This is the Keccak-256 hash of empty bytes, so the caught coordinator call returned empty revert data rather than a Bread custom-error payload.

A later read-only standalone simulation of the exact coordinator call:

`GraduationCoordinator.sweep(0x9E9c161316FFA946E0D809Ba17345728478132f5)`

returned empty ABI success data (`0x`). No recovery transaction was broadcast.

## Root-cause classification

Bounded classification:

`AUTO_GRADUATION_BEST_EFFORT_GAS_ESTIMATION_LIVENESS_DEFECT`

The browser wallet adapter submits prepared transactions without an explicit gas budget. Because `BreadBondingCurve._tryAutoGraduation()` deliberately catches a failed `sweep(token)` so INV-053 can preserve an already-successful threshold-crossing Buy, ordinary gas estimation can accept the cheaper successful outer path in which:

1. the Buy succeeds;
2. the nested best-effort graduation attempt exhausts or otherwise loses its available call gas and returns empty failure data;
3. the curve catches that failure;
4. the outer transaction still completes successfully.

The physical transaction consumed `444327 / 454675` gas, emitted the empty-reason automatic-failure hash, preserved the Buy, and left a state whose standalone `sweep(token)` now simulates successfully. Those observations converge on the gas-estimation/best-effort liveness class.

A local `cast run` replay could not be used as definitive inner-call trace evidence because Foundry's replay of Arc's native/system USDC path failed at the chain-specific blocklist system call even though the actual transaction receipt is successful. That replay incompatibility is not classified as a Bread protocol failure.

Stopping the indexer was separately ruled out as a cause: the automatic graduation call is an onchain curve → coordinator call inside the Buy transaction. The indexer only observes and projects resulting chain state.

## Source-required repair direction

The ratified source stack intentionally requires both:

- INV-053: a failed automatic graduation attempt cannot undo the already-successful threshold-crossing user trade; and
- INV-054 / graduation UX recovery: a failed automatic attempt must remain safely permissionless/retryable without double-spend or duplicate-liquidity behavior.

Therefore this repair does not weaken INV-053 and does not invent a fixed protocol gas constant. It closes the missing real-browser recovery handoff by using the already-canonical SDK `prepareRetryGraduation()` owner.

`prepareRetryGraduation()` re-derives the next step from authoritative chain state immediately before signature:

- `NOT_GRADUATED` + canonical curve `readyToGraduate() == true` → `sweep(token)`;
- `SWEPT` → `createPool(token)`;
- `POOL_CREATED` → terminal `ALREADY_COMPLETE`;
- `RESCUED` → terminal `RESCUED`.

The indexed projection is used only to surface that recovery may be relevant. It is never accepted as the authority that chooses the financial write.

## Repair implementation

Code repair lineage after incident head `8a72ab366d5048c28a2803ee12e937de51b87543`:

- RED test commit: `2f3b835a0716f5c1656e376360d94d94abd0105a`
- transaction identity/persistence support: `5a635df2356b44c60698fe4caa9a6427e992d909`, `fbc026e9e19712d9fec81ee93c246e66c51e865e`
- canonical graduation retry controller: `65d59a009be519469b8dc504adee49f004fac24e`
- browser Pending/retry surface: `ff7bccc65bf12bd62913043e4d1904217532f138`
- browser regression: `36970f70804e767329f53d0e517ad2759cbff461`
- strict optional typing correction: `9946f8a1f31031da3974b14af7702535c8b57686`
- terminal-state indexed refresh correction: `00e8dfeac87c29d1ef7c03d300536b01e5dc82bb`
- focused terminal/reload recovery coverage: `67f2f6f9db2b0806e27e0dac6b0b40b5274258fc`

Changed implementation surface is bounded to:

- `apps/web/lib/transactions/graduation-controller.ts`
- `apps/web/lib/transactions/state.ts`
- `apps/web/lib/transactions/storage.ts`
- `apps/web/components/token/graduation-module.tsx`
- `apps/web/e2e/specs/degraded-graduation.spec.ts`
- `tests/day9/graduation-retry-wallet-recovery.test.ts`

The recovery lifecycle now:

1. validates wallet/chain;
2. re-reads canonical coordinator/factory/curve state;
3. simulates the exact authoritative retry transaction immediately before signature;
4. opens the wallet once for that transaction;
5. persists the transaction hash under a dedicated `GRADUATION` action;
6. recovers replacement/unknown confirmation after reload without rebroadcast;
7. refreshes indexed token state only after receipt confirmation, or immediately if the canonical chain state is already terminal.

The token Graduation module now tells users in failed-auto state that their completed trade remains confirmed and surfaces a permissionless retry action. Graduated/locked state does not expose a retry action.

## Verification state

Verified at code head `67f2f6f9db2b0806e27e0dac6b0b40b5274258fc`:

- GitHub compare against incident head: only the six bounded files above changed; no Solidity/economics/deployment/authority files changed.
- Vercel `bread-web`: production build SUCCESS at the preceding production-code head `00e8dfeac87c29d1ef7c03d300536b01e5dc82bb`; the subsequent `67f2f6f...` commit changes focused test coverage only.
- Vercel `bread-api`: SUCCESS at `00e8dfe...`.
- Vercel `bread-api-b5d9`: SUCCESS at `00e8dfe...`.
- GitHub Actions remains `startup_failure` before usable job creation and is classified as unavailable, not PASS and not a test failure.
- The current execution environment has no GitHub/network access and no cached Vitest installation, so it cannot independently run the repository test command.

The following focused commands remain required on the exact repaired head before any onchain recovery write is allowed:

```bash
corepack pnpm exec vitest run tests/day9/graduation-retry-wallet-recovery.test.ts tests/day6/sdk-retry-graduation.test.ts tests/day7/transaction-state.test.ts
corepack pnpm --filter @bread/web exec playwright test e2e/specs/degraded-graduation.spec.ts --project=desktop-chromium
corepack pnpm typecheck
corepack pnpm build
```

If those pass at the exact repaired head, the next bounded physical action is to restart the normal read/indexing composition as needed, reopen the existing BTST token, and exercise the new permissionless retry path on that same token. A fresh token, extra Buy/Sell, or blind manual `cast send sweep(...)` is not authorized by this evidence.

## Current verdict

`PHYSICAL_ANDROID_AUTO_GRADUATION_FAILURE_ROOT_CAUSED_RECOVERY_REPAIR_IMPLEMENTED_VERIFICATION_AND_ONCHAIN_RECOVERY_PENDING`

PR #93 remains draft/unmerged. Day 9 remains incomplete.
