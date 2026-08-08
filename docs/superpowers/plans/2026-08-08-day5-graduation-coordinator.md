# Bread Day 5 Graduation Coordinator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Bread Day 5 as a DEX-neutral, permissionless, two-stage graduation lifecycle that preserves the successful threshold-crossing trade, uses each launch's immutable adapter snapshot, permanently locks graduated liquidity, reconciles all USDC/token value, and passes `FULL_LAUNCH_TRADE_GRADUATE_LOCK_PASS`, `INV-050` through `INV-056`, and `RETRY_CANNOT_DUPLICATE_LIQUIDITY`.

**Architecture:** The existing `BreadLaunchFactory` remains the canonical launch registry, each `BreadBondingCurve` remains the pricing/accounting authority until readiness, and a single `GraduationCoordinator` owns graduation phase/custody state. Stage 1 validates the launch's immutable adapter/config and seedability before asking the curve to settle fees and release only tracked reserves into the coordinator; Stage 2 permissionlessly executes the exact snapshotted adapter, mints/places liquidity directly into a non-upgradeable permanent locker, resolves explicit residue, and becomes terminal only after lock verification. V4 and V3 remain behind `IGraduationAdapter`; no Arc network adapter is activated until official deployment evidence and compatibility checks exist.

**Tech Stack:** Solidity 0.8.26, Foundry 1.5.0, OpenZeppelin Contracts already pinned by the repository, official Uniswap interfaces/repositories re-verified and pinned at execution time before DEX-specific code is imported, Node.js 24.18.0 validation scripts, pnpm 11.15.1, canonical 6-decimal Arc ERC-20 USDC.

## Global Constraints

- Implementation base is exact verified `main` `a40cc987a0201119f2ae21eff5a508d5e5cf8fd8`; design/plan documentation lives on `design/day5-graduation-coordinator` until execution begins from a fresh implementation branch/worktree.
- Project Source pack `v1.5-day5-preflight-consolidated` is ratified in the active build conversation; closed Day-1 through Day-4 behavior must not be reopened except for the narrow interfaces needed to connect graduation.
- Canonical Bread V1 quote asset remains ERC-20 USDC with exactly 6 decimals. Native USDC is gas only.
- `readyToGraduate()` remains `!graduated && sellableTokens() == 0`; donations never become tracked graduation value.
- Graduation is permissionless. Callers choose only the launch token; they never choose adapter, DEX, pool parameters, recipients, economics, or custody destination.
- A failed automatic Stage-1 attempt must not revert the successful threshold-crossing buy (`INV-053`).
- Stage 1 may not sweep ordinary graduation reserves until the exact snapshotted adapter/config/dependency/seedability preflight passes (`INV-052`).
- Stage 2 starts only from exact recorded swept custody; a revert restores the durable `SWEPT` state and assets; retry may not duplicate liquidity or double-spend (`INV-050`, `INV-054`).
- Existing launch adapter identity/config cannot be rewritten by later Factory or stack configuration (`INV-051`, `INV-062`).
- Successful graduation accounts for every tracked reserved token and swept USDC apart from explicit residue handled in the same transaction (`INV-055`).
- Permanent lock is capability-based: no principal withdrawal, position transfer, arbitrary external call, approval escape, upgrade path, or admin rescue of successfully locked liquidity (`INV-056`).
- Use the existing Day-4 `graduationPaused`; do not add another pause role. Guardian may pause but not unpause/move funds/change economics/dependencies; Protocol Admin alone clears restrictions.
- Delayed stuck-graduation rescue is Protocol-Admin-only, `SWEPT`-only, `graduationPaused == true`, and gated by `GRADUATION_RESCUE_DELAY = 7 days`; it is impossible after `POOL_CREATED`.
- Bread production launch fee/FeePolicy/admin/recipient/Safe/stack values remain `BREAD_PRODUCTION_ECONOMICS_CONFIG` release gates. Do not guess them.
- Arc mainnet network/USDC/DEX addresses remain `ARC_MAINNET_VALUES = WAITING_FOR_OFFICIAL_PUBLICATION`. Do not populate them.
- The current Arc testnet manifest stays DEX-unresolved until independent official evidence identifies a compatible canonical deployment. Controlled official-interface fixtures are allowed for Day-5 local/test verification but never become deployment claims.
- Before DEX-specific implementation, re-check official Arc docs, official Uniswap repositories/interfaces, and official deployment registry in the same execution session. Record exact repository/commit/license evidence. Pons remains secondary reference only.
- Every task is TDD: add the failing focused test first, run it and observe the expected failure, implement the minimum production change, rerun focused tests, then all directly adjacent regressions, then commit.
- Do not begin Day-6 SDK/indexer/API/UI implementation. Day 5 only freezes canonical onchain events those later layers consume.

---

## File map

### Existing files modified

- `contracts/src/interfaces/IBreadLaunchFactory.sol` — add immutable per-launch graduation snapshot fields to `LaunchConfig`/`LaunchRecord` without changing existing launch/trade meaning.
- `contracts/src/factory/BreadLaunchFactory.sol` — one-time coordinator wiring, adapter/config validation for future launches, economics-digest extension, and launch snapshot persistence.
- `contracts/src/factory/BreadLaunchDeployer.sol` — pass the canonical coordinator to newly deployed curves.
- `contracts/src/core/BreadBondingCurve.sol` — narrow coordinator-only tracked-reserve handoff, shared fee settlement, and best-effort automatic Stage-1 trigger after a crossing buy.
- `contracts/foundry.toml` — only if exact re-verified official DEX dependencies require new remappings; do not add unpinned dependencies.
- `config/networks/arc-testnet.json` — preserve unresolved DEX status until verified; extend schema only with explicit inactive adapter metadata where validation requires it.
- `config/networks/arc-mainnet.json` — preserve all unavailable mainnet values as null/unresolved.
- `scripts/validation/validate-all.mjs` — include Day-5 source/deployment/manifest integrity validation.
- `.github/workflows/ci.yml` — add Day-5 validation/static checks without deleting the four existing required jobs.
- `docs/current-build-state.yaml` — advance only after exact tested milestones; never claim Day-5 PASS before merged-main closeout.

### New production files

- `contracts/src/interfaces/IGraduationAdapter.sol` — DEX-neutral immutable identity, preflight, and execution result contract.
- `contracts/src/interfaces/IGraduationCoordinator.sol` — phase/record/read/trigger surface.
- `contracts/src/graduation/BreadPermanentLiquidityLocker.sol` — non-upgradeable position and excess-token custody with no principal escape path.
- `contracts/src/graduation/GraduationCoordinator.sol` — sole graduation phase/custody state machine.
- `contracts/src/graduation/v4/BreadV4GraduationGuard.sol` — stateless V4 amount/order/price/tick/liquidity preflight.
- `contracts/src/graduation/v4/BreadV4GraduationExecutor.sol` — isolated V4 PositionManager/Permit2 execution and same-transaction residue return.
- `contracts/src/graduation/v4/BreadV4GraduationAdapter.sol` — immutable V4 dependency/config identity implementing `IGraduationAdapter`.
- `contracts/src/graduation/v3/BreadV3GraduationAdapter.sol` — ready but inactive V3 fallback implementing the same interface; activation remains manifest/source-gated.
- `contracts/script/DeployBreadDay5.s.sol` — deploy/wire stack from validated configuration.
- `contracts/script/VerifyBreadDay5.s.sol` — verify code/dependency/ownership/config relationships.
- `contracts/script/SmokeBreadDay5.s.sol` — launch → trade → final fill → sweep → pool → lock → reconciliation smoke.
- `config/protocol/day5-dex-source-inventory.json` — exact current official DEX source commits/licenses checked during implementation, plus frozen Pons reference identity.
- `config/protocol/day5-stack-template.json` — deployment-output schema; release values absent until supplied by validated environment/config.
- `scripts/validation/validate-day5-graduation-source-integrity.mjs` — fail closed on missing/unpinned source identity or forbidden network activation.
- `scripts/validation/validate-day5-manifests.mjs` — enforce unresolved-vs-active DEX rules and no guessed Arc mainnet fields.

### New tests/helpers

- `contracts/test/helpers/BreadDay5Fixture.sol`
- `contracts/test/helpers/MockGraduationAdapter.sol`
- `contracts/test/helpers/MockGraduationCoordinator.sol`
- `contracts/test/helpers/MockPositionManagerNFT.sol`
- `contracts/test/BreadGraduationInterfaces.t.sol`
- `contracts/test/BreadPermanentLiquidityLocker.t.sol`
- `contracts/test/BreadGraduationSnapshot.t.sol`
- `contracts/test/BreadGraduationCurveHandoff.t.sol`
- `contracts/test/BreadGraduationCoordinator.t.sol`
- `contracts/test/BreadGraduationRetry.t.sol`
- `contracts/test/BreadGraduationRecovery.t.sol`
- `contracts/test/BreadV4GraduationGuard.t.sol`
- `contracts/test/BreadV4GraduationAdapter.t.sol`
- `contracts/test/BreadV3GraduationAdapter.t.sol`
- `contracts/test/BreadDay5Integration.t.sol`
- `contracts/test/BreadDay5Fuzz.t.sol`
- `contracts/test/BreadDay5Invariant.t.sol`

