# Day-9 physical Android automatic-graduation failure and recovery repair

Status: `PHYSICAL_ANDROID_AUTO_GRADUATION_RECOVERY_PASS`

Date: 2026-08-13

PR: #93 (`day9/synthra-arc-testnet-v3-candidate`)

## Scope

This evidence records the real physical-Android Arc Testnet threshold-crossing Buy regression discovered while completing Day-9 device acceptance, the read-only root-cause investigation, the bounded browser recovery repair, exact-head local verification, and the successful recovery of the same existing BTST token.

It does not declare Day 9 complete, authorize Day 10, create an RC tag, clear unrelated physical-browser rows, or claim GitHub Actions executed successfully.

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

The transaction receipt emitted `GraduationReady` followed by `GraduationAutoAttemptFailed`. The recorded failure hash was:

`0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470`

This is the Keccak-256 hash of empty bytes, so the caught coordinator call returned empty revert data rather than a Bread custom-error payload.

A later read-only standalone simulation of the exact coordinator call:

`GraduationCoordinator.sweep(0x9E9c161316FFA946E0D809Ba17345728478132f5)`

returned empty ABI success data (`0x`). No recovery write was made before root-cause repair and verification.

## Root-cause classification

Bounded classification:

`AUTO_GRADUATION_BEST_EFFORT_GAS_ESTIMATION_LIVENESS_DEFECT`

The browser wallet adapter submits prepared transactions without an explicit gas budget. Because `BreadBondingCurve._tryAutoGraduation()` deliberately catches a failed `sweep(token)` so INV-053 can preserve an already-successful threshold-crossing Buy, ordinary gas estimation can accept the cheaper successful outer path in which:

1. the Buy succeeds;
2. the nested best-effort graduation attempt exhausts or otherwise loses its available call gas and returns empty failure data;
3. the curve catches that failure;
4. the outer transaction still completes successfully.

The physical transaction consumed `444327 / 454675` gas, emitted the empty-reason automatic-failure hash, preserved the Buy, and left a state whose standalone `sweep(token)` simulated successfully. Those observations converge on the gas-estimation/best-effort liveness class.

A local `cast run` replay could not be used as definitive inner-call trace evidence because Foundry's replay of Arc's native/system USDC path failed at the chain-specific blocklist system call even though the actual transaction receipt was successful. That replay incompatibility is not classified as a Bread protocol failure.

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
- pre-recovery evidence head: `92e70a31ddf1806f843af4142dc8172b6f55f211`

Changed implementation surface was bounded to:

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

The token Graduation module tells users in failed-auto state that their completed trade remains confirmed and surfaces the permissionless recovery action. `SWEPT` exposes only the next `createPool` step. `POOL_CREATED`/terminal state exposes no further retry action.

## Exact-head local verification

The repair was verified locally at exact code/evidence head `92e70a31ddf1806f843af4142dc8172b6f55f211` before any recovery write:

- focused Vitest command: PASS;
- files: 3 passed / 3;
- tests: 15 passed / 15;
- `tests/day9/graduation-retry-wallet-recovery.test.ts`: 6 passed;
- `tests/day6/sdk-retry-graduation.test.ts`: 4 passed;
- `tests/day7/transaction-state.test.ts`: 5 passed;
- physical recovery browser regression, desktop Chromium: 2 passed / 2;
- workspace `tsc -b`: PASS;
- full workspace build: PASS;
- production Next.js build: PASS.

The first Playwright/build attempt was blocked before test execution because child shells could not resolve plain `pnpm`; a temporary operator-local shim mapped `pnpm` to `corepack pnpm` without modifying the repository or global installation. The rerun then passed. This was classified as local shell tooling, not application behavior.

Vercel builds for the repaired branch were also Ready. GitHub Actions remained `startup_failure` before usable job creation and remains classified as unavailable, not PASS and not a test failure.

## Bounded LAN recovery environment

The source-defined Day-9 LAN composition was restarted from the repaired branch and passed its startup gate:

- real indexer caught up to Arc Testnet and remained synchronized;
- real Bread API listened on loopback;
- production Next.js build completed successfully;
- same-origin LAN entrypoint became ready at the operator's LAN address;
- Postgres, Redis, API and web remained loopback-only behind the bounded proxy.

The indexer was therefore healthy during the recovery. No fresh token, extra Buy/Sell, contract deployment, or manual `cast send sweep(...)` was used.

## Physical recovery execution

Recovery was performed on the same existing BTST token through the repaired physical Android browser path.

### Stage 1 — permissionless sweep

- action selected from fresh canonical state: `sweep(token)`;
- transaction hash: `0xbb4e1d42339aa68faaa90ae765f2f1392d7fb9dc4387a10c56049e4713e71360`;
- browser lifecycle: `CONFIRMED`;
- indexed coordinator state advanced from `NOT_GRADUATED` to `SWEPT`;
- no duplicate Buy/Sell and no fresh launch occurred.

### Stage 2 — create pool and permanent lock

At canonical phase `SWEPT`, the repaired SDK can prepare only `createPool(token)`.

- transaction hash: `0xa87ee13b73656edd678e4c4505162bf8dd49d76baef8cda46d3b8f625f0df2e9`;
- receipt block: `56779955`;
- receipt status: `1 (success)`;
- gas used: `5482075`;
- transaction target: canonical Graduation Coordinator `0x239Da83Ec8294b2433848eA8C85155f41E76f60a`;
- final coordinator phase: `2 (POOL_CREATED)`;
- pool: `0x9995b278d08484ff746bbe91187a723d85c093f1`;
- Position Manager: `0x444Cc395346428216fB6f2892eb03cB804aE4CD5`;
- position ID: `266664`;
- curve `graduated()`: `true`.

The Stage-2 receipt records the V3 position NFT mint/transfer directly to Bread's permanent liquidity locker.

## Final custody and residue verification

Read-only post-recovery verification established:

- `PositionManager.ownerOf(266664) = 0xeCF66A3a221D90A413d9015803417aA8D4Ba97fE`;
- canonical permanent liquidity locker: `0xecf66a3a221d90a413d9015803417aa8d4ba97fe`;
- Graduation Coordinator BTST balance: `0`;
- Graduation Adapter BTST balance: `0`;
- Graduation Coordinator USDC balance: `0`;
- Graduation Adapter USDC balance: `0`.

Address comparison is case-insensitive; the NFT owner is exactly the canonical locker. No launch-token or USDC graduation residue remains in the coordinator or adapter.

## Recovery verdict

`PHYSICAL_ANDROID_AUTO_GRADUATION_REGRESSION_ROOT_CAUSED_REPAIRED_VERIFIED_AND_EXISTING_BTST_RECOVERY_PASS`

The regression/recovery lane is closed:

- threshold-crossing Buy persistence preserved;
- permissionless recovery path verified;
- Stage 1 succeeded;
- Stage 2 succeeded;
- final coordinator phase is `POOL_CREATED`;
- curve is graduated;
- permanent-lock custody is correct;
- coordinator/adapter token and USDC residue is zero;
- no blind manual recovery write, fresh token, or extra trade was required.

PR #93 remains draft/unmerged. Day 9 remains incomplete only for its still-open unrelated release gates, including remaining required physical/current branded-device coverage and unavailable exact-head external CI. No Day-10 start or RC tag is authorized by this evidence.
