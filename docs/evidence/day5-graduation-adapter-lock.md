# Day 5 — Graduation / Adapter / Permanent Lock Merge-Candidate Evidence

Status: **GREEN CANDIDATE — PENDING GUARDED MERGE**

This document records the ratified Day-5 implementation candidate. It is not a durable Day-5 closeout verdict; final acceptance requires exact-head merge, fresh merged-main verification, and a durable closeout/handoff.

## Authority and baseline

- Project Source pack: `v1.5-day5-preflight-consolidated` — RATIFIED.
- Day-5 production start baseline / merged design-plan main: `ee315b4feb255b6c84c0b1ef51623a1155d77844`.
- Implementation PR: `#27` (`agent/day5-graduation-adapter-lock`).
- Exact audited implementation head before this evidence stamp: `1f4a8808ce145271f836313e5fd3c73695bc9281`.
- Exact implementation CI: `31285422630`.
- Required CI jobs on that head:
  - `bootstrap-validation`: PASS
  - `dependency-build`: PASS
  - `infrastructure-health`: PASS
  - `foundry-bootstrap`: PASS
- Foundry result: **34 suites, 196 tests passed, 0 failed, 0 skipped**.

## Implemented Day-5 lifecycle

- One canonical `GraduationCoordinator` owns graduation phase/custody state.
- Launches snapshot coordinator, adapter family/address and adapter configuration hash.
- Threshold-crossing trading remains persistent when best-effort automatic graduation fails.
- Stage 1 (`sweep`) is permissionless, validates readiness + snapshotted adapter before release, measures exact token/USDC receipt, preserves donation separation, and settles pre-graduation fees through canonical `BreadFeeEscrow`.
- Stage 2 (`createPool`) is permissionless from `SWEPT`, revalidates the snapshotted adapter, uses exact temporary allowances, rejects malformed accounting results, explicitly reconciles token residue and USDC dust, and records one terminal pool/position outcome.
- Failed Stage-2 attempts revert atomically to unchanged `SWEPT` custody; retry cannot duplicate liquidity or double-spend swept assets.
- Delayed recovery is Protocol-Admin-only, requires `graduationPaused`, exact `SWEPT` state and the seven-day recovery delay.
- `GraduationCoordinator.renounceOwnership()` is disabled so the only delayed recovery authority cannot be accidentally burned; ownership remains transferable to the ratified multisig-compatible Protocol Admin.
- The permanent locker has one-time coordinator wiring and no ordinary principal withdrawal, arbitrary-call, upgrade or admin escape surface.

## DEX and deployment boundary

- The adapter boundary remains DEX-neutral.
- V3 fallback implementation exists behind `IGraduationAdapter`; it is **not activated** in Arc network manifests.
- No Arc V4/V3 canonical deployment address is guessed or claimed.
- Arc testnet/mainnet Day-5 deployment manifests remain fail-closed with inactive/unresolved adapter fields until authoritative deployment evidence is ratified.
- `DeployDay5Graduation.s.sol` requires explicit Bread production-economics evidence and explicit Arc DEX deployment evidence rather than defaulting values.
- `configure-graduation.mjs` refuses activation without an explicitly ratified deployment manifest.
- `verify-graduation-deployment.mjs` verifies bytecode plus Factory/Coordinator/Locker/Escrow/Emergency/Admin wiring before live use.
- `smoke-graduation.mjs` gates a real broadcast launch -> trade -> graduate -> permanent-lock -> creator-claim -> replay-rejection lifecycle behind configure + live verification.

## Source-required financial/security gates

The exact audited head passed:

- `FULL_LAUNCH_TRADE_GRADUATE_LOCK_PASS` integration coverage.
- `INV-050`: at most one canonical graduated pool/state outcome.
- `INV-051`: exact snapshotted adapter/parameters.
- `INV-052`: validation before irreversible sweep.
- `INV-053`: failed automatic graduation does not revert the successful crossing trade.
- `INV-054`: retry cannot double-spend or duplicate liquidity.
- `INV-055`: successful graduation reconciles swept assets apart from explicit modeled dust.
- `INV-056`: permanent locked principal has no ordinary escape path.
- `RETRY_CANNOT_DUPLICATE_LIQUIDITY`.
- `RETRY_CANNOT_DOUBLE_SPEND_SWEPT_ASSETS`.
- donation resistance, wrong dependency/adapter rejection, pause-without-financial-mutation, allowance cleanup, and prior Day-1 through Day-4 regressions.

## Review notes

A source-led manual security review was performed because no independent reviewer/subagent execution surface is available in this chat. The review focused on custody/accounting, reentrancy, temporary approvals, adapter identity, retry/replay, donations, permanent-lock capabilities, delayed rescue authority, and fail-closed deployment plumbing. The ownership-renounce gap found during that review was reproduced RED and repaired GREEN before this evidence was recorded.

Bread's independent external review remains an unrestricted-public/mainnet release gate and is not represented as completed here.

## Merge gate

This candidate must not be called durably complete from this evidence alone. After this evidence/state stamp:

1. all four CI jobs must PASS again on the new exact PR head;
2. PR head/base/mergeability/reviews must be rechecked;
3. merge must use expected-head protection;
4. actual merged `main` must be verified;
5. fresh merged-main Day-5 closeout + durable handoff must pass before Day 6 production work begins.
