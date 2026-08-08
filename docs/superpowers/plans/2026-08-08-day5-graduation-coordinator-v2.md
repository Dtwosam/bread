# Bread Day 5 Graduation Coordinator Implementation Plan — v2 Self-Reviewed

Status: **SELF-REVIEWED EXECUTION PLAN**  
Date: 2026-08-08  
Baseline: `a40cc987a0201119f2ae21eff5a508d5e5cf8fd8`  
Approved design: `docs/superpowers/specs/2026-08-08-day5-graduation-coordinator-design.md`  
Supersedes for execution: `docs/superpowers/plans/2026-08-08-day5-graduation-coordinator.md`

## 1. Goal and immutable constraints

Implement Day 5 without reopening closed Day-1–4 economics or inventing Arc/mainnet values. The finished lifecycle is:

`Factory / Curve -> ready -> GraduationCoordinator Stage 1 -> SWEPT -> snapshotted IGraduationAdapter Stage 2 -> permanent locker -> POOL_CREATED`

Exceptional recovery is only `SWEPT -> RESCUED` after the source-controlled delay and emergency preconditions.

The implementation must prove `FULL_LAUNCH_TRADE_GRADUATE_LOCK_PASS`, `INV-050` through `INV-056`, `RETRY_CANNOT_DUPLICATE_LIQUIDITY`, all prior regressions, exact-head CI, and merged-main closeout.

No production Arc V4/V3 deployment or Bread production economics/admin addresses are activated or guessed. Controlled official-interface fixtures are test-only until authoritative Arc/DEX deployment evidence is independently verified.

## 2. Corrections made during plan self-review

The first plan draft exposed four implementation inconsistencies. They are resolved here before Solidity begins:

1. **Locker/coordinator deployment cycle:** the locker cannot require the final coordinator address in its constructor while the coordinator also requires the locker address. The locker therefore has a one-time wiring authority only. It is deployed with immutable `wiringAuthority`; `setCoordinator(address)` may execute exactly once, requires contract code, and leaves the wiring authority with no other capability. There is no owner, withdrawal, rescue, transfer, approval, arbitrary-call, or upgrade surface.
2. **Position registration authority:** adapters mint the position directly to the locker but do not register it. `IGraduationAdapter.Result` returns `positionManager` + `positionId`; the coordinator verifies the result and calls the coordinator-only `locker.lockPosition(...)` in the same reverting Stage-2 transaction. This avoids granting adapters a principal-lock administration role.
3. **FeeEscrow continuity:** Factory-created curves are dynamic contracts and the current escrow uses explicit creditor authorization. Day 5 does not broaden escrow credit authority or create another ledger. On graduation only, the curve computes and clears its already-snapshotted pending fee buckets, returns the exact protocol/creator fee amounts with the real graduation reserve, and transfers all corresponding USDC to the coordinator. The coordinator—explicitly authorized once as an escrow creditor during stack wiring—credits the existing `BreadFeeEscrow` to the curve's snapshotted protocol recipient and current allowed creator recipient before recording `SWEPT`. Ordinary pre-graduation `sweepFees()` semantics remain unchanged.
4. **Factory validation order:** disabled bootstrap configs are structurally validated without reading yet-unwired Day-5 dependencies. Enabling a config uses a separate view validation after Factory immutables/coordinator are set. No constructor-time read of an unset coordinator/adapter is allowed.

These are implementation-boundary clarifications consistent with the approved design and existing Project Sources; they do not change economics, authority, custody promises, retry model, or network activation policy.

## 3. Frozen interfaces

### `IGraduationAdapter`

