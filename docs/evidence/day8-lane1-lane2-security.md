# Day 8 — Lane 1 & Lane 2 Security Evidence

Date: 2026-08-10

Status: `DAY8_LANE1_LANE2_SECURITY_PASS`

Baseline: durable Day-7 `main` `b3c7d7b51ec9398f3b786c795a4f625b8020580a`

This evidence covers the Day-8 extended financial invariant control and the initial static/manual money-code + privileged-abuse review. It does not close Day 8; failure injection, metadata/browser attack coverage, 06I capacity proof, integrated exact-head review and a separate durability handoff remain required.

## Policy boundary

The repository does not contain a top-level `SECURITY.md`; the controlling security policy for this review is the ratified Bread Source Pack, especially 05A threat boundaries, 05B privileged roles, 05C financial invariants, 05D recovery, and the 06C/06D Day-8 execution gates.

No production economics, Pons runtime numeric values, Arc mainnet values or canonical DEX addresses were inferred during this review.

## Lane 1 — extended financial invariant control

Workflow: `day8-lane1-extended-invariants`

Control run: `31422163434`

Configuration:

- Foundry `v1.5.0`;
- `FOUNDRY_FUZZ_RUNS=4096`;
- `FOUNDRY_INVARIANT_RUNS=256`;
- `FOUNDRY_INVARIANT_DEPTH=64`;
- full `forge test -vv` over the accepted contract system;
- generated Bread SDK ABI exactness check.

Result:

- **35 suites**;
- **201 passed / 0 failed / 0 skipped**;
- fuzz properties executed at 4,096 runs;
- generated ABI check PASS.

The run exercised the existing Bread corpus for:

- tracked-reserve donation resistance and tiny-trade extraction;
- buy/sell slippage, fee/tax/refund conservation and final crossing fills;
- FeeEscrow authorized credit, exact received amount, solvency, donation isolation, claim replay prevention, failed-transfer rollback and claim reentrancy;
- Launch+Buy rollback, refund and no stranded Factory custody;
- exact opening-tax formula/monotonicity/expiry, one-call exemption, buy-only behavior and routing;
- Guardian/Admin restrictions and existing-launch snapshot immutability;
- graduation wrong-dependency/failure/retry/dust/donation/reentrancy behavior;
- INV-050–056 exactly-once/permanent-lock/retry properties;
- rescue timing and post-success rescue exclusion.

No high-intensity control failure demonstrated a missing financial behavior, so Lane 1 made **no production Solidity change** and did not create speculative RED tests.

## Lane 2 — pinned static analysis

Tool: `slither-analyzer==0.11.6`

Initial discovery run: `31422594942`

Reviewed gate run: `31423446443`

Scope: `contracts/src` (`lib`, `test`, and `script` excluded from Slither detector output; scripts were separately reviewed through compiler/lint output).

Discovery result:

- 48 total Slither findings;
- 6 High;
- 17 Medium;
- 23 Low;
- 2 Informational.

The reviewed High/Medium fingerprint is committed in `config/security/slither-triage-v1.json` and enforced by `scripts/security/check-slither-triage.py`. The workflow does **not** globally suppress detector classes. Every High/Medium finding must match one reviewed detector/function/count rule; new, removed, moved or reclassified High/Medium findings require retriage.

Reviewed gate result: PASS.

### Six High `reentrancy-balance` findings

All six are `NOT_ACTIONABLE` after source-to-sink review.

They are two balance checkpoints each in:

1. `GraduationCoordinator._releaseExact`;
2. `GraduationCoordinator._settleFeesAndRecord`;
3. `GraduationCoordinator._executeAdapter`.

Reasoning/evidence:

- `sweep`, `createPool`, and rescue use the single OpenZeppelin `nonReentrant` guard, which blocks nested calls to any protected coordinator entry point.
- The factory-recorded curve is the canonical Bread curve. `releaseForGraduation` accepts only the configured coordinator, zeros tracked accounting before transfer, and returns exact amounts which the coordinator reconciles against actual balance deltas.
- FeeEscrow is an immutable canonical dependency. `credit` accepts only authorized creditors, pulls exact USDC and verifies the exact amount received before crediting claims.
- The graduation adapter is not per-user input. Future adapter configuration is Factory-owner controlled, an enabled configuration must match canonical USDC/locker/config identity, and the adapter/config is snapshotted into each launch.
- Adapter allowances are exact and are cleared after use.
- `BreadDay5Security.testAdapterReentrancyIsRejectedWithoutBreakingOuterGraduation` proves a malicious adapter callback cannot reenter the coordinator while the legitimate outer graduation remains valid.
- The flagged pre/post balance reads are defensive conservation postconditions, not authentication or price authority.

