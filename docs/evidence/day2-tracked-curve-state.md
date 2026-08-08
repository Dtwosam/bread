# Day 2 Lane 2 — Tracked Curve State Evidence

Status: `DAY_2_TRACKED_CURVE_STATE_INTEGRATED_PASS`

## Integration base

- Base branch: `main`
- Durable Lane-1 closeout baseline: `aca14483ef5d8bee707a39e7ea628569d22d1828`
- Working branch: `checkpoint/day2-tracked-curve-state`
- Pull request: #6
- exact tested PR head: `4d2cd11f9aedf912997857486b88e850ca3a6ecb`
- final exact-head CI run: `31256808903`
- merge commit: `57b48940b71491ff9780764653c278b237eddd8d`

## Approved bounded production scope

Lane 2 adds one Bread production unit: `contracts/src/core/BreadTrackedCurveState.sol`.

It is an **abstract, non-deployable tracked-reserve/accounting base**. It contains no public/external state mutation method and deliberately omits Buy/Sell, quote receipt or payout, FeeEscrow, fee distribution/sweep/rescue, buyback execution, snipe protection, Launch+Buy, native quote handling, automatic graduation calls, graduation reserve transfer, hooks, pools, routers and DEX seeding.

The source basis is frozen Pons V2:

- repository: `ponsdotdev/ponsfamily`
- reference commit: `d5491e20be56051a68abf47136f6890c3ce3ff7d`
- source path: `contractsV2/src/v2/PonsV2BondingCurve.sol`
- source blob: `a5d84b3c355a1661e1bf61a4dd4e29591fbf6074`
- port mode: `BOUNDED_TRACKED_RESERVE_EXTRACTION`

The parity claim remains `FROZEN_SOURCE_BEHAVIOR_ONLY_NOT_CURRENT_LIVE_PARITY`.

## Tracked-state TDD

### RED

- RED head: `310d2f75c4302c68cbd2f0dd99232553d4ab8d35`
- CI run: `31256434625`
- `bootstrap-validation`: PASS
- `dependency-build`: PASS
- `infrastructure-health`: PASS
- `foundry-bootstrap`: EXPECTED FAIL
- exact failure: `contracts/src/core/BreadTrackedCurveState.sol` was intentionally absent.

### GREEN

- production state implementation commit: `0574b8c272d7aa599e53809b7c647986b676c2bc`
- CI run: `31256521989`
- all four CI jobs: PASS
- Foundry total at this stage: 43 passed, 0 failed, 0 skipped
- `BreadTrackedCurveStateTest`: 15 passed
- reserved-allocation fuzz: 256 runs

The implementation preserves only the approved frozen behaviors:

- tracked quote state is authoritative rather than raw quote-token balance;
- tracked launch-token state is authoritative rather than raw token balance;
- pending quote fee and creator-tax buckets are excluded from tradeable quote reserve;
- reserved allocation uses full-precision `Math.mulDiv(supply, phantomQuote, phantomQuote + graduationThreshold)`;
- invalid zero/whole-supply reserved allocations revert;
- sellable tokens stop at the reserved floor;
- reserve readers use tracked state;
- graduation readiness follows the tracked token floor and becomes false after the graduated flag is set.

## Six-decimal quote accounting

`MockUSDC6` returns 6 decimals. Tests use `1_000_000` base units for one USDC-like quote token and verify that `phantomQuote`, `graduationThreshold`, tracked quote, fee and tax buckets are stored and combined directly in those six-decimal units. The production state core performs no six-to-eighteen-decimal conversion.

No Arc mainnet quote-token address is hardcoded.

## Donation-resistance proofs

The state suite physically transfers assets to the harness without changing tracked accounting and proves:

- a raw quote-token donation does not change `quoteReserve()`;
- a raw quote-token donation does not change `realQuoteReserve()`;
- a raw quote-token donation cannot alter graduation readiness;
- a raw launch-token donation does not change `tokenReserve()`;
- a raw launch-token donation does not increase `sellableTokens()`;
- a raw launch-token donation cannot delay a launch already ready to graduate.

These are the Day-2 tracked-state donation-resistance proofs. Stateful Buy/Sell donation proofs remain deferred until those functions are source-authorized and implemented.

## Frozen full-precision math dependency

The exact additional OpenZeppelin files required by the frozen Pons allocation formula were copied from the same frozen reference tree and independently verified by Git blob SHA:

| Frozen upstream file | Exact Git blob SHA |
| --- | --- |
| `contractsV2/lib/openzeppelin-contracts/contracts/utils/math/Math.sol` | `e7288595b6539e986aef1a7a524884d86fc2d643` |
| `contractsV2/lib/openzeppelin-contracts/contracts/utils/Panic.sol` | `e168824d34b3f0ba0be33317fb34b9e74fc148b6` |
| `contractsV2/lib/openzeppelin-contracts/contracts/utils/math/SafeCast.sol` | `ccb979f61c9577e6338276cff49625d5a2191eb3` |