```solidity
enum AdapterFamily { NONE, UNISWAP_V4, UNISWAP_V3 }

struct Seed {
    address token;
    address usdc;
    uint256 usdcAmount;
    uint256 totalTokenAmount;
    uint256 poolTokenAmount;
    bytes32 configHash;
}

struct Result {
    bytes32 poolId;
    address positionManager;
    uint256 positionId;
    uint256 usdcUsed;
    uint256 tokenUsed;
    uint256 usdcDust;
    uint256 tokenDust;
}

function family() external view returns (AdapterFamily);
function usdc() external view returns (address);
function locker() external view returns (address);
function configHash() external view returns (bytes32);
function validateSeed(Seed calldata seed) external view;
function execute(Seed calldata seed) external returns (Result memory result);
```

Adapters own DEX-specific validation/execution only. They never own Bread graduation phase state and receive no caller-selected adapter/config/recipient.

### `IGraduationCoordinator`

```solidity
enum GraduationPhase { NOT_GRADUATED, SWEPT, POOL_CREATED, RESCUED }

struct GraduationRecord {
    GraduationPhase phase;
    uint64 sweptAt;
    uint256 sweptUsdc;
    uint256 sweptTokens;
    uint256 poolTokenAmount;
    bytes32 poolId;
    address positionManager;
    uint256 positionId;
}

function factory() external view returns (address);
function usdc() external view returns (address);
function feeEscrow() external view returns (address);
function emergencyController() external view returns (address);
function locker() external view returns (address);
function sweep(address token) external;
function createPool(address token) external returns (bytes32 poolId, uint256 positionId);
function getGraduation(address token) external view returns (GraduationRecord memory);
```

## 4. Execution order — every production slice is RED -> GREEN

### Slice 1 — Interfaces and deterministic test doubles

Create:
- `contracts/src/interfaces/IGraduationAdapter.sol`
- `contracts/src/interfaces/IGraduationCoordinator.sol`
- `contracts/test/helpers/MockGraduationAdapter.sol`
- `contracts/test/helpers/MockGraduationCoordinator.sol`
- `contracts/test/BreadGraduationInterfaces.t.sol`

RED: focused compile/shape test cannot resolve the new interfaces.  
GREEN: add only the frozen interfaces and mocks. `validateSeed` remains `view`, so the mock does not pretend to persist a validation counter; execution counters cover retry/replay behavior.

Run:
```bash
cd contracts
forge test --match-path test/BreadGraduationInterfaces.t.sol -vvv
forge build
```

### Slice 2 — Permanent locker

Create:
- `contracts/src/graduation/BreadPermanentLiquidityLocker.sol`
- `contracts/test/helpers/MockPositionManagerNFT.sol`
- `contracts/test/BreadPermanentLiquidityLocker.t.sol`

Exact locker state:
```solidity
address public immutable wiringAuthority;
address public coordinator;
mapping(address => LockedPosition) private _positions;
mapping(address => uint256) public lockedTokenSupply;
```

Exact initialization rule:
```solidity
function setCoordinator(address next) external {
    if (msg.sender != wiringAuthority) revert NotWiringAuthority();
    if (coordinator != address(0)) revert AlreadyInitialized();
    if (next.code.length == 0) revert InvalidCoordinator();
    coordinator = next;
    emit CoordinatorSet(next);
}
```

After that one call, `wiringAuthority` has no callable privilege. All lock mutation functions are coordinator-only. `lockPosition` verifies live `ownerOf(positionId) == address(this)`. `lockTokenSupply` proves exact balance delta. Tests use actor helper contracts, matching current repository style; do not introduce an unpinned test framework merely for `vm.prank`.

RED/GREEN tests prove one-time wiring, outsider rejection, actual NFT custody, one position per launch, exact token locking, and that common escape calls cannot change NFT ownership or reduce locked token supply.

### Slice 3 — Factory launch snapshots and Day-5 wiring

Modify:
- `contracts/src/interfaces/IBreadLaunchFactory.sol`
- `contracts/src/factory/BreadLaunchFactory.sol`
- `contracts/src/factory/BreadLaunchDeployer.sol`
- relevant existing Day-4 fixtures/tests
Create:
- `contracts/test/BreadGraduationSnapshot.t.sol`

