# Day 2 Core Math & Token Design

## Status

Approved design direction: minimal source-faithful Bread-named ports.

This design is intentionally limited to behavior that is directly supported by the frozen public Pons V2 source at commit `d5491e20be56051a68abf47136f6890c3ce3ff7d`.

## Goal

Introduce the first Bread financial-core Solidity code by porting only the source-verified launch-token and bonding-curve math behavior into Bread-owned names, with differential/unit/fuzz coverage proving the preserved semantics.

## Source basis

Frozen upstream sources:

- `contractsV2/src/v2/PonsV2LauncherToken.sol`
  - frozen blob SHA: `3a362035edbcc8be7aeb54f1beb41fa1e01c230a`
- `contractsV2/src/v2/libraries/PonsV2BondingCurveMath.sol`
  - frozen blob SHA: `73929a6f64fc4a3e684ffff895a6ef0a018c2019`

These sources are used only for this bounded lane. This design does not claim that the frozen repository is bytecode-equivalent to the current live Pons deployment.

## Chosen approach

Create Bread-owned source-faithful equivalents:

- `BreadLaunchToken`
- `BreadBondingCurveMath`

Preserve the frozen observable semantics and arithmetic exactly unless a Bread naming change is required. Do not redesign the economics or introduce abstractions that would make differential verification harder.

The Bread names make ownership and future evolution explicit while keeping the initial implementation close enough to the frozen reference for direct review.

## BreadLaunchToken design

`BreadLaunchToken` is a fixed-supply ERC-20 with holder burn support.

Constructor inputs remain behaviorally equivalent to the frozen source:

- name
- symbol
- logo
- description
- five social metadata strings
- deployer
- curve
- launch factory
- total supply

Required behavior:

1. Revert if deployer, curve, or launch-factory address is zero.
2. Store deployer, curve, and launch-factory addresses as immutable reference data.
3. Store logo, description, and socials as token metadata.
4. Mint the complete declared supply exactly once to the curve address at construction.
5. Give the deployer no privileged token role.
6. Preserve standard ERC-20 holder transfers/allowances.
7. Preserve holder-initiated burn behavior through OpenZeppelin `ERC20Burnable`.
8. Expose the five social fields and launcher-compatible token-info tuple with the same observable values as the constructor inputs.

Bread-specific changes are limited to contract/type names and comments. No owner, admin, mint-after-construction, blacklist, transfer tax, pause, fee, or launch-buy behavior is introduced.

## BreadBondingCurveMath design

`BreadBondingCurveMath` remains a pure constant-product quote library with basis-point input fees.

The formulas stay source-faithful:

`amountInWithFee = amountIn * (10_000 - feeBps)`

`amountOut = amountInWithFee * reserveOut / (reserveIn * 10_000 + amountInWithFee)`

For exact-output quotes:

`amountIn = amountOut * reserveIn * 10_000 / ((reserveOut - amountOut) * (10_000 - feeBps)) + 1`

Required behavior:

- `getAmountOut` reverts on zero input, zero input/output reserves, or an output that rounds to zero.
- `quoteAmountOut` returns zero instead of reverting for zero input, zero reserves, or `feeBps >= 10_000`.
- `getAmountIn` reverts on zero requested output, zero input reserve, `reserveOut <= amountOut`, or `feeBps >= 10_000`.
- Integer rounding remains Solidity integer rounding from the frozen source.
- No decimal normalization, oracle input, price-impact limit, graduation threshold, buyback logic, or reserve mutation belongs in this library.

## Architecture and file boundaries

Production Solidity:

- `contracts/src/BreadLaunchToken.sol` — token and metadata behavior only.
- `contracts/src/libraries/BreadBondingCurveMath.sol` — pure quote arithmetic only.

Test-only reference helpers may reproduce the frozen formulas/behavior independently so Bread outputs can be checked differentially without importing live or mutable upstream code.

No factory, curve state machine, escrow, hook, router, pool, launch-and-buy, snipe, or deployment implementation is part of this lane.

## Test strategy

TDD is mandatory. The first implementation commit must be preceded by failing tests against absent Bread contracts/libraries.

### Launch token tests

Cover at minimum:

- full supply minted to the curve and nowhere else
- immutable deployer / curve / launch-factory values
- metadata and all five socials round-trip exactly
- `getTokenInfo` returns constructor data
- each protected zero address reverts
- deployer has no mint/admin privilege
- holder transfer behavior remains normal ERC-20 behavior
- holder burn reduces holder balance and total supply

### Bonding-curve math tests

Use deterministic unit vectors plus fuzz/property tests for:

- exact frozen formula parity for `getAmountOut`
- exact frozen formula parity for `getAmountIn`
- `quoteAmountOut` equals the non-reverting frozen quote path
- output stays below `reserveOut`
- larger exact input does not produce smaller output for otherwise-fixed valid reserves/fee
- larger fee does not produce larger output for otherwise-fixed valid values
- exact-output required input is rounded upward by the frozen `+ 1` rule
- all documented zero/liquidity/full-fee error cases

Fuzz domains must be bounded to avoid arithmetic overflow that is outside the frozen source's intended valid-input domain. The bounds and assumptions must be explicit in the tests.

## Differential-verification rule

Tests must compare Bread behavior against an independently encoded frozen-reference expectation, not merely compare Bread functions to themselves.

If a mismatch is discovered, stop and determine whether it is:

- a Bread porting bug,
- a test/reference-encoding bug, or
- an upstream frozen-source edge case.

Do not silently change the formula to make a test pass.

## Security boundaries

This lane must not introduce or imply implementation of any active 7A blocker.

The following remain outside scope and BLOCKED:

- `CURRENT_PONS_FACTORY_SOURCE_PARITY`
- `EXACT_SNIPE_IMPLEMENTATION`
- `LAUNCH_AND_BUY_SOURCE`
- `FEE_ESCROW_SOURCE`
- `LIVE_RUNTIME_CONFIG`
- `PONS_AUDIT_FINDINGS`
- `ARC_MAINNET_VALUES`

In particular, the phrase in the upstream token comments that anyone may buy from the curve does not authorize Bread to implement a curve trading contract in this lane.

## Dependencies

Use the repository's pinned Solidity/Foundry toolchain and the existing OpenZeppelin dependency pattern. Do not add a new dependency unless the existing repository cannot express the frozen behavior.

## Acceptance gate

Day 2 core math/token passes only when:

1. failing tests were observed before implementation;
2. BreadLaunchToken behavior is covered and source-faithful;
3. BreadBondingCurveMath deterministic and fuzz/differential coverage passes;
4. Foundry build/tests pass;
5. repository bootstrap validation, JS/TS tests/typecheck/build, infrastructure health, and tracked-worktree cleanliness remain green;
6. integrated review finds no accidental widening into blocked financial behavior;
7. evidence and `docs/current-build-state.yaml` are updated before merge;
8. exact final PR head is green before integration.

## Non-goals

No attempt is made in this design to implement:

- Bread bonding-curve state or reserve custody
- buy/sell entry points
- launch factory/deployer
- Launch+Buy
- snipe protection
- fee escrow
- fee split/buyback logic
- graduation or Uniswap integration
- live Pons runtime-value adoption
- Arc mainnet deployment values

Those require their own source-permitted lanes and gates.