No attacker-controlled callback path capable of invalidating the checkpoint and continuing successfully was established.

### Medium findings

All 17 are `NOT_ACTIONABLE` and exact-count gated.

- `divide-before-multiply` (2): V3 full-range tick alignment. Canonical Uniswap V3 fee spacing is positive and capped below 16,384; Bread intentionally computes the nearest usable ticks and has an exact spacing-60 regression (`-887220` / `887220`). This is not financial amount rounding.
- `incorrect-equality` (11): exact initialization, lifecycle, pool-identity, no-work, graduation-completion and conservation sentinels. These equalities implement Bread invariants; replacing them with approximate comparisons would weaken correctness.
- `reentrancy-no-eth` (2): `GraduationCoordinator.sweep` and `createPool` are externally `nonReentrant`; the scanner reports writes after guarded external interactions but does not establish a bypass.
- `uninitialized-local` (1): `previewLaunchEconomics` declares a memory struct then explicitly assigns every `EconomicsDigestInput` field before `abi.encode`.
- `unused-return` (1): `_poolSqrtPrice` intentionally consumes only `slot0.sqrtPriceX96`, the one field relevant to initialization-price identity.

### Low / informational review

The lower findings remain visible in every static workflow log.

- FeePolicy zero `feeSweepOperator` (2 Low): no fund-safety issue. The operator is owner-controlled and a zero operator only removes the shared operator path; every curve's `creatorFeeRecipient` remains independently authorized to sweep earned fees. No funds or entitlement are lost.
- `reentrancy-benign` (4 Low): the same canonical/guarded call graph already reviewed above; Factory launch entry points are `nonReentrant` and atomic failure rolls the transaction back.
- `timestamp` (17 Low): most entries are detector overreach on ordinary comparisons in functions that also use timestamped state. The actual time-security decisions are intentional and source-defined: the five-second opening-protection window / same-launch-timestamp exemption and the seven-day swept-graduation rescue delay. Both have permanent tests.
- `low-level-calls` (1 Informational): the curve performs a read-only `staticcall` to its immutable Factory to discover the optional graduation coordinator; it does not delegate execution or transfer funds through the low-level call.
- `missing-inheritance` (1 Informational): `BreadLaunchFactory` structurally exposes the canonical `IBreadLaunchFactory` surface but does not explicitly inherit it. No runtime authority or ABI ambiguity was demonstrated.

### Compiler / Forge lint security-relevant warnings

Reviewed and non-actionable:

- opening-tax `uint16` conversion is bounded by the exact 9,900-bps maximum;
- V3 sqrt-price conversion first bounds `sqrtPriceX64 <= type(uint128).max`; shifting left 32 bits therefore fits exactly in `uint160`, followed by canonical sqrt-price range validation;
- Day-5 deployment `_u16` / `_u24` helpers reject values above target-type maxima before casts;
- Day-5 smoke creator-tax parsing rejects values above `uint16` max before conversion.

Style/naming/unused-test-import lint notes are not security findings and were not used to justify production churn.

## Privileged-abuse / manual authority review

Reviewed surfaces:

- `BreadEmergencyController`;
- `BreadFeePolicy` / `BreadFeeEscrow`;
- `BreadLaunchFactory` future config;
- `GraduationCoordinator` recovery/rescue;
- `BreadPermanentLiquidityLocker`;
- `BreadLaunchToken` supply authority.

Evidence:

- Guardian can only increase restriction and can set graduation pause true; it cannot lower restriction or clear the pause.
- unauthorized callers cannot mutate emergency state or rotate Guardian.
- Protocol Admin can perform bounded recovery/unpause and rotate Guardian; ownership renounce is disabled on the emergency/recovery owners where loss of authority would strand recovery.
- future Factory configuration cannot rewrite an existing launch snapshot (INV-062).
- admin surfaces are contract-owner compatible for multisig handoff (INV-063); this is compatibility proof, not a claim that production Safe addresses are already frozen.
- graduation rescue requires the exact `SWEPT` state, global graduation pause, and the seven-day delay; a successfully created pool cannot later be rescued.
- the permanent locker has no withdrawal or arbitrary-call function; its wiring authority can only bind the coordinator once.
- launch-token supply is minted once in the constructor to the curve and there is no later mint function.

No plausible critical/high privileged fund-loss or economics-rewrite path remains open from this Lane-2 review.

## Lane verdict

`DAY8_LANE1_LANE2_SECURITY_PASS`

No production contract code changed in Lanes 1–2. The static gate remains active so later Day-8 contract edits cannot silently introduce or move High/Medium findings.

Next: Lane 3 malicious metadata/frontend signing/release-integrity attacks, followed by failure injection/recovery and the 06I integrated capacity gate.