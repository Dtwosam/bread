# Day 2 — Financial Core Math & Token Closeout

Status: `DAY_2_FINANCIAL_CORE_MATH_TOKEN_INTEGRATED_PASS`

## Controlling requirement

Day 2 is controlled by `06C-exact-10-day-build-order-daily-gates-v1.1.docx`.

Required work:

1. port LaunchToken and BondingCurveMath minimally;
2. unit/fuzz fixed-supply, six-decimal math, allocation/graduation and rounding coverage;
3. differential-test unchanged math where possible;
4. build a tracked-reserve curve skeleton;
5. add donation-resistance and tiny-trade invariants.

End-of-day gates:

- core math fuzz PASS;
- supply invariants PASS;
- no unexplained reference divergence.

The same source requires each day to close from one integrated green baseline, with task-specific tests plus regressions and no real downstream interface left on placeholder/mock semantics.

## Requirement-by-requirement evidence

### Minimal LaunchToken port — PASS

Implemented in Day-2 Lane 1 from frozen Pons launcher-token blob `3a362035edbcc8be7aeb54f1beb41fa1e01c230a`.

Proof includes fixed supply minted once to the curve, immutable attribution/factory/curve metadata, standard ERC-20 transfer/allowance behavior, holder burn support, zero-supply behavior and absence of owner/public post-construction mint authority.

### Minimal BondingCurveMath port — PASS

Implemented in Day-2 Lane 1 from frozen Pons math blob `73929a6f64fc4a3e684ffff895a6ef0a018c2019`.

Deterministic differential tests and bounded fuzz compare Bread output/input math against an independently encoded frozen-reference helper, including the exact-output `+1` round-up behavior.

### Fixed-supply tests — PASS

`BreadLaunchTokenTest` contains deterministic supply/burn/no-mint tests plus 256-run fuzz coverage that initial declared supply belongs to the curve.

### Six-decimal math/accounting — PASS

Lane 2 introduces `MockUSDC6`, where one quote token is exactly `1_000_000` base units. State tests prove `phantomQuote`, graduation threshold and tracked quote buckets are stored and combined directly in six-decimal quote units with no 6→18 scaling.

Tiny-trade tests also use six-decimal quote reserves and inputs.

### Allocation / graduation formula tests — PASS

`BreadTrackedCurveStateTest` verifies the frozen reserved-token formula using full-precision frozen OpenZeppelin `Math.mulDiv` and a bounded independent arithmetic reference. The fuzz case runs 256 times.

It also proves invalid zero/whole-supply reserved allocations reject, sellable supply stops at the reserved floor, and graduation readiness follows tracked token exhaustion.

### Rounding tests — PASS

Lane-1 math tests preserve the frozen `getAmountIn` round-up rule. Lane-2 tiny-trade tests prove integer rounding alone cannot create quote profit on a quote→token→quote round trip, including bounded repeated cycles.

### Differential unchanged math — PASS

`BreadBondingCurveMath` is differentially tested against the frozen Pons formula helper in deterministic and 256-run fuzz tests. No unexplained arithmetic divergence remains in the approved Day-2 math scope.

### Tracked-reserve skeleton — PASS

`BreadTrackedCurveState` is an abstract reserve/accounting base extracted from frozen `PonsV2BondingCurve.sol` blob `a5d84b3c355a1661e1bf61a4dd4e29591fbf6074` under explicit port mode `BOUNDED_TRACKED_RESERVE_EXTRACTION`.

It tracks quote/token reserves independently of raw wallet balances, excludes pending fee/tax buckets from tradeable quote reserve, calculates reserved tokens, exposes reserve readers and reports readiness. It deliberately has no external/public mutation function or trading implementation.

### Donation resistance — PASS for Day-2 state scope

Tests physically donate quote and launch tokens directly to the state harness without changing tracked accounting. Raw donations cannot alter tracked pricing reserves or graduation readiness.

Stateful Buy/Sell donation tests are correctly deferred because Buy/Sell is Day 3 work and is not yet authorized/implemented.

### Tiny-trade invariant — PASS for Day-2 rounding scope

`BreadTinyTradeInvariantTest` includes 5 tests, including two 256-run fuzz properties. Zero-fee integer rounding never increases the trader's quote value in a single or repeated bounded round trip.

Fee/tax tiny-trade behavior is not claimed here and belongs to the Day-3 stateful financial invariant set.

## Frozen dependency provenance

The Day-2 integrity inventory now enforces nine exact OpenZeppelin source blobs from the same frozen Pons tree. CI recomputes canonical Git blob SHA-1 from local bytes and fails on drift.

Bread makes no package-level OpenZeppelin version claim.

## Integrated verification

Day-2 Lane 1:

- PR #4 final exact head `d65a45c9da6c23f40a0a1861c75acf96bc8f8b33`
- final CI run `31255399674`: all four jobs PASS
- merge `0051d86f635ee4dfa9e2422f6f2fac7231e4f915`
- durable Lane-1 closeout merge `aca14483ef5d8bee707a39e7ea628569d22d1828`

Day-2 Lane 2:

- PR #6 final exact head `4d2cd11f9aedf912997857486b88e850ca3a6ecb`
- final CI run `31256808903`: all four jobs PASS
- Foundry: 48 passed / 0 failed / 0 skipped
- merge `57b48940b71491ff9780764653c278b237eddd8d`

The Lane-2 exact-head gate includes bootstrap/source-integrity validation, frozen-lockfile install, validation/test/typecheck/build, clean tracked workspace, Foundry compile/tests and PostgreSQL/Redis health.

## Daily continuity assessment

Day 2 began from the integrated Day-1 baseline and both dependent Day-2 lanes were merged serially.

The stable financial-core math/token/state capabilities have no already-existing SDK/indexer/API/web consumer that needs wiring yet; those layers are scheduled later. `BreadTrackedCurveState` is intentionally abstract, so Bread does not expose a fake concrete trading interface whose consumers could depend on mock Buy/Sell semantics.

Regression coverage includes all earlier bootstrap, dependency/build, infrastructure, LaunchToken and BondingCurveMath tests.

## Reference-divergence assessment

Explained Bread-specific changes are explicit:

- Bread V1 uses ERC-20 quote assets only in this state core; the frozen Pons native-asset sentinel is intentionally not carried forward.
- six-decimal quote values are used directly with no internal decimal normalization.
- only the source-verified tracked-reserve subset of the frozen Pons curve is extracted; blocked fee/trading/graduation-transfer behaviors are not guessed.

No unexplained reference divergence exists in the Day-2 approved scope.

## Retained blockers

- `CURRENT_PONS_FACTORY_SOURCE_PARITY`
- `EXACT_SNIPE_IMPLEMENTATION`
- `LAUNCH_AND_BUY_SOURCE`
- `FEE_ESCROW_SOURCE`
- `LIVE_RUNTIME_CONFIG`
- `PONS_AUDIT_FINDINGS`
- `ARC_MAINNET_VALUES`

These blockers remain active and become especially relevant to Days 3–5.

## End-of-day verdict

All controlling Day-2 work items and end-of-day gates are evidenced.

`DAY_2_FINANCIAL_CORE_MATH_TOKEN_INTEGRATED_PASS`

This is a Day-2 implementation verdict only. Bread is not yet a deployable public-money launchpad; trading, fees, escrow, factory/snipe/emergency, graduation/adapters, SDK/indexer/API, web, attack/load testing and release rehearsal remain later-day work.