---

### Task 1: Freeze the DEX-neutral interfaces and test doubles

**Files:**
- Create: `contracts/src/interfaces/IGraduationAdapter.sol`
- Create: `contracts/src/interfaces/IGraduationCoordinator.sol`
- Create: `contracts/test/helpers/MockGraduationAdapter.sol`
- Create: `contracts/test/helpers/MockGraduationCoordinator.sol`
- Create: `contracts/test/BreadGraduationInterfaces.t.sol`

**Interfaces:**
- Produces `IGraduationAdapter.AdapterFamily`, `Seed`, `Result`, `family()`, `usdc()`, `locker()`, `configHash()`, `validateSeed(Seed)`, and `execute(Seed)`.
- Produces `IGraduationCoordinator.GraduationPhase`, `GraduationRecord`, `sweep(address)`, `createPool(address)`, and `getGraduation(address)`.
- Test doubles must support deterministic configured revert points and call counters; they must never silently swallow a configured failure.

- [ ] **Step 1: Write the compile-time RED test for the exact interface shapes**

```solidity
// contracts/test/BreadGraduationInterfaces.t.sol
pragma solidity ^0.8.26;

import {IGraduationAdapter} from "../src/interfaces/IGraduationAdapter.sol";
import {IGraduationCoordinator} from "../src/interfaces/IGraduationCoordinator.sol";

contract BreadGraduationInterfacesTest {
    function testFrozenInterfaceShapesCompile() public pure {
        IGraduationAdapter.AdapterFamily family = IGraduationAdapter.AdapterFamily.UNISWAP_V4;
        IGraduationCoordinator.GraduationPhase phase = IGraduationCoordinator.GraduationPhase.SWEPT;
        assert(uint8(family) == 1);
        assert(uint8(phase) == 1);
    }
}
```

- [ ] **Step 2: Run the focused test and confirm RED because the interfaces do not exist**

```bash
cd contracts
forge test --match-path test/BreadGraduationInterfaces.t.sol -vvv
```

Expected: compile failure naming the missing `IGraduationAdapter.sol`/`IGraduationCoordinator.sol` imports.

- [ ] **Step 3: Add the exact adapter interface**

```solidity
// contracts/src/interfaces/IGraduationAdapter.sol
pragma solidity ^0.8.26;

interface IGraduationAdapter {
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
}
```

- [ ] **Step 4: Add the exact coordinator interface**

```solidity
// contracts/src/interfaces/IGraduationCoordinator.sol
pragma solidity ^0.8.26;

interface IGraduationCoordinator {
    enum GraduationPhase { NOT_GRADUATED, SWEPT, POOL_CREATED, RESCUED }

    struct GraduationRecord {
        GraduationPhase phase;
        uint64 sweptAt;
        uint256 sweptUsdc;
        uint256 sweptTokens;
        uint256 poolTokenAmount;
        bytes32 poolId;
        uint256 positionId;
    }

    function sweep(address token) external;
    function createPool(address token) external returns (bytes32 poolId, uint256 positionId);
    function getGraduation(address token) external view returns (GraduationRecord memory record);
}
```

- [ ] **Step 5: Add deterministic test doubles implementing those exact interfaces**

```solidity
// key behavior required in MockGraduationAdapter
bool public failValidation;
bool public failExecution;
uint256 public validateCalls;
uint256 public executeCalls;
IGraduationAdapter.Result public nextResult;

function validateSeed(Seed calldata) external view {
    if (failValidation) revert("MOCK_VALIDATE_REVERT");
}

function execute(Seed calldata) external returns (Result memory result) {
    if (failExecution) revert("MOCK_EXECUTE_REVERT");
    ++executeCalls;
    return nextResult;
}
```

`MockGraduationCoordinator.sweep(address)` must increment a call counter unless configured to revert. Do not add adapter selection arguments to either mock.

- [ ] **Step 6: Run the focused compile test and adjacent baseline build**

```bash
cd contracts
forge test --match-path test/BreadGraduationInterfaces.t.sol -vvv
forge build
```

Expected: both PASS.

- [ ] **Step 7: Commit Task 1**

```bash
git add contracts/src/interfaces/IGraduationAdapter.sol \
  contracts/src/interfaces/IGraduationCoordinator.sol \
  contracts/test/helpers/MockGraduationAdapter.sol \
  contracts/test/helpers/MockGraduationCoordinator.sol \
  contracts/test/BreadGraduationInterfaces.t.sol
git commit -m "feat: freeze Day 5 graduation interfaces"
```

---

### Task 2: Implement the capability-based permanent liquidity locker

**Files:**
- Create: `contracts/src/graduation/BreadPermanentLiquidityLocker.sol`
- Create: `contracts/test/helpers/MockPositionManagerNFT.sol`
- Create: `contracts/test/BreadPermanentLiquidityLocker.t.sol`

**Interfaces:**
- Constructor: `constructor(address coordinator_)`.
- `lockPosition(address token, address positionManager, uint256 positionId) external` — coordinator-only, one position per launch token, verifies `IERC721(positionManager).ownerOf(positionId) == address(this)`.
- `lockTokenSupply(address token, uint256 amount) external` — coordinator-only, exact ERC-20 pull with measured balance delta.
- `isPositionLocked(address token) external view returns (bool)`.
- `lockedPosition(address token) external view returns (address positionManager, uint256 positionId)`.
- `lockedTokenSupply(address token) external view returns (uint256)`.
- No owner, upgradeability, withdrawal, transfer, approval, arbitrary-call, rescue, delegatecall, or generic execution function.

- [ ] **Step 1: Write RED tests for authorization, actual custody, one-time registration, exact token lock, and absence of escape behavior**

```solidity
function testOnlyCoordinatorCanRegisterPosition() public {
    uint256 id = manager.mint(address(locker));
    (bool ok,) = address(locker).call(
        abi.encodeWithSelector(locker.lockPosition.selector, address(token), address(manager), id)
    );
    assert(!ok);
}

function testCoordinatorRegistersOnlyActuallyHeldPosition() public {
    uint256 id = manager.mint(address(this));
    vm.prank(COORDINATOR);
    (bool ok,) = address(locker).call(
        abi.encodeWithSelector(locker.lockPosition.selector, address(token), address(manager), id)
    );
    assert(!ok);
}

function testNoPrincipalEscapeSelectors() public view {
    assert(address(locker).code.length != 0);
    // The behavioral suite additionally proves there is no callable route that changes
    // ownership of a registered position or reduces lockedTokenSupply.
}
```

Use the repository's existing Foundry cheatcode pattern if `vm` is already supplied through local test helpers; otherwise follow the same actor-contract pattern used by Day-4 tests rather than introducing a new test framework.

- [ ] **Step 2: Run the locker test and confirm RED**

```bash
cd contracts
forge test --match-path test/BreadPermanentLiquidityLocker.t.sol -vvv
```

Expected: compile failure because `BreadPermanentLiquidityLocker` does not exist.

- [ ] **Step 3: Implement the locker with no admin surface**

```solidity
contract BreadPermanentLiquidityLocker {
    using SafeERC20 for IERC20;

    error NotCoordinator();
    error ZeroAddress();
    error PositionAlreadyLocked();
    error PositionNotHeld();
    error UnexpectedReceivedAmount(uint256 expected, uint256 actual);

    struct LockedPosition {
        address positionManager;
        uint256 positionId;
    }

    address public immutable coordinator;
    mapping(address token => LockedPosition position) private _positions;
    mapping(address token => uint256 amount) public lockedTokenSupply;

    modifier onlyCoordinator() {
        if (msg.sender != coordinator) revert NotCoordinator();
        _;
    }

    constructor(address coordinator_) {
        if (coordinator_ == address(0)) revert ZeroAddress();
        coordinator = coordinator_;
    }
```

`lockPosition` must reject a second registration for the same launch token and verify live NFT ownership before storage. `lockTokenSupply` must compare balance-before/balance-after to the requested amount before increasing `lockedTokenSupply`.

- [ ] **Step 4: Prove permanent custody behavior**

Add tests that:

```solidity
assert(manager.ownerOf(id) == address(locker));
assert(locker.isPositionLocked(address(token)));
assert(locker.lockedTokenSupply(address(token)) == amount);
```