`LaunchConfig` adds `graduationAdapter` and `graduationConfigHash`. `LaunchRecord` adds `graduationCoordinator`, adapter, adapter family, and config hash. The economics digest adds those exact values.

Use two validation functions:
- `_validateConfigShape(...)` — pure Day-4-compatible numeric/structural bounds and disabled bootstrap acceptance.
- `_validateEnabledGraduationConfig(...)` — view check used before an enabled config is accepted/used; requires wired coordinator, contract adapter, canonical USDC, exact locker, family, and exact `configHash`.

Factory `setGraduationCoordinator` is one-time and validates the concrete coordinator getters against Factory, USDC, FeeEscrow and EmergencyController.

Every Day-4 test fixture that wants to launch after this interface change must wire controlled Day-5 mocks before enabling its launch config. Do **not** weaken production adapter requirements simply to keep old tests easy. Run full `forge test` after structural fixture changes so no closed behavior silently regresses.

### Slice 4 — Curve graduation handoff and automatic Stage-1 attempt

Modify `BreadBondingCurve.sol`; create `BreadGraduationCurveHandoff.t.sol`.

Add immutable coordinator. Add coordinator-only:

```solidity
function releaseForGraduation()
    external
    returns (
        uint256 seedUsdc,
        uint256 tokenOut,
        uint256 protocolFeeAmount,
        uint256 creatorFeeAmount
    );
```

The curve remains the only authority that computes its fee split. The release path:
1. requires exact coordinator and readiness;
2. sets `graduated = true` before external transfer;
3. computes protocol/creator amounts using the already-snapshotted fee policy and current fee buckets;
4. zeroes fee buckets and reduces `trackedQuote` by those pending fees;
5. sets `seedUsdc = trackedQuote`, `tokenOut = trackedTokens`, then zeroes both tracked reserves;
6. transfers exactly `seedUsdc + protocolFeeAmount + creatorFeeAmount` USDC and `tokenOut` tokens to the coordinator;
7. leaves unsolicited raw-balance donations behind;
8. emits the existing fee-sweep accounting event plus graduation-release event.

Ordinary `sweepFees()` keeps its current authorization, escrow-credit and `NoFeesToSweep` semantics.

At the end of a successful crossing buy, after user token/refund accounting and existing events, emit readiness and `try coordinator.sweep(token)`. Catch revert bytes and emit only `keccak256(reason)`. Never call Stage 2 from the buy.

Tests prove a reverting auto attempt does not revert the buyer, the curve stays ready/non-graduated after rollback, manual retry remains possible, and donations are excluded.

### Slice 5 — Coordinator Stage 1 and canonical escrow settlement

Create:
- `contracts/src/graduation/GraduationCoordinator.sol`
- `contracts/test/helpers/BreadDay5Fixture.sol`
- `contracts/test/BreadGraduationCoordinator.t.sol`

Coordinator constructor fixes Protocol Admin owner, Factory, USDC, FeeEscrow, EmergencyController and locker. `GRADUATION_RESCUE_DELAY = 7 days`.

Before calling the curve, `sweep(token)` validates:
- launch exists and phase is `NOT_GRADUATED`;
- graduation is not paused;
- curve identity matches launch record and is ready;
- launch coordinator is this coordinator;
- exact snapshotted adapter exists and reports the snapshotted family/config hash;
- adapter USDC and locker exactly match;
- deterministic price-preserving seed is nonzero and adapter `validateSeed` passes.

Compute:
```solidity
expectedSeedUsdc = curve.realQuoteReserve();
expectedTokens = curve.tokenReserve();
virtualQuote = expectedSeedUsdc + curve.phantomQuote();
poolTokenAmount = Math.mulDiv(expectedTokens, expectedSeedUsdc, virtualQuote);
```

Measure coordinator balances before/after `curve.releaseForGraduation()`. Require the actual USDC delta to equal `seedUsdc + protocolFeeAmount + creatorFeeAmount` and token delta to equal `tokenOut`, with returned seed values matching the preflight expectations.

