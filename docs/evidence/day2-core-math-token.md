# Day 2 — Core Math & Token Evidence

Status: IN PROGRESS — MATH RED PENDING CI

## Approved bounded scope

- `BreadBondingCurveMath` from frozen Pons V2 source blob `73929a6f64fc4a3e684ffff895a6ef0a018c2019`
- `BreadLaunchToken` from frozen Pons V2 source blob `3a362035edbcc8be7aeb54f1beb41fa1e01c230a`
- Frozen reference commit: `d5491e20be56051a68abf47136f6890c3ce3ff7d`
- Parity claim is limited to frozen-source behavior and does not claim current-live Pons deployment parity.

## Math TDD

RED candidate branch: `checkpoint/day2-core-math-token`

The test-only frozen reference helper independently encodes the approved Pons formula. `BreadBondingCurveMath.t.sol` imports the intentionally absent Bread production library so the first Foundry run must fail before implementation.

Math RED run/head: PENDING
Math GREEN run/head: PENDING

## Token TDD

Token RED run/head: PENDING
Token GREEN run/head: PENDING

## Retained blockers

- `CURRENT_PONS_FACTORY_SOURCE_PARITY`
- `EXACT_SNIPE_IMPLEMENTATION`
- `LAUNCH_AND_BUY_SOURCE`
- `FEE_ESCROW_SOURCE`
- `LIVE_RUNTIME_CONFIG`
- `PONS_AUDIT_FINDINGS`
- `ARC_MAINNET_VALUES`

No blocked behavior is authorized by this lane.
