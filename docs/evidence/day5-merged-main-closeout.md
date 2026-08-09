# Day 5 — Merged-Main Closeout

Status: **CLOSEOUT PREREQUISITE CI PENDING**

This is fresh post-merge evidence created from actual merged `main`. It does not rely on the pre-merge PR synthetic merge ref.

## Verified implementation merge

- Ratified Project Source pack: `v1.5-day5-preflight-consolidated`.
- Day-5 implementation PR: `#27`.
- Exact merged implementation head: `9dcd038a9ed3563de7999e5332c72a3b37d7312a`.
- Exact implementation CI: `31285733919` — all four repository jobs PASS.
- Guarded implementation merge: `a6bc5f7a2e90d9c9af1cd38f8f2ef6f635ceefa2`.
- `main` was verified identical to that merge before this closeout branch was created.

## Candidate verdicts carried into merged-main verification

- `FULL_LAUNCH_TRADE_GRADUATE_LOCK_PASS`
- `INV_050_056_PASS`
- `RETRY_CANNOT_DUPLICATE_LIQUIDITY`
- `RETRY_CANNOT_DOUBLE_SPEND_SWEPT_ASSETS`
- `ARC_CANONICAL_GRADUATION_DEX_ACTIVATION = INACTIVE_PENDING_OFFICIAL_EVIDENCE`

The implementation candidate includes exact graduation snapshots, permissionless retryable Stage 1/Stage 2, canonical FeeEscrow settlement, permanent principal lock, delayed guarded rescue, donation/dust/wrong-dependency handling, disabled coordinator ownership renunciation, and fail-closed deploy/configure/verify/live-smoke operations.

## Deployment authority closeout note

The deployment script separates temporary `BREAD_DEPLOYMENT_AUTHORITY` from the long-lived Protocol Admin. The deployer key must match the temporary authority, all mutable stack wiring occurs under that authority, the Protocol Admin must be a contract, and exactly five Ownable surfaces are transferred to the Protocol Admin after wiring. The deployment key is not required to equal the Protocol Admin Safe.

## Still-open release gates

This closeout does not claim:

- exact current-live Pons V2 source/runtime parity;
- completed/clean Pons audit status;
- approved Bread production economics/treasury/admin values;
- Arc mainnet publication values;
- a canonical Arc V4/V3 graduation deployment;
- completion of Bread's independent external review for unrestricted public/mainnet funds.

## Closeout sequence

1. Run the full four-job repository CI on this merged-main closeout prerequisite head.
2. If all four jobs pass, stamp that exact head/run into this document.
3. Run full CI again on the stamped closeout head.
4. Merge only the exact stamped green head with expected-head protection.
5. Create the durable post-closeout handoff before any Day-6 production work.