Then credit the existing FeeEscrow from coordinator custody:
- approve exact `protocolFeeAmount`, `feeEscrow.credit(curve.protocolFeeRecipient(), protocolFeeAmount)`, clear allowance;
- approve exact `creatorFeeAmount`, `feeEscrow.credit(curve.creatorFeeRecipient(), creatorFeeAmount)`, clear allowance.

The coordinator must be explicitly authorized once as a FeeEscrow creditor during test/deployment wiring. No arbitrary EOA credit path is added. After fee credits, its remaining launch-attributed USDC must equal exactly `seedUsdc`.

Only then persist `SWEPT`. Any validation/release/escrow failure reverts the whole Stage-1 attempt; the crossing buy still persists because its outer auto call catches failure.

### Slice 6 — Stage 2, retry, residue, position registration, rescue

Modify coordinator; create retry/recovery tests.

`createPool(token)` requires exact `SWEPT`, unpaused graduation, unchanged snapshotted adapter identity/config, reconciled custody, and a passing repeated adapter preflight.

Before external execution, cache swept values and clear the launch's transient swept accounting fields. This is checks-effects-interactions inside one transaction; do not persist `POOL_CREATED` yet. Revert restores `SWEPT` and custody.

Lock deterministic excess launch tokens through the coordinator-only locker. Give the adapter exact allowances for only `sweptUsdc` and `poolTokenAmount`. Adapter must return all unconsumed launch-attributed residue before returning.

Require:
```solidity
result.usdcUsed + result.usdcDust == sweptUsdc;
result.tokenUsed + result.tokenDust == poolTokenAmount;
result.poolId != bytes32(0);
result.positionManager.code.length != 0;
```

The adapter must have minted the position directly to the locker. Coordinator then calls:
```solidity
locker.lockPosition(token, result.positionManager, result.positionId);
```
which verifies actual ownership. Token dust is permanently locked by coordinator; USDC dust is credited through the same FeeEscrow to the launch's snapshotted `protocolFeeRecipient`. Clear allowances.

Only after all lock/residue checks pass set terminal `POOL_CREATED` with poolId, positionManager, positionId. A second call fails before adapter interaction.

`rescueSweptGraduation` is onlyOwner, `SWEPT` only, requires `graduationPaused == true`, requires `sweptAt + 7 days`, writes terminal `RESCUED` before transfers, and is impossible after successful pool creation. Guardian has no coordinator role.

### Slice 7 — Re-verify official DEX sources, then V4 implementation

Before importing any V4 code in the implementation session, re-check official Arc documentation, official Uniswap V4 repository/interfaces/deployment registry, and Permit2. Record exact repository, 40-hex commit, path/package, license and checked date in `config/protocol/day5-dex-source-inventory.json`. Pons frozen commit stays `REFERENCE_ONLY`.

Add a fail-closed validator before DEX code. It rejects missing/floating source identities and rejects network adapter activation without authoritative deployment evidence.

Then implement against exact pinned official interfaces:
- `BreadV4GraduationGuard.sol`
- `BreadV4GraduationExecutor.sol`
- `BreadV4GraduationAdapter.sol`
- controlled official-interface V4 fixtures/tests

Guard covers token/USDC ordering, amount width, sqrt-price bounds, tick spacing, nonzero/full-range liquidity and per-tick max. Adapter config is immutable and hashed. Executor scopes approvals to one attempt. Position is minted **directly to locker**, but registration is performed by coordinator after adapter return. No production hook fee percentage is imported from Pons defaults.

With current environment evidence, Arc manifests remain V4-inactive unless the same-session official re-check independently changes that fact and compatibility tests pass.

### Slice 8 — V3 fallback, inactive by default

Re-check/pin official V3 interface source first. Implement `BreadV3GraduationAdapter` behind the same interface with deterministic TOKEN/USDC pool identity, exact immutable dependency hash, full-range position, direct mint to locker, coordinator registration, exact residue return and retry-safe transaction behavior.