Then attempt low-level calls for common escape selectors (`transferPosition`, `withdraw`, `rescue`, `execute`, `approvePosition`, `upgradeToAndCall`) and assert none can move the registered NFT or reduce the locked token balance. The test must compare ownership/balances before and after each attempt, not merely expect an unknown-selector revert.

- [ ] **Step 5: Run focused and baseline tests**

```bash
cd contracts
forge test --match-path test/BreadPermanentLiquidityLocker.t.sol -vvv
forge test --match-path test/BreadTrackedCurveState.t.sol -vvv
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add contracts/src/graduation/BreadPermanentLiquidityLocker.sol \
  contracts/test/helpers/MockPositionManagerNFT.sol \
  contracts/test/BreadPermanentLiquidityLocker.t.sol
git commit -m "feat: add permanent graduation locker"
```

---

### Task 3: Snapshot the canonical coordinator and adapter/config on every launch

**Files:**
- Modify: `contracts/src/interfaces/IBreadLaunchFactory.sol`
- Modify: `contracts/src/factory/BreadLaunchFactory.sol`
- Modify: `contracts/src/factory/BreadLaunchDeployer.sol`
- Modify: `contracts/test/BreadLaunchFactory.t.sol`
- Create: `contracts/test/BreadGraduationSnapshot.t.sol`

**Interfaces:**
- Extend `LaunchConfig` with `address graduationAdapter` and `bytes32 graduationConfigHash` immediately before `bool enabled`.
- Extend `LaunchRecord` with `address graduationCoordinator`, `address graduationAdapter`, `IGraduationAdapter.AdapterFamily graduationAdapterFamily`, and `bytes32 graduationConfigHash`.
- Factory adds one-time `setGraduationCoordinator(IGraduationCoordinator next)` and public `graduationCoordinator()` storage getter.
- `BreadLaunchDeployer.BreadLaunchCore` adds `address graduationCoordinator` and passes it to every new curve constructor.
- Existing launch economics digest adds coordinator, adapter, adapter family, and adapter config hash while retaining all Day-4 inputs.

- [ ] **Step 1: Write RED tests for one-time coordinator wiring and immutable per-launch adapter snapshot**

```solidity
function testLaunchSnapshotsGraduationDestination() public {
    Fixture memory f = _deployDay5FactoryFixture();
    bytes32 digest = f.factory.previewLaunchEconomics();
    IBreadLaunchFactory.LaunchParams memory p = _params(digest);
    (address token,) = f.factory.launchToken(p);
    IBreadLaunchFactory.LaunchRecord memory record = f.factory.getLaunch(token);

    assert(record.graduationCoordinator == address(f.coordinator));
    assert(record.graduationAdapter == address(f.adapter));
    assert(record.graduationConfigHash == f.adapter.configHash());
    assert(record.graduationAdapterFamily == IGraduationAdapter.AdapterFamily.UNISWAP_V4);
}
```

Add a second launch after changing future config to a second mock adapter and assert the first launch record remains unchanged.

- [ ] **Step 2: Run the snapshot test and confirm RED**

```bash
cd contracts
forge test --match-path test/BreadGraduationSnapshot.t.sol -vvv
```

Expected: compile/behavior failure because the snapshot fields/wiring do not exist.

- [ ] **Step 3: Extend the Factory structs and digest without weakening existing validation**

Use this exact structural intent:

```solidity
struct LaunchConfig {
    uint256 supply;
    uint256 phantomQuote;
    uint256 graduationThreshold;
    uint256 launchFeeUsdc;
    address graduationAdapter;
    bytes32 graduationConfigHash;
    bool enabled;
}
```

A config with `enabled == true` must require:

```solidity
config.graduationAdapter.code.length != 0
IGraduationAdapter(config.graduationAdapter).usdc() == usdc
IGraduationAdapter(config.graduationAdapter).configHash() == config.graduationConfigHash
IGraduationAdapter(config.graduationAdapter).locker() != address(0)
```

The disabled bootstrap config may keep adapter/hash zero so the Factory can be deployed before coordinator/adapter wiring. Enabling cannot occur until both canonical coordinator and a valid adapter are wired.

- [ ] **Step 4: Add one-time coordinator wiring**

```solidity
error GraduationCoordinatorAlreadySet();
error InvalidGraduationCoordinator();

IGraduationCoordinator public graduationCoordinator;

function setGraduationCoordinator(IGraduationCoordinator next) external onlyOwner {
    if (address(graduationCoordinator) != address(0)) revert GraduationCoordinatorAlreadySet();
    if (address(next).code.length == 0) revert InvalidGraduationCoordinator();
    graduationCoordinator = next;
    emit GraduationCoordinatorSet(address(next));
}
```

The final implementation must also verify coordinator `factory`, `usdc`, `emergencyController`, and locker identities through read-only getters added to the concrete coordinator in Task 5 before a launch config can be enabled. Until Task 5 lands, use `MockGraduationCoordinator` with matching getters in this task's tests.

- [ ] **Step 5: Propagate the coordinator into new curves**

Add `graduationCoordinator` to `BreadLaunchDeployer.BreadLaunchCore`, set it in `BreadLaunchFactory._buildDeployment`, and extend the `BreadBondingCurve` constructor call. Do not change metadata bounds, canonical USDC, FeePolicy, FeeEscrow, emergency controller, phantom quote, creator tax, threshold, supply, or Launch+Buy behavior.

- [ ] **Step 6: Extend the economics digest and launch record**

Add these fields to `EconomicsDigestInput`:

```solidity
address graduationCoordinator;
address graduationAdapter;
uint8 graduationAdapterFamily;
bytes32 graduationConfigHash;
```

Populate them from the exact current wired coordinator and current launch config. `_recordLaunch` must store the same values in `LaunchRecord` so future config changes cannot alter an existing launch.

- [ ] **Step 7: Update existing Day-4 tests only for the new disabled/bootstrap fields**

Every existing `LaunchConfig({...})` literal must explicitly use:

```solidity
graduationAdapter: address(0),
graduationConfigHash: bytes32(0),
enabled: false
```

before the Day-5 fixture wires a valid coordinator/adapter and enables launches. Do not alter Day-4 constants or expected economic behavior.

- [ ] **Step 8: Run focused and Day-4 Factory/Launch+Buy regressions**

```bash
cd contracts
forge test --match-path test/BreadGraduationSnapshot.t.sol -vvv
forge test --match-path test/BreadLaunchFactory.t.sol -vvv
forge test --match-path test/BreadLaunchAndBuy.t.sol -vvv
forge test --match-path test/BreadDay4Integration.t.sol -vvv
```

Expected: PASS.

- [ ] **Step 9: Commit Task 3**

```bash
git add contracts/src/interfaces/IBreadLaunchFactory.sol \
  contracts/src/factory/BreadLaunchFactory.sol \
  contracts/src/factory/BreadLaunchDeployer.sol \
  contracts/test/BreadLaunchFactory.t.sol \
  contracts/test/BreadGraduationSnapshot.t.sol \
  contracts/test/BreadLaunchAndBuy.t.sol \
  contracts/test/BreadDay4Integration.t.sol \
  contracts/test/helpers/BreadDay4Fixture.sol
git commit -m "feat: snapshot graduation destination per launch"
```

---

### Task 4: Add the curve's coordinator-only graduation handoff and best-effort auto trigger

**Files:**
- Modify: `contracts/src/core/BreadBondingCurve.sol`
- Modify: `contracts/src/factory/BreadLaunchDeployer.sol`
- Create: `contracts/test/BreadGraduationCurveHandoff.t.sol`
- Modify: `contracts/test/BreadFinalBuyInvariant.t.sol`

**Interfaces:**
- Curve immutable getter: `graduationCoordinator()`.
- New curve function: `releaseForGraduation() external returns (uint256 usdcOut, uint256 tokenOut)`.
- New events:
  - `GraduationReady(address indexed token, address indexed curve, address indexed coordinator)`.
  - `GraduationAutoAttemptFailed(address indexed token, bytes32 reasonHash)`.
  - `CurveGraduationReleased(address indexed coordinator, uint256 usdcOut, uint256 tokenOut)`.
- Existing `sweepFees()` behavior is refactored through one private/internal fee-settlement function so graduation does not create a second fee ledger.

- [ ] **Step 1: Write RED tests for coordinator-only release, tracked-donation exclusion, and failed auto-graduation persistence**

The crossing-buy test must capture user token balance and curve tracked state before/after a coordinator configured to revert:

```solidity
uint256 beforeUser = token.balanceOf(buyer);
coordinator.setFailSweep(true);
_executeFinalFill();
assert(token.balanceOf(buyer) > beforeUser);
assert(curve.readyToGraduate());
assert(!curve.graduated());
assert(coordinator.sweepCalls() == 1);
```

