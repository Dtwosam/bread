# Day 5 — Merged-Main Closeout

## Status

`MERGED_MAIN_CLOSEOUT_STAMPED_PENDING_FINAL_CI`

This is the post-merge closeout record for Bread Day 5. The implementation and post-merge adversarial security hardening are both present on authoritative `main`, and the documentation-only prerequisite head has now passed the repository's full four-job CI gate. This stamped head must itself pass the same four-job gate before guarded merge. The final Day-5 verdict is therefore still withheld in this record until stamped-head CI and expected-head merge complete.

## Governing source state

- Project Source pack: `v1.5-day5-preflight-consolidated`
- Day-5 source ratification: `RATIFIED`
- Approved design: `docs/superpowers/specs/2026-08-08-day5-graduation-coordinator-design.md`
- Approved implementation plan: `docs/superpowers/plans/2026-08-08-day5-graduation-coordinator-v2.md`
- Day-5 design/plan merged baseline: `ee315b4feb255b6c84c0b1ef51623a1155d77844`

## Merged implementation identity

### PR #27 — implementation

- PR: `#27` — `Day 5: graduation adapter and permanent lock`
- Exact implementation PR head: `9dcd038a9ed3563de7999e5332c72a3b37d7312a`
- Guarded merge commit: `a6bc5f7a2e90d9c9af1cd38f8f2ef6f635ceefa2`
- Production behavior added:
  - canonical `GraduationCoordinator`
  - `IGraduationAdapter`
  - immutable per-launch coordinator/adapter/config snapshots
  - best-effort automatic Stage 1 after threshold crossing without reverting the successful trade
  - exact measured Stage-1 custody and canonical FeeEscrow settlement
  - retryable Stage 2 with replay/double-spend protection
  - permanent liquidity locker with no ordinary principal escape surface
  - delayed paused-only Protocol-Admin recovery path
  - inactive Uniswap V3 fallback behind the common adapter interface
  - fail-closed Day-5 deploy/configure/verify/smoke tooling and deployment manifests
  - deployment-authority-to-Protocol-Admin-Safe ownership handoff

### PR #28 — post-merge adversarial hardening

- PR: `#28` — `Day 5: post-merge adversarial security hardening`
- Exact security PR head: `20f95230b15a44503c1cb23ba2d3d61c7f39a58e`
- Exact CI run: `31285860020`
- Guarded merge commit / current closeout baseline: `6608222f0716f52392922291288ac94f4b55f84a`
- Scope: tests and test-only reentrancy harness; no production Solidity change
- All four repository jobs: `PASS`
- Foundry result: `35 suites / 201 tests PASS / 0 failed / 0 skipped`

The adversarial proof layer covers:

- simultaneous `SWEPT` launches sharing coordinator USDC custody
- unrelated coordinator USDC donation isolation
- FeeEscrow authorization failure with exact Stage-1 rollback
- malformed adapter-result rollback to unchanged `SWEPT`
- adapter reentrancy rejection while the legitimate outer graduation completes
- coordinator-to-adapter allowance cleanup after failure and success
- failed post-pull attempts remaining retryable without displacement, duplicate mint, or double spend

## Day-5 invariant / end-gate evidence present on merged main

The merged tree contains direct tests for:

- `INV-050` — at most one canonical graduated pool/state outcome
- `INV-051` — existing launch uses only its snapshotted adapter and parameters
- `INV-052` — validation precedes irreversible sweep
- `INV-053` — failed automatic graduation cannot revert a successful threshold-crossing trade
- `INV-054` — retry cannot double-spend swept assets or duplicate liquidity
- `INV-055` — successful graduation accounts for all reserved launch assets apart from explicitly modeled dust
- `INV-056` — permanent locker exposes no ordinary principal-withdrawal/arbitrary-call escape path

The merged tree also contains the full launch → trade → graduate → permanent-lock integration proof, retry/replay proofs, dust/donation handling, wrong-dependency validation, pause behavior, delayed rescue behavior, and deployment/verification fail-closed checks.

## External dependency / release boundaries

These remain intentionally open and are **not** Day-5 engineering failures:

- `CURRENT_PONS_FACTORY_SOURCE_PARITY`: no exact-current Pons source parity claim
- `PONS_V2_RUNTIME_REFERENCE`: numeric runtime/reference values remain unfrozen
- `BREAD_PRODUCTION_ECONOMICS_CONFIG`: public/mainnet release gate; values are not guessed
- `PONS_AUDIT_FINDINGS`: official Pons V2 docs still report the independent audit engagements as in progress; no completed public Pons audit report is relied upon
- `ARC_MAINNET_VALUES`: official mainnet values remain unpublished/unfrozen
- Arc V4: no Arc entry is present in the verified official Uniswap V4 deployment registry
- Arc V3: fallback contract exists behind `IGraduationAdapter`, but Arc activation remains false without verified deployment need/evidence

No Arc V4/V3 deployment address is claimed by this closeout. The checked-in Arc Day-5 deployment manifests remain blocked/unpopulated and fail closed.

## Closeout prerequisite gate — PASS

Closeout branch baseline:

`6608222f0716f52392922291288ac94f4b55f84a`

Exact prerequisite evidence head:

`da87b83ae7726cf639ad676dde2fc93f69579d90`

Exact prerequisite CI run:

`31286039724`

Required jobs and result:

- `bootstrap-validation` — PASS
- `dependency-build` — PASS
- `infrastructure-health` — PASS
- `foundry-bootstrap` — PASS

All four jobs passed on the same prerequisite head.

## Stamped-head final CI gate

This documentation stamp creates a new head and therefore the prerequisite CI above is not sufficient for merge. The exact stamped head produced by this evidence/build-state update must pass all four repository jobs again. Only that stamped green head may be merged with expected-head protection.

## Final verdict

Not issued yet. Pending stamped-head four-job CI and guarded closeout merge.

Day 6 production work remains blocked until the stamped closeout is green, merged, and followed by the durable final build-state handoff/normalization.