A one-time branch-scoped write-enabled workflow fetched and hash-verified those exact files. It was removed immediately after verified vendoring; removal commit: `6682d78d17bc9298e94c4c815e5c7dc6bf972aaf`.

Normal Bread CI does not fetch these dependencies dynamically. Bread continues to make no OpenZeppelin package-level version claim; exact file blobs are controlling.

## Tiny-trade rounding proof

- test commit: `f8c0ffd51f44d555d3bb39d1ea7130d41735f588`
- CI run: `31256566172`
- `BreadTinyTradeInvariantTest`: 5 passed
- single-round-trip fuzz: 256 runs
- repeated-round-trip fuzz: 256 runs
- full Foundry total: 48 passed, 0 failed, 0 skipped

The suite uses six-decimal quote units and zero-fee constant-product math. It proves that integer rounding alone cannot make a quote→token→quote round trip return more quote than it started with, including repeated bounded round trips.

This proof is intentionally **rounding-only**. It does not claim fee/tax stateful invariants; those must be rerun against the future authorized trading implementation.

## Executable source-provenance TDD

### RED

- RED head: `41a331412c695b33ef4cd3a9f0b6cae7e73fc7d7`
- CI run: `31256620643`
- Foundry remained PASS.
- bootstrap tests failed exactly because:
  - `BreadTrackedCurveState` was absent from the Day-2 source inventory; and
  - the frozen OpenZeppelin dependency inventory still contained 6 files instead of 9.

### GREEN

- provenance enforcement head: `625c5cfa391d65f26d54cf09878f7f4dde769144`
- CI run: `31256663164`
- all four CI jobs: PASS

The Day-2 inventory now records the frozen Pons curve path/blob and `BOUNDED_TRACKED_RESERVE_EXTRACTION`. The integrity validator requires exactly nine frozen OpenZeppelin files and recomputes each local file's canonical Git blob SHA-1 from its bytes on every validation run.

## Integrated review / cleanup

Review-cleanup head: `747eb2c764b39940bb76732dc2784cb6ea530406`
CI run: `31256713514`

All four CI jobs PASS at this head. Foundry reports 48 passed / 0 failed / 0 skipped.

The review found two test-only lint warnings and fixed both:

1. the tracked-state harness now checks the ERC-20 `transfer` return value;
2. tiny-trade fuzz bounds no longer use unnecessary narrowing casts.

No new test-only warning remains from those issues. The remaining Foundry notes are immutable-name style notes. The Bread names `pairToken`, `phantomQuote`, and `graduationThreshold` are retained because they match the approved source-derived public read surface; this is a style note, not a correctness or security failure.

### Production scope review verdict

The PR changed-file set contains one Bread production file for Lane 2: `contracts/src/core/BreadTrackedCurveState.sol`, plus the exact frozen dependency files and test/validation/docs support.

The production core remains `abstract`. It contains no external/public state mutation function and no implementation of:

- `buy` / `sell`;
- FeeEscrow;
- fee sweep / rescue / buyback execution;
- snipe protection;
- Launch+Buy;
- trusted-forwarder behavior;
- `msg.value` or native quote handling;
- graduation reserve transfer;
- Uniswap / pool / router execution.

No blocked-feature leakage was found.

## Final exact-head integration gate

Candidate head `4d2cd11f9aedf912997857486b88e850ca3a6ecb` contained implementation, frozen-source enforcement, review cleanup, evidence and the pre-merge handoff.

CI run `31256808903` completed:

- `bootstrap-validation`: PASS
- `dependency-build`: PASS, including frozen lockfile, validate/test/typecheck/build and tracked-workspace-clean gate
- `foundry-bootstrap`: PASS, 48 tests / 0 failures
- `infrastructure-health`: PASS, PostgreSQL + Redis

PR #6 was then merged with an expected-head guard requiring that exact tested SHA. Merge commit: `57b48940b71491ff9780764653c278b237eddd8d`.

## Retained blockers

- `CURRENT_PONS_FACTORY_SOURCE_PARITY`
- `EXACT_SNIPE_IMPLEMENTATION`
- `LAUNCH_AND_BUY_SOURCE`
- `FEE_ESCROW_SOURCE`
- `LIVE_RUNTIME_CONFIG`
- `PONS_AUDIT_FINDINGS`
- `ARC_MAINNET_VALUES`

No blocker is cleared or weakened by Lane 2.

## Lane verdict

`DAY_2_TRACKED_CURVE_STATE_INTEGRATED_PASS`

This is still not a deployable trading curve. Stateful Buy/Sell, fee/tax, escrow and graduation-transfer proofs belong to later source-authorized lanes.