A direct USDC/token donation must remain outside `usdcOut`/`tokenOut` from `releaseForGraduation()`.

- [ ] **Step 2: Run the focused test and confirm RED**

```bash
cd contracts
forge test --match-path test/BreadGraduationCurveHandoff.t.sol -vvv
```

- [ ] **Step 3: Refactor current fee settlement without changing arithmetic**

Move the current `sweepFees()` calculations into one internal routine equivalent to:

```solidity
function _settlePendingFees() private returns (uint256 protocolAmount, uint256 creatorAmount, uint256 pendingTax) {
    uint256 pendingBaseFee = quoteFeeBalance;
    pendingTax = creatorTaxBalance;
    uint256 totalPending = pendingBaseFee + pendingTax;
    if (totalPending == 0) return (0, 0, 0);

    protocolAmount = pendingBaseFee * protocolFeeShareBps / BASIS_POINTS;
    creatorAmount = pendingBaseFee - protocolAmount + pendingTax;
    quoteFeeBalance = 0;
    creatorTaxBalance = 0;
    trackedQuote -= totalPending;
    _creditPendingFees(protocolAmount, creatorAmount);
    emit FeesSwept(protocolAmount, creatorAmount, pendingTax);
}
```

The existing external `sweepFees()` must preserve its authorization and `NoFeesToSweep` behavior by checking pending balances before invoking the shared routine.

- [ ] **Step 4: Implement coordinator-only release with state closure before external transfers**

```solidity
function releaseForGraduation() external returns (uint256 usdcOut, uint256 tokenOut) {
    if (msg.sender != graduationCoordinator) revert UnauthorizedGraduationCoordinator();
    if (!readyToGraduate()) revert NotReadyToGraduate();

    graduated = true;
    _settlePendingFees();

    usdcOut = trackedQuote;
    tokenOut = trackedTokens;
    trackedQuote = 0;
    trackedTokens = 0;

    if (usdcOut != 0) IERC20(pairToken).safeTransfer(msg.sender, usdcOut);
    if (tokenOut != 0) IERC20(token).safeTransfer(msg.sender, tokenOut);
    emit CurveGraduationReleased(msg.sender, usdcOut, tokenOut);
}
```

Do not transfer raw balances. The remaining raw balance after release, if any, is unsolicited donation and is not graduation value.

- [ ] **Step 5: Trigger best-effort Stage 1 only after the buy's successful user/refund/event path**

At the end of `_buy`, after `CurveBuy` is emitted:

```solidity
if (readyToGraduate()) {
    emit GraduationReady(token, address(this), graduationCoordinator);
    try IGraduationCoordinator(graduationCoordinator).sweep(token) {
        // coordinator emits the committed Stage-1 event
    } catch (bytes memory reason) {
        emit GraduationAutoAttemptFailed(token, keccak256(reason));
    }
}
```

Do not call `createPool` from the crossing buy. Do not bubble the Stage-1 failure.

- [ ] **Step 6: Run focused final-fill/trading/fee regressions**

```bash
cd contracts
forge test --match-path test/BreadGraduationCurveHandoff.t.sol -vvv
forge test --match-path test/BreadFinalBuyInvariant.t.sol -vvv
forge test --match-path test/BreadOpeningFinalFill.t.sol -vvv
forge test --match-path test/BreadTradingFeeEscrowIntegration.t.sol -vvv
forge test --match-path test/BreadBondingCurveTrading.t.sol -vvv
```

Expected: PASS with all Day-3/4 rounding and fee behavior unchanged.

- [ ] **Step 7: Commit Task 4**

```bash
git add contracts/src/core/BreadBondingCurve.sol \
  contracts/src/factory/BreadLaunchDeployer.sol \
  contracts/test/BreadGraduationCurveHandoff.t.sol \
  contracts/test/BreadFinalBuyInvariant.t.sol
git commit -m "feat: add curve graduation handoff"
```

---

### Task 5: Implement `GraduationCoordinator` Stage 1 validation and exact sweep

**Files:**
- Create: `contracts/src/graduation/GraduationCoordinator.sol`
- Create: `contracts/test/helpers/BreadDay5Fixture.sol`
- Create: `contracts/test/BreadGraduationCoordinator.t.sol`
- Modify: `contracts/src/factory/BreadLaunchFactory.sol`

**Interfaces:**
- Constructor:
  `constructor(address protocolAdmin_, address factory_, address usdc_, address feeEscrow_, address emergencyController_, BreadPermanentLiquidityLocker locker_)`.
- Immutable getters: `factory()`, `usdc()`, `feeEscrow()`, `emergencyController()`, `locker()`.
- Constant: `GRADUATION_RESCUE_DELAY = 7 days`.
- Stage 1: `sweep(address token) external nonReentrant`.
- Read: `getGraduation(address token)`.
- The coordinator owns phase/custody state; Factory owns launch snapshot; adapters own no Bread phase ledger.

- [ ] **Step 1: Write RED Stage-1 tests**

Cover all of these explicit cases:

```text
unknown launch -> revert
not ready -> revert
graduationPaused -> revert before balances/phase change
wrong/mutated adapter configHash -> revert before curve release
adapter USDC mismatch -> revert before curve release
adapter locker mismatch -> revert before curve release
adapter validateSeed revert -> revert before curve release
successful sweep -> exact measured USDC/tokens + phase SWEPT
second sweep -> revert with no asset movement
donation to curve -> not included in recorded swept amounts
future Factory config change -> old launch still validates old adapter snapshot
```

- [ ] **Step 2: Run the Stage-1 suite and confirm RED**

```bash
cd contracts
forge test --match-path test/BreadGraduationCoordinator.t.sol -vvv
```

- [ ] **Step 3: Implement deterministic price-preserving seed math before sweep**

For the ready curve:

```solidity
uint256 expectedUsdc = curve.realQuoteReserve();
uint256 expectedTokens = curve.tokenReserve();
uint256 virtualQuote = expectedUsdc + curve.phantomQuote();
uint256 poolTokenAmount = Math.mulDiv(expectedTokens, expectedUsdc, virtualQuote);
if (expectedUsdc == 0 || expectedTokens == 0 || poolTokenAmount == 0) revert GraduationSeedNotViable();
```

Build `IGraduationAdapter.Seed` from the launch record's immutable adapter/config and call `validateSeed` before any curve handoff.

- [ ] **Step 4: Validate the exact immutable destination before sweep**

Require all of the following against `IBreadLaunchFactory.getLaunch(token)`:

```solidity
record.token == token
record.curve != address(0)
record.graduationCoordinator == address(this)
record.graduationAdapter.code.length != 0
adapter.family() == record.graduationAdapterFamily
adapter.usdc() == usdc
adapter.locker() == address(locker)
adapter.configHash() == record.graduationConfigHash
```

No caller-supplied dependency or config bytes are accepted.

- [ ] **Step 5: Perform exact measured custody transfer and only then commit `SWEPT`**

```solidity
uint256 usdcBefore = IERC20(usdc).balanceOf(address(this));
uint256 tokenBefore = IERC20(token).balanceOf(address(this));
(uint256 nominalUsdc, uint256 nominalTokens) = curve.releaseForGraduation();
uint256 receivedUsdc = IERC20(usdc).balanceOf(address(this)) - usdcBefore;
uint256 receivedTokens = IERC20(token).balanceOf(address(this)) - tokenBefore;
if (receivedUsdc != nominalUsdc || receivedTokens != nominalTokens) revert GraduationTransferMismatch();
if (receivedUsdc != expectedUsdc || receivedTokens != expectedTokens) revert GraduationTransferMismatch();

_graduations[token] = GraduationRecord({
    phase: GraduationPhase.SWEPT,
    sweptAt: uint64(block.timestamp),
    sweptUsdc: receivedUsdc,
    sweptTokens: receivedTokens,
    poolTokenAmount: poolTokenAmount,
    poolId: bytes32(0),
    positionId: 0
});
```

Emit `GraduationSwept(token, record.graduationAdapter, receivedUsdc, receivedTokens, uint64(block.timestamp))` after storage commits.

- [ ] **Step 6: Finish Factory coordinator validation against the concrete coordinator getters**

`setGraduationCoordinator` and launch enablement must now assert:

```solidity
next.factory() == address(this)
next.usdc() == usdc
next.feeEscrow() == feeEscrow
next.emergencyController() == address(emergencyController)
```

and that the coordinator locker matches the current adapter locker when a config is enabled.

- [ ] **Step 7: Run focused, snapshot, emergency and donation regressions**

