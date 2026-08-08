# Day 4 Implementation Plan — Mandatory Self-Review Corrections

Status: **SELF-REVIEW PASS — THESE CORRECTIONS ARE BINDING DURING EXECUTION**

Date: 2026-08-08

Applies to:

`docs/superpowers/plans/2026-08-08-day4-factory-launch-buy-snipe-emergency.md`

This self-review found no missing Day-4 subsystem, no placeholder/TBD/TODO, and no conflict with ratified Project Source Pack `v1.4-day4-design`. The following four execution details are tightened so later tasks cannot interpret the plan inconsistently.

## 1. Final constructor/dependency signatures after EmergencyController integration

Task 2 may initially implement the launch-only pair with the existing Day-3 constructor shape in order to preserve RED->GREEN slicing. Task 7 changes the final Day-4 production signatures exactly as follows.

Final `BreadBondingCurve` constructor:

```solidity
constructor(
    address pairToken_,
    address creatorFeeRecipient_,
    address factory_,
    address feePolicy_,
    address feeEscrow_,
    address emergencyController_,
    uint256 phantomQuote_,
    uint16 creatorTaxBps_,
    uint256 graduationThreshold_
)
```

Final `BreadLaunchDeployment` must therefore include:

```solidity
address emergencyController;
```

and `BreadLaunchDeployer.deployLaunch` must pass that address into each curve.

Final `BreadLaunchFactory` constructor:

```solidity
constructor(
    address owner_,
    address usdc_,
    address feePolicy_,
    address feeEscrow_,
    address emergencyController_,
    IBreadLaunchFactory.LaunchConfig memory initialConfig_,
    bytes32 stackVersion_
)
```

`BreadLaunchFactory` is `Ownable` + `ReentrancyGuard` + `IBreadLaunchFactory`. Both public launch entrypoints are `nonReentrant`.

Final `BreadEmergencyController` constructor:

```solidity
constructor(address protocolAdmin_, address guardian_) Ownable(protocolAdmin_)
```

Both inputs must be nonzero. `renounceOwnership()` must revert so a restricted stack cannot become permanently uncleareable through owner removal.

## 2. Pre-initialization opening-protection behavior

`currentSnipeTaxBps()` must not interpret a zero/uninitialized timestamp as a completed launch window. The final implementation begins with:

```solidity
if (token == address(0) || launchTimestamp == 0) revert NotInitialized();
```

Then it computes elapsed time. Tests must include a direct pre-initialization call and require `NotInitialized`.

## 3. Launch-record timestamp must equal the curve's canonical clock

Task 2 may record `block.timestamp` because the curve does not yet expose the Day-4 launch clock. Once Task 5 adds `launchTimestamp`, Factory launch-record creation must read the initialized curve value rather than maintaining a second time source:

```solidity
uint64 launchedAt = BreadBondingCurve(curve).launchTimestamp();
```

The integration suite must assert:

```solidity
assert(factory.getLaunch(token).launchTimestamp == BreadBondingCurve(curve).launchTimestamp());
```

There is one canonical launch-time value for opening protection and indexing.

## 4. Preflight/full local gate includes format check

Task 0 Step 2 must run:

```bash
pnpm validate
pnpm test
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
cd contracts && forge test -vvv
```

The same complete command family is already required again before the implementation merge and closeout.

## Self-review result

- Spec coverage: PASS — Factory/Deployer, launch economics pin, launch fee, Launch+Buy, opening protection, final-fill rounding, EmergencyController, integrated invariants, exact-head merge and fresh closeout all have explicit tasks.
- Placeholder scan: PASS — no TBD/TODO/"implement later"/"similar to" placeholders were found.
- Type/signature consistency: PASS after the four corrections above.
- Source consistency: PASS — no correction changes the ratified formula, exemption, routing, FeeEscrow authority, emergency powers, canonical-USDC boundary or Day-5 exclusions.

Execution must read this self-review together with the implementation plan. A change to any ratified economic/security decision requires a new Project Source amendment rather than editing around this plan.
