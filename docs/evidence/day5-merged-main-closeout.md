# Day 5 — Merged-Main Closeout

Status: **CLOSEOUT PREREQUISITE CI PENDING — POST-SECURITY-HARDENING MAIN**

This closeout is intentionally rebuilt from the newest actual `main` after post-merge adversarial security PR #28 landed. The older PR #29 closeout proof is superseded because its base moved while CI was running.

## Accepted Day-5 implementation chain

- Ratified Project Source pack: `v1.5-day5-preflight-consolidated`.
- Main implementation PR: `#27`.
- Exact implementation head: `9dcd038a9ed3563de7999e5332c72a3b37d7312a`.
- Exact implementation CI: `31285733919` — all four repository jobs PASS.
- Main implementation merge: `a6bc5f7a2e90d9c9af1cd38f8f2ef6f635ceefa2`.

## Accepted post-merge adversarial proof layer

PR #28 adds tests/helpers only; it does not change production contracts.

- Exact PR #28 security head: `20f95230b15a44503c1cb23ba2d3d61c7f39a58e`.
- Exact PR #28 CI: `31285860020` — all four repository jobs PASS.
- Hardened Day-5 `main` / PR #30 base: `6608222f0716f52392922291288ac94f4b55f84a`.
- Proofs include:
  - two simultaneous `SWEPT` launches sharing coordinator USDC remain isolated;
  - unrelated coordinator USDC donations remain unattributed;
  - FeeEscrow creditor-authority failure rolls Stage 1 back exactly;
  - malformed adapter results roll Stage 2 back to unchanged `SWEPT`;
  - adapter reentrancy into `createPool` is rejected while the legitimate outer call completes;
  - coordinator-to-adapter allowances clear after failed and successful Stage 2;
  - failed post-pull attempts remain retryable without asset displacement or duplicate mint.

## Day-5 verdicts under closeout verification

- `FULL_LAUNCH_TRADE_GRADUATE_LOCK_PASS`
- `INV_050_056_PASS`
- `RETRY_CANNOT_DUPLICATE_LIQUIDITY`
- `RETRY_CANNOT_DOUBLE_SPEND_SWEPT_ASSETS`
- `DAY_5_GRADUATION_ADAPTER_LOCK_INTEGRATED_PASS` — pending durable closeout/handoff only
- `ARC_CANONICAL_GRADUATION_DEX_ACTIVATION = INACTIVE_PENDING_OFFICIAL_EVIDENCE`

## Operational/security boundary

- `GraduationCoordinator` recovery ownership is transferable but cannot be renounced.
- Deployment uses a temporary `BREAD_DEPLOYMENT_AUTHORITY`, requires Protocol Admin to be a contract, wires the stack first, then transfers exactly five Ownable surfaces to the long-lived Protocol Admin.
- No production economics, Arc mainnet values, or canonical Arc V4/V3 deployment is guessed.
- Arc graduation adapters remain inactive in network/deployment manifests until authoritative evidence is ratified.

## Still-open unrestricted-release gates

- exact current-live Pons V2 source/runtime parity remains unclaimed;
- Pons audits are not represented as completed/clean;
- Bread production economics/treasury/admin values remain unfrozen;
- Arc mainnet publication values remain pending;
- canonical Arc graduation DEX deployment remains pending;
- Bread independent external review remains required before unrestricted public/mainnet funds.

## Closeout sequence

1. Run all four repository jobs on the prerequisite closeout head derived from hardened main `6608222f0716f52392922291288ac94f4b55f84a`.
2. Stamp exact prerequisite head/run into this evidence and build state.
3. Run all four jobs again on the stamped closeout head.
4. Merge only the exact stamped green head with expected-head protection.
5. Verify actual merged `main`.
6. Create and merge durable post-closeout handoff before Day-6 production work.