```bash
cd contracts
forge test --match-path test/BreadGraduationCoordinator.t.sol -vvv
forge test --match-path test/BreadGraduationSnapshot.t.sol -vvv
forge test --match-path test/BreadEmergencyIntegration.t.sol -vvv
forge test --match-path test/BreadTrackedCurveState.t.sol -vvv
```

Expected: PASS.

- [ ] **Step 8: Commit Task 5**

```bash
git add contracts/src/graduation/GraduationCoordinator.sol \
  contracts/src/factory/BreadLaunchFactory.sol \
  contracts/test/helpers/BreadDay5Fixture.sol \
  contracts/test/BreadGraduationCoordinator.t.sol
git commit -m "feat: add validated graduation sweep"
```

---

### Task 6: Implement Stage 2, explicit residue accounting, retry safety, and delayed recovery

**Files:**
- Modify: `contracts/src/graduation/GraduationCoordinator.sol`
- Create: `contracts/test/BreadGraduationRetry.t.sol`
- Create: `contracts/test/BreadGraduationRecovery.t.sol`
- Modify: `contracts/test/BreadPermanentLiquidityLocker.t.sol`

**Interfaces:**
- `createPool(address token) external nonReentrant returns (bytes32 poolId, uint256 positionId)`.
- `rescueSweptGraduation(address token, address recipient) external onlyOwner nonReentrant`.
- Events with exact Solidity types:

```solidity
event GraduationSwept(address indexed token, address indexed adapter, uint256 usdcAmount, uint256 tokenAmount, uint64 sweptAt);
event GraduationCompleted(address indexed token, address indexed adapter, bytes32 indexed poolId, uint256 positionId, uint256 usdcUsed, uint256 tokenUsed, uint256 tokenLocked, uint256 usdcDust);
event GraduationRescued(address indexed token, address indexed recipient, uint256 usdcAmount, uint256 tokenAmount);
event GraduationTokenResidueLocked(address indexed token, uint256 amount);
event GraduationUsdcDustCredited(address indexed token, address indexed recipient, uint256 amount);
```

- [ ] **Step 1: Write RED retry tests with failure at every meaningful adapter stage**

Use `MockGraduationAdapter` modes for validation revert, execution-before-consumption revert, execution-after-simulated-internal-progress revert, wrong result accounting, and success. For each execution revert assert:

```solidity
assert(uint8(coordinator.getGraduation(token).phase) == uint8(IGraduationCoordinator.GraduationPhase.SWEPT));
assert(usdc.balanceOf(address(coordinator)) == sweptUsdc);
assert(tokenContract.balanceOf(address(coordinator)) == sweptTokens);
assert(adapter.executeCalls() == expectedRevertedCounterValue);
```

Then disable the failure and retry once; assert exactly one locker position registration and exactly one terminal pool ID.

- [ ] **Step 2: Run retry/recovery suites and confirm RED**

```bash
cd contracts
forge test --match-path test/BreadGraduationRetry.t.sol -vvv
forge test --match-path test/BreadGraduationRecovery.t.sol -vvv
```

- [ ] **Step 3: Implement Stage-2 CEI without a durable `IN_PROGRESS` state**

Before the adapter external call:

```solidity
GraduationRecord storage g = _graduations[token];
if (g.phase != GraduationPhase.SWEPT) revert WrongGraduationPhase();
if (emergencyController.graduationPaused()) revert GraduationPaused();

IBreadLaunchFactory.LaunchRecord memory launch = launchFactory.getLaunch(token);
IGraduationAdapter adapter = _validatedAdapter(launch);
IGraduationAdapter.Seed memory seed = _seedFor(token, launch, g);
adapter.validateSeed(seed);

uint256 sweptUsdc = g.sweptUsdc;
uint256 sweptTokens = g.sweptTokens;
uint256 poolTokenAmount = g.poolTokenAmount;
uint256 excessTokenAmount = sweptTokens - poolTokenAmount;

g.sweptUsdc = 0;
g.sweptTokens = 0;
g.poolTokenAmount = 0;
```

Do **not** set `POOL_CREATED` yet. Any later revert restores the `SWEPT` storage automatically.

- [ ] **Step 4: Lock the deterministic excess token supply inside the same reverting Stage-2 transaction**

```solidity
if (excessTokenAmount != 0) {
    IERC20(token).forceApprove(address(locker), excessTokenAmount);
    locker.lockTokenSupply(token, excessTokenAmount);
    IERC20(token).forceApprove(address(locker), 0);
    emit GraduationTokenResidueLocked(token, excessTokenAmount);
}
```

Because the adapter call follows in the same transaction, an adapter revert rolls this lock attempt back too.

- [ ] **Step 5: Fund only the exact seed and execute the exact adapter**

```solidity
IERC20(usdc).forceApprove(address(adapter), sweptUsdc);
IERC20(token).forceApprove(address(adapter), poolTokenAmount);
IGraduationAdapter.Result memory result = adapter.execute(seed);
IERC20(usdc).forceApprove(address(adapter), 0);
IERC20(token).forceApprove(address(adapter), 0);
```

The adapter implementation must pull at most the exact approved amounts and return all unconsumed launch-attributed residue to the coordinator before returning.

- [ ] **Step 6: Reconcile adapter result against measured balances and resolve residue in the same transaction**

Require:

```solidity
result.usdcUsed + result.usdcDust == sweptUsdc
result.tokenUsed + result.tokenDust == poolTokenAmount
result.poolId != bytes32(0)
locker.isPositionLocked(token)
```

If `result.tokenDust != 0`, lock that token dust through the same locker and add it to the `GraduationTokenResidueLocked` total. If `result.usdcDust != 0`, approve exactly that amount to the existing `BreadFeeEscrow`, credit the launch's snapshotted `protocolFeeRecipient`, clear allowance, and emit `GraduationUsdcDustCredited`.

Read the snapshotted protocol recipient from the launch curve's immutable `protocolFeeRecipient()`; do not use the current mutable global FeePolicy.

- [ ] **Step 7: Persist terminal success only after lock and residue reconciliation**

```solidity
g.phase = GraduationPhase.POOL_CREATED;
g.poolId = result.poolId;
g.positionId = result.positionId;
g.sweptAt = 0;
emit GraduationCompleted(
    token,
    launch.graduationAdapter,
    result.poolId,
    result.positionId,
    result.usdcUsed,
    result.tokenUsed,
    excessTokenAmount + result.tokenDust,
    result.usdcDust
);
```

A second `createPool(token)` must fail on phase before allowance/transfer/external adapter call.

- [ ] **Step 8: Implement the exact delayed rescue boundary**

```solidity
function rescueSweptGraduation(address token, address recipient) external onlyOwner nonReentrant {
    if (recipient == address(0)) revert ZeroAddress();
    if (!emergencyController.graduationPaused()) revert GraduationMustBePausedForRescue();
    GraduationRecord storage g = _graduations[token];
    if (g.phase != GraduationPhase.SWEPT) revert WrongGraduationPhase();
    uint256 availableAt = uint256(g.sweptAt) + GRADUATION_RESCUE_DELAY;
    if (block.timestamp < availableAt) revert GraduationRescueTooEarly(availableAt);

    uint256 usdcAmount = g.sweptUsdc;
    uint256 tokenAmount = g.sweptTokens;
    g.phase = GraduationPhase.RESCUED;
    g.sweptAt = 0;
    g.sweptUsdc = 0;
    g.sweptTokens = 0;
    g.poolTokenAmount = 0;

    if (usdcAmount != 0) IERC20(usdc).safeTransfer(recipient, usdcAmount);
    if (tokenAmount != 0) IERC20(token).safeTransfer(recipient, tokenAmount);
    emit GraduationRescued(token, recipient, usdcAmount, tokenAmount);
}
```

No rescue exists from `POOL_CREATED` and Guardian has no coordinator role.

- [ ] **Step 9: Run focused retry/recovery/locker/emergency tests**

```bash
cd contracts
forge test --match-path test/BreadGraduationRetry.t.sol -vvv
forge test --match-path test/BreadGraduationRecovery.t.sol -vvv
forge test --match-path test/BreadPermanentLiquidityLocker.t.sol -vvv
forge test --match-path test/BreadEmergencyController.t.sol -vvv
forge test --match-path test/BreadEmergencyIntegration.t.sol -vvv
```

Expected: PASS.

- [ ] **Step 10: Commit Task 6**

```bash
git add contracts/src/graduation/GraduationCoordinator.sol \
  contracts/test/BreadGraduationRetry.t.sol \
  contracts/test/BreadGraduationRecovery.t.sol \
  contracts/test/BreadPermanentLiquidityLocker.t.sol
git commit -m "feat: add retry-safe graduation completion"
```

---

### Task 7: Re-verify official DEX sources, then implement the inactive V4 lane against controlled official-interface fixtures