Do not infer an Arc V3 deployment. Manifest activation requires independently verified official deployment evidence and compatibility status. Do not invent a production V3 post-graduation fee-routing policy.

### Slice 9 — Integration, fuzz and stateful invariants

Add:
- `BreadDay5Integration.t.sol`
- `BreadDay5Fuzz.t.sol`
- `BreadDay5Invariant.t.sol`

Prove full launch -> trade -> crossing fill -> failed auto attempt -> permissionless sweep -> failed/successful create -> permanent lock -> exact reconciliation. Include donations, both token orderings, six-decimal boundaries, zero/one/near-max valid values, emergency changes and repeated retry attempts.

Expose invariant checks for `INV-050` through `INV-056`. `RETRY_CANNOT_DUPLICATE_LIQUIDITY` must verify exactly one successful mint/position registration after arbitrary failed attempts. Run full prior `forge test`; no regression is waived.

### Slice 10 — Deployment/manifests/CI

Add Day-5 deploy, verify and smoke scripts plus a single testnet/mainnet manifest schema. Preserve current `arc-testnet.json` DEX as unresolved and `arc-mainnet.json` official values as null unless authoritative evidence changes them.

Deployment sequence is exact and breaks the locker cycle safely:
1. existing Day-4 core + disabled Factory bootstrap config;
2. permanent locker with deployment wiring authority;
3. coordinator with locker;
4. `locker.setCoordinator(coordinator)` exactly once;
5. DEX adapter/executor/guard fixtures or verified deployment dependencies;
6. Factory one-time coordinator wiring;
7. Factory deployer wiring;
8. FeeEscrow authorizes coordinator creditor;
9. validated enabled launch config with exact adapter/config hash;
10. ownership handoff and manifest emission.

Verification script proves all cross-contract identities, adapter hash/family, locker coordinator, FeeEscrow credit authority, admin/guardian ownership, and absence of silently defaulted production values. Smoke script runs launch, trade, claim-path accounting, graduation, permanent lock, reconciliation and replay rejection.

Keep all four existing CI jobs; extend their validation inputs rather than replacing them.

### Slice 11 — Security review, exact-head CI, guarded merge, merged-main closeout

Review reentrancy, approvals, raw-vs-tracked balances, adapter injection/config drift, wrong dependencies/order, retry/partial progress, donations, residue, locker capability, rescue timing, Guardian/Admin boundaries, snapshot immutability and dependency provenance.

Re-check Pons audit publication state before unrestricted release claims. Any newly published relevant finding is mapped to Bread and receives regression coverage.

Run full repository validation and exact-head GitHub CI on the candidate SHA. Merge only that exact green reviewed head with expected-head protection. From actual merged main create fresh closeout evidence and run closeout exact-head CI again.

Only after those gates may the repository record:
```text
FULL_LAUNCH_TRADE_GRADUATE_LOCK_PASS
INV_050_056_PASS
RETRY_CANNOT_DUPLICATE_LIQUIDITY
DAY_5_GRADUATION_ADAPTER_LOCK_INTEGRATED_PASS
```

Open release-only gates remain explicit rather than guessed: `BREAD_PRODUCTION_ECONOMICS_CONFIG`, `ARC_MAINNET_VALUES`, continuing Pons-audit watch, and Bread independent security review before unrestricted public-funds mainnet release.

## 5. Self-review result

- Placeholder scan: PASS — no TBD/TODO production behavior.
- Internal consistency: PASS after the four corrections in section 2.
- Scope: PASS — Day 5 only; no Day-6 implementation.
- Authority/custody: PASS — Factory registry, coordinator graduation state, FeeEscrow claims, EmergencyController restrictions, locker principal custody remain non-duplicated.
- Source compliance: PASS — no guessed Arc/mainnet/production values; V4/V3 activation is evidence-gated; Pons is reference only.
- TDD sequencing: PASS — each production money-path slice begins with focused failing behavior and is followed by adjacent/full regressions.