**Files:**
- Create: `config/protocol/day5-dex-source-inventory.json`
- Create: `scripts/validation/validate-day5-graduation-source-integrity.mjs`
- Modify: `scripts/validation/validate-all.mjs`
- Modify: `contracts/foundry.toml` only after exact dependency pins are recorded
- Create: `contracts/src/graduation/v4/BreadV4GraduationGuard.sol`
- Create: `contracts/src/graduation/v4/BreadV4GraduationExecutor.sol`
- Create: `contracts/src/graduation/v4/BreadV4GraduationAdapter.sol`
- Create: `contracts/test/BreadV4GraduationGuard.t.sol`
- Create: `contracts/test/BreadV4GraduationAdapter.t.sol`
- Add controlled official-interface V4 fixtures under `contracts/test/helpers/v4/`

**Interfaces:**
- V4 adapter implements `IGraduationAdapter` exactly.
- Immutable configuration includes coordinator, canonical USDC, locker, PoolManager, PositionManager, Permit2, hook address, pool fee, and tick spacing.
- `configHash()` is `keccak256(abi.encode(...all immutable dependency/config fields in a documented fixed order...))`.
- No Arc testnet/mainnet manifest activation is allowed in this task unless the same-session authoritative verification independently resolves a deployment and all compatibility tests pass. Given the current verified state, the expected manifest outcome remains unresolved/inactive.

- [ ] **Step 1: Re-check primary sources before importing any DEX code**

In the implementation session, verify all of these directly from official sources:

```text
Arc contract-address documentation
Arc RPC/network documentation
Uniswap V4 official repository/interfaces
Uniswap V4 official deployment registry
Permit2 official repository/deployment documentation
```

Record exact repository URLs, 40-hex commit SHAs, license identifiers, checked date, and classification (`PRIMARY_OFFICIAL_INTERFACE`, `DEPLOYMENT_EVIDENCE`, or `REFERENCE_ONLY`) in `config/protocol/day5-dex-source-inventory.json`. Keep the frozen Pons commit `d5491e20be56051a68abf47136f6890c3ce3ff7d` recorded as `REFERENCE_ONLY`.

If an official repository commit or license cannot be verified, stop this task before copying/importing that component. Do not substitute a secondary launchpad source.

- [ ] **Step 2: Write and run a failing source-integrity validator before adding DEX code**

The validator must reject:

```js
if (!/^[0-9a-f]{40}$/i.test(entry.commit)) throw new Error("Day-5 DEX source commit must be exact");
if (!entry.repository.startsWith("https://github.com/")) throw new Error("Day-5 DEX source repository missing");
if (!entry.license) throw new Error("Day-5 DEX source license missing");
```

and must reject any `arc-mainnet.json` DEX activation while its required fields are null.

Run:

```bash
node scripts/validation/validate-day5-graduation-source-integrity.mjs
```

Expected before inventory is complete: FAIL. After exact official evidence is recorded: PASS.

- [ ] **Step 3: Pin only the exact verified official dependencies**

Read the recorded SHAs from the inventory and use those exact commits in the repository's Foundry dependency mechanism. Do not use a floating branch, `latest`, unversioned package, or copied source without commit/license provenance. After pinning, ensure `contracts/foundry.toml` contains explicit remappings needed by the imported official interfaces and run:

```bash
cd contracts
forge build
```

Expected: PASS from a clean checkout with the dependency pins reproducible.

- [ ] **Step 4: Write RED V4 guard tests for ordering, amount bounds, sqrt price, full-range liquidity, and tick overflow**

At minimum test both token/USDC address orderings and:

```text
zero USDC -> reject
zero pool token amount -> reject
amount above downstream signed settlement bound -> reject
invalid tick spacing -> reject
sqrt price at/outside core bounds -> reject
zero liquidity -> reject
liquidity above per-tick maximum -> reject
valid six-decimal-USDC seed -> pass
```

Run:

```bash
cd contracts
forge test --match-path test/BreadV4GraduationGuard.t.sol -vvv
```

Expected: RED before guard exists.

- [ ] **Step 5: Implement the stateless guard from the verified official interfaces/math**

The guard must sort `token`/`usdc` exactly as the selected V4 `PoolKey` does and derive full-range usable ticks from the configured tick spacing. Keep the Pons guard only as a differential/reference test source; do not inherit Pons economics or native-quote assumptions.

- [ ] **Step 6: Write RED adapter/executor tests with controlled official-interface fixtures**

The fixtures must emulate only the official call shapes required by Bread and expose counters for:

```text
initialize attempts
position mint attempts
position owner
amount0/amount1 consumed
configured revert before initialize
configured revert after initialize call but before mint completion (entire transaction reverts)
configured returned residue
```

Assert the adapter is coordinator-only for `execute`, validates immutable dependency identity, creates exactly one deterministic pool identity, and causes the position to be owned by `BreadPermanentLiquidityLocker` directly.

- [ ] **Step 7: Implement V4 executor and adapter with exact approvals and same-transaction residue return**

The adapter must pull only `seed.usdcAmount` and `seed.poolTokenAmount` from the coordinator under exact allowances. The executor must approve Permit2/PositionManager only for the current attempt, clear temporary allowances where the official flow permits, mint directly to the locker, and return any residual launch token/USDC to the coordinator before returning `Result`.

`Result` must satisfy:

```solidity
result.usdcUsed + result.usdcDust == seed.usdcAmount;
result.tokenUsed + result.tokenDust == seed.poolTokenAmount;
result.poolId == deterministicPoolIdFromImmutableConfigAndToken;
```

After mint, call `locker.lockPosition(seed.token, address(positionManager), result.positionId)` before reporting success.

- [ ] **Step 8: Keep the V4 hook activation source-gated**

The adapter config includes an immutable hook address because PoolKey identity must be frozen. While no verified canonical Arc V4 deployment/hook configuration exists, tests use either the official zero-hooks form or a controlled hook fixture that implements the verified official hook shape. Do not introduce a production fee-bearing Bread hook percentage from the Pons 1% source default. A future network activation that requires a Bread fee-bearing hook must use the then-ratified `BREAD_PRODUCTION_ECONOMICS_CONFIG` and official deployment evidence.

- [ ] **Step 9: Run V4 focused and retry tests**

```bash
cd contracts
forge test --match-path test/BreadV4GraduationGuard.t.sol -vvv
forge test --match-path test/BreadV4GraduationAdapter.t.sol -vvv
forge test --match-path test/BreadGraduationRetry.t.sol -vvv
```

Expected: PASS; failed fixture calls leave coordinator `SWEPT`, then a later retry creates only one locked position.

- [ ] **Step 10: Commit Task 7**

```bash
git add config/protocol/day5-dex-source-inventory.json \
  scripts/validation/validate-day5-graduation-source-integrity.mjs \
  scripts/validation/validate-all.mjs \
  contracts/foundry.toml \
  contracts/src/graduation/v4 \
  contracts/test/helpers/v4 \
  contracts/test/BreadV4GraduationGuard.t.sol \
  contracts/test/BreadV4GraduationAdapter.t.sol
git commit -m "feat: add source-pinned V4 graduation lane"
```

---

### Task 8: Implement the ready-but-inactive V3 fallback behind the same interface

**Files:**
- Create: `contracts/src/graduation/v3/BreadV3GraduationAdapter.sol`
- Create: `contracts/test/helpers/v3/MockV3Factory.sol`
- Create: `contracts/test/helpers/v3/MockV3PositionManager.sol`
- Create: `contracts/test/BreadV3GraduationAdapter.t.sol`
- Modify: `config/protocol/day5-dex-source-inventory.json`
- Modify: `scripts/validation/validate-day5-graduation-source-integrity.mjs`

**Interfaces:**
- Implements the same `IGraduationAdapter` `Seed`/`Result` contract.
- Immutable config includes coordinator, USDC, locker, V3 factory, NonfungiblePositionManager, fee tier, and exact dependency/config hash.
- Network manifests keep V3 inactive unless authoritative Arc deployment evidence and compatibility/security checks exist.
- This task does not invent a production V3 post-graduation fee-distribution policy. Principal lock is implemented; any separable fee-collection activation remains a later source/config gate.

- [ ] **Step 1: Re-verify official V3 interface source and record exact commit/license before import**

Add the official V3 repository/interface evidence to `day5-dex-source-inventory.json`; validator rules are the same exact-commit/license rules as Task 7. Do not infer Arc deployment from Ethereum or another chain.

- [ ] **Step 2: Write RED V3 adapter tests**

Cover:

```text
wrong coordinator -> reject
wrong USDC -> validateSeed rejects
config hash mismatch -> coordinator rejects before sweep
pool already exists at deterministic pair/fee -> adapter resumes/uses that exact pool only
create/mint revert -> whole Stage-2 transaction reverts
success -> one position owned/registered by permanent locker
retry after success -> coordinator phase blocks before adapter call
residue -> returned and reconciled by coordinator
```

Run:

```bash
cd contracts
forge test --match-path test/BreadV3GraduationAdapter.t.sol -vvv
```

Expected: RED before implementation.

- [ ] **Step 3: Implement V3 deterministic pool/mint logic against the exact official interface shape**

The adapter must derive token ordering from addresses, use the immutable fee tier, create/initialize only the exact TOKEN/USDC pool, mint the intended full-range position using ticks valid for the fee tier, mint the NFT directly to the permanent locker, register it, and return exact used/residual amounts. It must never expose a caller-supplied factory/router/recipient/fee tier.

- [ ] **Step 4: Prove V3 remains inactive in Bread manifests**

The Day-5 manifest validator must reject `dex.type == "UNISWAP_V3"` unless all required V3 dependency addresses are non-null, source inventory is exact, and the manifest explicitly records `compatibilityStatus: "VERIFIED"`. With current evidence, `arc-testnet.json` and `arc-mainnet.json` remain unresolved and must PASS only in inactive form.

- [ ] **Step 5: Run V3 and shared interface/retry tests**

```bash
cd contracts
forge test --match-path test/BreadV3GraduationAdapter.t.sol -vvv
forge test --match-path test/BreadGraduationInterfaces.t.sol -vvv
forge test --match-path test/BreadGraduationRetry.t.sol -vvv
```

Expected: PASS.

- [ ] **Step 6: Commit Task 8**

```bash
git add contracts/src/graduation/v3/BreadV3GraduationAdapter.sol \
  contracts/test/helpers/v3 \
  contracts/test/BreadV3GraduationAdapter.t.sol \
  config/protocol/day5-dex-source-inventory.json \
  scripts/validation/validate-day5-graduation-source-integrity.mjs
git commit -m "feat: add inactive V3 graduation fallback"
```

---

### Task 9: Prove the complete lifecycle, fuzz boundaries, and stateful invariants

**Files:**
- Create: `contracts/test/BreadDay5Integration.t.sol`
- Create: `contracts/test/BreadDay5Fuzz.t.sol`
- Create: `contracts/test/BreadDay5Invariant.t.sol`
- Modify: `contracts/test/helpers/BreadDay5Fixture.sol`

**Interfaces:**
- Integration fixture deploys one complete non-production Day-5 stack with `MockUSDC6`, existing FeePolicy/FeeEscrow/EmergencyController/Factory/Deployer, coordinator, permanent locker, and controlled adapter implementing the official-interface-compatible path.
- Handler actions cover launch, ordinary buys, exact final fill, donations, pause/unpause, failed auto sweep, manual sweep, failed/successful Stage 2, and rescue preconditions.

- [ ] **Step 1: Write RED full-lifecycle test for `FULL_LAUNCH_TRADE_GRADUATE_LOCK_PASS`**

The test must prove in one deterministic scenario:

```text
launch record snapshots adapter/config
ordinary trade accounting remains correct
final fill closes sellable allocation
failed auto Stage 1 does not revert buyer result
manual permissionless Stage 1 records exact custody
Stage 2 creates one deterministic pool/position
position owner is permanent locker
all excess/token dust is permanent-lock accounted
all USDC is either used in pool, credited explicit dust, existing fee claim, or otherwise reconciled
coordinator and adapter hold no unexplained launch-attributed residue after success
second Stage 1/Stage 2 calls cannot replay
```

- [ ] **Step 2: Run integration test and confirm RED before all remaining wiring is complete**

```bash
cd contracts
forge test --match-path test/BreadDay5Integration.t.sol -vvv
```

- [ ] **Step 3: Add fuzz tests for source-required boundaries**

Use Foundry fuzz inputs bounded to valid economic ranges and cover:

```solidity
function testFuzzGraduationAllocationPreservesAccounting(uint96 usdcAmount, uint128 tokenAmount, uint96 phantom) public { ... }
function testFuzzSixDecimalUsdcResidueReconciles(uint96 amount) public { ... }
function testFuzzFinalBuyAroundGraduationBoundary(uint96 extraQuote) public { ... }
function testFuzzDonationNeverChangesSeed(uint96 usdcDonation, uint128 tokenDonation) public { ... }
```

Include 0/1/near-maximum valid seed cases and both token/USDC address orderings.

- [ ] **Step 4: Add a stateful Day-5 handler and assert `INV-050` through `INV-056` continuously**

At minimum the invariant contract exposes exact methods named:

```solidity
function invariant_INV050_singleCanonicalOutcome() public view { ... }
function invariant_INV051_snapshottedAdapterOnly() public view { ... }
function invariant_INV052_noSweepBeforeValidation() public view { ... }
function invariant_INV053_crossingTradePersistsOnAutoFailure() public view { ... }
function invariant_INV054_retryCannotDuplicateLiquidity() public view { ... }
function invariant_INV055_graduationAssetConservation() public view { ... }
function invariant_INV056_permanentLockerHasNoPrincipalEscape() public view { ... }
```

The handler must randomize donations and emergency state as well as happy-path calls; `fail_on_revert=false` in current `foundry.toml` means invariants must assert state properties, not mistake expected action reverts for proof.

- [ ] **Step 5: Add explicit `RETRY_CANNOT_DUPLICATE_LIQUIDITY` adversarial test**

Configure the adapter fixture to revert at every meaningful stage on separate attempts, then succeed once. Assert:

```solidity
assert(adapter.successfulMints() == 1);
assert(locker.positionRegistrationCount(token) == 1);
assert(uint8(coordinator.getGraduation(token).phase) == uint8(IGraduationCoordinator.GraduationPhase.POOL_CREATED));
```

If the actual locker does not expose a registration counter, keep the count in the controlled PositionManager fixture and assert the locker's single recorded `(manager, positionId)` matches it.

- [ ] **Step 6: Run Day-5 fuzz/invariants plus every prior Foundry test**

```bash
cd contracts
forge test --match-path test/BreadDay5Integration.t.sol -vvv
forge test --match-path test/BreadDay5Fuzz.t.sol -vvv
forge test --match-path test/BreadDay5Invariant.t.sol -vvv
forge test
```

Expected: all PASS. Any pre-Day-5 regression is a stop condition, not a test to rewrite away.

- [ ] **Step 7: Commit Task 9**

```bash
git add contracts/test/BreadDay5Integration.t.sol \
  contracts/test/BreadDay5Fuzz.t.sol \
  contracts/test/BreadDay5Invariant.t.sol \
  contracts/test/helpers/BreadDay5Fixture.sol
git commit -m "test: prove Day 5 graduation invariants"
```

---

### Task 10: Add deploy/configure/verify/smoke automation and fail-closed manifests

**Files:**
- Create: `contracts/script/DeployBreadDay5.s.sol`
- Create: `contracts/script/VerifyBreadDay5.s.sol`
- Create: `contracts/script/SmokeBreadDay5.s.sol`
- Create: `config/protocol/day5-stack-template.json`
- Create: `scripts/validation/validate-day5-manifests.mjs`
- Modify: `scripts/validation/validate-all.mjs`
- Modify: `config/networks/arc-testnet.json`
- Modify: `config/networks/arc-mainnet.json`
- Modify: `.github/workflows/ci.yml`
- Add Node tests for Day-5 manifest validation under `tests/bootstrap/`

**Interfaces:**
- One manifest schema is used for testnet/mainnet; null/unresolved is legal only for inactive/unpublished values.
- Deployment output records source commit, stack version, Factory, Deployer, FeePolicy, FeeEscrow, EmergencyController, GraduationCoordinator, locker, adapter, adapter config hash, Protocol Admin, Guardian, and deployment start block.
- Network activation is rejected unless DEX dependencies/source/compatibility are all verified.

- [ ] **Step 1: Write RED manifest-validation tests**

Cases:

```text
current arc-testnet unresolved DEX -> PASS as inactive
current arc-mainnet null official values -> PASS as AWAITING_OFFICIAL_VALUES
UNISWAP_V4 active with null PoolManager -> FAIL
UNISWAP_V4 active with null PositionManager -> FAIL
UNISWAP_V4 active without exact source inventory -> FAIL
UNISWAP_V3 active without exact factory/position manager -> FAIL
active adapter with config hash mismatch -> FAIL
mainnet guessed chainId/address while status still AWAITING_OFFICIAL_VALUES -> FAIL
```

Run:

```bash
node --test tests/bootstrap/*day5*.test.mjs
```

Expected: RED before validator exists.

- [ ] **Step 2: Implement manifest validation and wire it into `validate-all.mjs`**

The validator must make inactive/unresolved explicit rather than accepting partially populated active configs. It must never auto-fill network values.

- [ ] **Step 3: Implement deployment script ordering**

The deployment script must follow this dependency-safe sequence:

```text
FeePolicy/FeeEscrow/EmergencyController and existing Day-4 core prerequisites
-> BreadLaunchFactory with disabled bootstrap config
-> BreadLaunchDeployer
-> GraduationCoordinator-compatible permanent locker deployment sequence
-> GraduationCoordinator
-> selected test/local adapter and its immutable dependencies
-> one-time Factory coordinator wiring
-> Factory deployer wiring
-> FeeEscrow authorized-creditor wiring for curve/coordinator paths as required
-> validated launch config with exact adapter/config hash
-> ownership handoff
-> emitted protocol manifest
```

Because locker and coordinator refer to each other, implementation must avoid a mutable principal authority: deploy the locker with a one-time coordinator initialization that can only move from zero to the exact coordinator once, or deploy via a deterministic precomputed coordinator address if the existing deployment tooling already supports it. If using one-time wiring, `setCoordinator` must be callable once by the deployment owner, require contract code, and provide no later owner powers; after wiring the locker remains permanently non-admin. Add a focused locker test for this exact initialization path before using it in scripts.

- [ ] **Step 4: Implement verification script assertions**

`VerifyBreadDay5.s.sol` must revert unless:

```text
Factory.usdc == network USDC
Factory.emergencyController == expected controller
Factory.graduationCoordinator == expected coordinator
Coordinator.factory/usdc/feeEscrow/emergencyController/locker all match
adapter.usdc/locker/configHash/family match manifest
LaunchConfig adapter/hash match expected active config
locker coordinator is exact coordinator
Protocol Admin/Guardian ownership matches supplied deployment configuration
no production config value was silently defaulted
```

- [ ] **Step 5: Implement smoke script without hard-coded chain addresses**

The smoke script receives a validated deployment artifact and performs:

```text
launch token
ordinary buy/sell where permitted
creator/protocol fee claim path check
final fill
permissionless sweep if auto attempt did not commit
permissionless createPool
verify terminal phase
verify locked position ownership
verify excess token lock
verify USDC/token reconciliation
verify replay calls fail
```

Do not make the script silently choose a DEX adapter.

- [ ] **Step 6: Extend CI without weakening the existing four-job gate**

Add Day-5 source/manifest validator execution to `bootstrap-validation`, include new config/docs/scripts in formatting validation, and keep `foundry-bootstrap` running full `forge build` + `forge test`.

- [ ] **Step 7: Run validation/build/test suite**

```bash
node scripts/validation/validate-all.mjs
pnpm validate
pnpm test
pnpm typecheck
pnpm build
cd contracts && forge build && forge test
```

Expected: PASS and `git status --porcelain` remains clean after build/test commands.

- [ ] **Step 8: Commit Task 10**

```bash
git add contracts/script \
  config/protocol/day5-stack-template.json \
  config/networks/arc-testnet.json \
  config/networks/arc-mainnet.json \
  scripts/validation/validate-day5-manifests.mjs \
  scripts/validation/validate-all.mjs \
  tests/bootstrap \
  .github/workflows/ci.yml
git commit -m "feat: add Day 5 deployment and manifest gates"
```

---

### Task 11: Perform Day-5 security review, exact-head CI, guarded merge, and merged-main closeout

**Files:**
- Create: `docs/evidence/day5-graduation-adapter-lock.md`
- Modify: `docs/current-build-state.yaml`
- Modify only if evidence requires: Day-5 production/tests from Tasks 1-10

**Interfaces:**
- Evidence verdict is issued only after the exact implementation head passes all required jobs and after merged main identity is verified.
- Required final strings:
  - `FULL_LAUNCH_TRADE_GRADUATE_LOCK_PASS`
  - `INV_050_056_PASS`
  - `RETRY_CANNOT_DUPLICATE_LIQUIDITY`
  - `DAY_5_GRADUATION_ADAPTER_LOCK_INTEGRATED_PASS`

- [ ] **Step 1: Run a focused manual security review against Source-of-Truth threats**

Review every new/modified money-path contract for:

```text
reentrancy/external-call ordering
approval scope/cleanup
raw-balance vs tracked-balance confusion
adapter injection/config drift
wrong dependency/token ordering
phase replay/double spend
partial external progress/idempotence
donation manipulation
unexplained residue
locker escape selectors/capabilities
rescue preconditions/recipient power
Guardian/Admin authority drift
existing-launch snapshot mutation
unbounded revert/event data
dependency/source-license provenance
```

Record findings and resolutions in the evidence document. A critical/high financial finding blocks merge.

- [ ] **Step 2: Run static/tooling checks available in the pinned repository toolchain**

At minimum:

```bash
cd contracts
forge fmt --check
forge build
forge test
cd ..
node scripts/validation/validate-all.mjs
pnpm validate
pnpm test
pnpm typecheck
pnpm build
```

If the repository already has a Solidity static-analysis command by execution time, run that exact pinned command too and record output. Do not install an unpinned scanner solely to manufacture a checkbox.

- [ ] **Step 3: Re-check current official Arc/Uniswap/Pons audit publication state before the candidate PR is declared release-ready**

Record only changed facts. If a new Pons audit report is now public, map each relevant graduation/hook/locker/fee/authorization finding to analogous Bread code and add regression tests before proceeding. If Arc/Uniswap deployment evidence remains unresolved, keep network adapters inactive; do not block local/testnet lifecycle proof merely for that external publication gap.

- [ ] **Step 4: Push the exact candidate head and obtain exact-head repository CI**

All four required repository jobs must PASS on the exact candidate SHA:

```text
bootstrap-validation
dependency-build
infrastructure-health
foundry-bootstrap
```

Do not treat CI from a parent SHA as proof for a later head.

- [ ] **Step 5: Verify PR merge safety before merge**

Check exact head SHA, CI identity, base movement, mergeability, review state, and expected-head protection. Rebase/retest if base movement changes executable code or validation assumptions. Never bypass connector protection with an unverified manual merge.

- [ ] **Step 6: Merge only the exact green reviewed head**

After merge, verify `main` contains the expected merge commit and no successor changed Day-5 code before closeout evidence is written.

- [ ] **Step 7: Create fresh merged-main closeout evidence**

`docs/evidence/day5-graduation-adapter-lock.md` must record:

```text
implementation baseline
implementation exact head
implementation PR and merge commit
exact CI run IDs and all required job results
Foundry suite/test counts
source inventory exact commits/licenses
network adapter activation state
INV-050..INV-056 evidence mapping
retry/duplicate-liquidity adversarial result
locker capability review
open release-only blockers: BREAD_PRODUCTION_ECONOMICS_CONFIG, ARC_MAINNET_VALUES, continuing Pons audit watch, Bread independent review
```

Then update `docs/current-build-state.yaml` from the actual merged main, not from the pre-merge branch.

- [ ] **Step 8: Run closeout exact-head CI and issue the final Day-5 verdict only if green**

The durable closeout head must again pass the four required repository jobs. Only then record:

```text
FULL_LAUNCH_TRADE_GRADUATE_LOCK_PASS
INV_050_056_PASS
RETRY_CANNOT_DUPLICATE_LIQUIDITY
DAY_5_GRADUATION_ADAPTER_LOCK_INTEGRATED_PASS
```

If any mandatory financial/security property or exact-head CI job fails, Day 5 remains open and Day 6 does not begin.

---

## Plan self-review checklist

Before implementation execution begins, verify this plan against the approved design:

- Architecture: one Factory launch registry, one coordinator graduation state authority, one snapshotted adapter per launch, one permanent-lock boundary.
- Trigger: final buy attempts Stage 1 only; failure is swallowed/hashed and user trade persists.
- Sweep: adapter/config/dependency/seed validation precedes ordinary reserve release.
- Retry: Stage 2 revert leaves durable `SWEPT`; success is terminal; no caller-controlled config.
- Lock: position is directly owned by permanent locker and no principal escape capability exists.
- Accounting: tracked curve values only; exact measured sweep; deterministic excess token lock; explicit token/USDC residue resolution.
- Emergency: existing `graduationPaused`; Guardian pause-only; Protocol Admin delayed rescue only.
- Snapshots: future config cannot move an old launch.
- V4/V3: official sources rechecked and pinned before code import; both remain network-inactive without verified Arc deployment evidence.
- Tests: focused unit + fuzz + stateful invariant + adversarial retries + all prior regressions.
- Deployment: same schema/scripts across environments; no guessed mainnet/production values.
- Release: exact-head security review/CI/merge/merged-main closeout before PASS.
