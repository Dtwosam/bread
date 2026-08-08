# Day 2 Tracked Curve State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the smallest source-verifiable abstract tracked-reserve state core required by Bread Day 2, with six-decimal quote accounting, allocation/graduation proofs, donation resistance, tiny-trade rounding proofs, and exact frozen dependency enforcement.

**Architecture:** `BreadTrackedCurveState` is an abstract non-deployable base extracted from the frozen Pons V2 bonding-curve reserve/allocation logic. It owns only tracked state, initialization math and read-only reserve/graduation functions; a test harness exposes mutation solely for proofs. Trading, fees distribution, snipe protection, Launch+Buy, graduation transfer and DEX behavior remain outside this lane.

**Tech Stack:** Solidity 0.8.26, Foundry v1.5.0, frozen Pons source commit `d5491e20be56051a68abf47136f6890c3ce3ff7d`, exact vendored OpenZeppelin files, Node 24 validation scripts, GitHub Actions CI.

## Global Constraints

- Integration base is `aca14483ef5d8bee707a39e7ea628569d22d1828` on `main`.
- Frozen Pons curve source is `contractsV2/src/v2/PonsV2BondingCurve.sol`, blob `a5d84b3c355a1661e1bf61a4dd4e29591fbf6074`.
- The Lane-2 claim is a bounded tracked-reserve extraction, **not** a full Pons curve port and **not** current-live parity.
- Bread V1 quote state is ERC-20-only; `pairToken == address(0)` is rejected and no native-asset path is implemented.
- Six-decimal USDC-like values remain in six-decimal base units; production code performs no 6→18 decimal normalization.
- Do not hardcode an Arc mainnet USDC address.
- Do not implement Buy/Sell, FeeEscrow, fee sweep/distribution, buyback, snipe protection, Launch+Buy, automatic graduation, graduation transfer, hooks, pools or routers.
- All existing 7A blockers remain active.
- No production code may be added before its production-facing test has produced a specific RED.

---

### Task 1: Capture tracked-state RED

**Files:**
- Create: `contracts/test/helpers/MockUSDC6.sol`
- Create: `contracts/test/helpers/BreadTrackedCurveStateHarness.sol`
- Create: `contracts/test/BreadTrackedCurveState.t.sol`
- Production file intentionally absent: `contracts/src/core/BreadTrackedCurveState.sol`

**Interfaces:**
- Consumes: integrated `BreadLaunchToken` from Day-2 Lane 1.
- Produces for tests only: `BreadTrackedCurveStateHarness.initialize`, `setTrackedQuoteBuckets`, `setTrackedTokens`, `setGraduated`, and `simulateTrackedTokenOut`.
- Production API expected by the tests is exactly the API frozen in `docs/superpowers/specs/2026-08-08-day2-tracked-curve-state-design.md`.

- [ ] **Step 1: Add the six-decimal quote fixture**

Create `MockUSDC6.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC6 is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
```

- [ ] **Step 2: Add a test-only harness that imports the absent production base**

Create `BreadTrackedCurveStateHarness.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {BreadTrackedCurveState} from "../../src/core/BreadTrackedCurveState.sol";

contract BreadTrackedCurveStateHarness is BreadTrackedCurveState {
    constructor(address pairToken_, uint256 phantomQuote_, uint256 graduationThreshold_)
        BreadTrackedCurveState(pairToken_, phantomQuote_, graduationThreshold_)
    {}

    function initialize(address token_) external {
        _initializeTrackedCurve(token_);
    }

    function setTrackedQuoteBuckets(uint256 trackedQuote_, uint256 fee_, uint256 tax_) external {
        trackedQuote = trackedQuote_;
        quoteFeeBalance = fee_;
        creatorTaxBalance = tax_;
    }

    function setTrackedTokens(uint256 amount) external {
        trackedTokens = amount;
    }

    function setGraduated(bool value) external {
        graduated = value;
    }

    function simulateTrackedTokenOut(address recipient, uint256 amount) external {
        trackedTokens -= amount;
        IERC20(token).transfer(recipient, amount);
    }
}
```

- [ ] **Step 3: Add deterministic and bounded-fuzz state tests**

Create `BreadTrackedCurveState.t.sol` with tests covering:

```solidity
function testRejectsZeroPairToken() public;
function testInitializeUsesSixDecimalQuoteUnitsWithoutScaling() public;
function testInitializeMatchesFrozenReservedAllocationFormula() public;
function testInitializeRecordsActualLaunchTokenBalance() public;
function testInitializeRejectsZeroToken() public;
function testInitializeRejectsSecondInitialization() public;
function testInitializeRejectsZeroReservedAllocation() public;
function testInitializeRejectsWholeSupplyReservedAllocation() public;
function testReserveReadersExcludePendingFeeAndTaxBuckets() public;
function testSellableTokensStopsAtReservedFloor() public;
function testReadyToGraduateUsesTrackedTokenFloor() public;
function testGraduatedCurveIsNotReadyAgain() public;
function testQuoteDonationDoesNotChangeTrackedReservesOrGraduation() public;
function testLaunchTokenDonationDoesNotChangeTrackedReserveOrDelayGraduation() public;
function testFuzz_ReservedAllocationMatchesBoundedIndependentReference(...) public;
```

Use these fixture conventions inside the test:

```solidity
uint256 private constant ONE_USDC = 1_000_000;
uint256 private constant PHANTOM_QUOTE = 30_000 * ONE_USDC;
uint256 private constant GRADUATION_THRESHOLD = 70_000 * ONE_USDC;
uint256 private constant SUPPLY = 1_000_000_000 ether;
```

For the independent bounded reference, keep fuzz values small enough that ordinary multiplication cannot overflow and compute:

```solidity
uint256 expected = supply * phantomQuote / (phantomQuote + graduationThreshold);
```

For quote donation resistance, mint mock USDC to the test and transfer it directly to the harness without calling any bookkeeping function; assert `quoteReserve()`, `realQuoteReserve()` and `readyToGraduate()` are unchanged.

For token donation resistance, use `simulateTrackedTokenOut(address(this), amount)` to create a legitimate tracked/raw balance reduction, set the tracked reserve to the reserved boundary, then transfer the launch token directly back to the harness without bookkeeping; assert raw balance rises while `tokenReserve()`, `sellableTokens()` and `readyToGraduate()` remain driven by tracked state.

- [ ] **Step 4: Open a draft PR and verify RED**

Expected Foundry failure:

```text
Source "src/core/BreadTrackedCurveState.sol" not found
```

The RED is accepted only if the missing production file is the specific Foundry blocker and unrelated bootstrap/dependency/infrastructure jobs remain healthy.

- [ ] **Step 5: Commit the RED state**

Commit message:

```text
test: define tracked curve state behavior
```

---

### Task 2: Vendor exact full-precision math dependency and implement minimal tracked state

**Files:**
- Create: `contracts/lib/openzeppelin-contracts/contracts/utils/math/Math.sol`
- Create: `contracts/lib/openzeppelin-contracts/contracts/utils/Panic.sol`
- Create: `contracts/lib/openzeppelin-contracts/contracts/utils/math/SafeCast.sol`
- Create: `contracts/src/core/BreadTrackedCurveState.sol`

**Interfaces:**
- Consumes: `IERC20` and exact frozen OpenZeppelin `Math.mulDiv`.
- Produces: internal `_initializeTrackedCurve(address)` plus the public read surface specified in the design.

- [ ] **Step 1: Vendor the exact three frozen OpenZeppelin files**

Use the same one-time branch-scoped verified-vendoring method used in Day-2 Lane 1. Fetch only from frozen Pons commit `d5491e20be56051a68abf47136f6890c3ce3ff7d` and require these exact Git blob SHAs before committing:

```text
Math.sol     e7288595b6539e986aef1a7a524884d86fc2d643
Panic.sol    e168824d34b3f0ba0be33317fb34b9e74fc148b6
SafeCast.sol ccb979f61c9577e6338276cff49625d5a2191eb3
```

Delete the temporary write-enabled workflow immediately after the verified commit. Normal CI must not download these files dynamically.

- [ ] **Step 2: Add the minimal abstract production contract**

Create `contracts/src/core/BreadTrackedCurveState.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

abstract contract BreadTrackedCurveState {
    error ZeroAddress();
    error AlreadyInitialized();
    error InvalidLaunchEconomics();

    address public token;
    address public immutable pairToken;
    uint256 public immutable phantomQuote;
    uint256 public immutable graduationThreshold;

    uint256 public quoteFeeBalance;
    uint256 public creatorTaxBalance;
    uint256 public trackedQuote;
    uint256 public trackedTokens;
    uint256 public reservedTokens;
    bool public graduated;

    constructor(address pairToken_, uint256 phantomQuote_, uint256 graduationThreshold_) {
        if (pairToken_ == address(0)) revert ZeroAddress();
        pairToken = pairToken_;
        phantomQuote = phantomQuote_;
        graduationThreshold = graduationThreshold_;
    }

    function _initializeTrackedCurve(address token_) internal {
        if (token != address(0)) revert AlreadyInitialized();
        if (token_ == address(0)) revert ZeroAddress();
        token = token_;

        uint256 supply = IERC20(token_).totalSupply();
        uint256 reserved = Math.mulDiv(supply, phantomQuote, phantomQuote + graduationThreshold);
        if (reserved == 0 || reserved >= supply) revert InvalidLaunchEconomics();

        reservedTokens = reserved;
        trackedTokens = IERC20(token_).balanceOf(address(this));
    }

    function sellableTokens() public view returns (uint256) {
        uint256 tracked = trackedTokens;
        return tracked > reservedTokens ? tracked - reservedTokens : 0;
    }

    function getReserves() public view returns (uint256 quoteReserve_, uint256 tokenReserve_) {
        quoteReserve_ = phantomQuote + trackedQuote - quoteFeeBalance - creatorTaxBalance;
        tokenReserve_ = trackedTokens;
    }

    function quoteReserve() external view returns (uint256 quoteReserve_) {
        (quoteReserve_,) = getReserves();
    }

    function realQuoteReserve() public view returns (uint256) {
        return trackedQuote - quoteFeeBalance - creatorTaxBalance;
    }

    function tokenReserve() external view returns (uint256 tokenReserve_) {
        (, tokenReserve_) = getReserves();
    }

    function readyToGraduate() public view returns (bool) {
        if (graduated) return false;
        return sellableTokens() == 0;
    }
}
```

Do not add any other production method.

- [ ] **Step 3: Run the focused state suite and verify GREEN**

Run:

```bash
cd contracts && forge test --match-contract BreadTrackedCurveStateTest -vv
```

Expected: all tracked-state deterministic/fuzz tests PASS.

- [ ] **Step 4: Run the full Foundry suite**

Run:

```bash
cd contracts && forge test
```

Expected: Lane-1 math/token tests and Lane-2 state tests all PASS.

- [ ] **Step 5: Commit the GREEN state**

Commit message:

```text
feat: add tracked curve reserve state
```

---

### Task 3: Add six-decimal tiny-trade rounding invariants

**Files:**
- Create: `contracts/test/BreadTinyTradeInvariant.t.sol`
- No production file is modified by this task.

**Interfaces:**
- Consumes: integrated `BreadBondingCurveMath.quoteAmountOut`.
- Produces: test evidence for rounding-only tiny-trade non-profitability before stateful Buy/Sell exists.

- [ ] **Step 1: Add one-round-trip property**

Use quote base units directly:

```solidity
uint256 constant ONE_USDC = 1_000_000;
```

For each bounded case:

```solidity
uint256 tokensOut = BreadBondingCurveMath.quoteAmountOut(quoteIn, quoteReserve, tokenReserve, 0);
if (tokensOut == 0) return;

uint256 quoteReserveAfterBuy = quoteReserve + quoteIn;
uint256 tokenReserveAfterBuy = tokenReserve - tokensOut;
uint256 quoteOut = BreadBondingCurveMath.quoteAmountOut(
    tokensOut,
    tokenReserveAfterBuy,
    quoteReserveAfterBuy,
    0
);
assert(quoteOut <= quoteIn);
```

Add a deterministic case using a `30_000 * ONE_USDC` quote reserve and `1_000_000_000 ether` token reserve, plus a fuzz case with bounded non-zero reserves and quote inputs measured in micro-USDC through whole USDC units.

- [ ] **Step 2: Add repeated bounded-round-trip property**

Run up to 64 sequential round trips. After each buy/sell, update the simulated reserves, carry the trader's returned quote amount into the next iteration, stop when either leg rounds to zero, and assert:

```solidity
assert(currentQuote <= startingQuote);
```

No fee or tax is introduced in this task; the proof is intentionally rounding-only because fee semantics remain gated.

- [ ] **Step 3: Run the focused tiny-trade suite**

Run:

```bash
cd contracts && forge test --match-contract BreadTinyTradeInvariantTest -vv
```

Expected: PASS across deterministic and 256-run fuzz cases.

- [ ] **Step 4: Commit the test-only invariant evidence**

Commit message:

```text
test: prove tiny trade rounding cannot extract quote
```

---

### Task 4: Make the Lane-2 source boundary executable in CI

**Files:**
- Modify: `config/protocol/day2-core-source-inventory.json`
- Modify: `scripts/validation/validate-day2-source-integrity.mjs`
- Modify: `tests/bootstrap/day2-source-integrity.test.mjs`

**Interfaces:**
- Consumes: frozen Pons curve blob and all nine exact OpenZeppelin dependency blobs.
- Produces: machine-enforced bounded source provenance for the Lane-2 production core.

- [ ] **Step 1: Write the failing bootstrap assertions first**

Extend `tests/bootstrap/day2-source-integrity.test.mjs` so it loads the Day-2 inventory and asserts:

```javascript
assert.equal(
  inventory.productionPorts.BreadTrackedCurveState.blobSha,
  'a5d84b3c355a1661e1bf61a4dd4e29591fbf6074'
);
assert.equal(
  inventory.productionPorts.BreadTrackedCurveState.portMode,
  'BOUNDED_TRACKED_RESERVE_EXTRACTION'
);
assert.equal(Object.keys(inventory.dependencyPolicy.vendoredFiles).length, 9);
```

Also assert the three new upstream paths map to their exact frozen SHAs.

Run:

```bash
node --test tests/bootstrap/day2-source-integrity.test.mjs
```

Expected: FAIL because the inventory still describes only Lane 1 and six vendored files.

- [ ] **Step 2: Extend the inventory with the bounded curve source record**

Add:

```json
"BreadTrackedCurveState": {
  "sourcePath": "contractsV2/src/v2/PonsV2BondingCurve.sol",
  "blobSha": "a5d84b3c355a1661e1bf61a4dd4e29591fbf6074",
  "spdx": "MIT",
  "portMode": "BOUNDED_TRACKED_RESERVE_EXTRACTION"
}
```

Add the three new vendored dependency paths/SHAs and their observed file markers. Preserve `packageVersionClaim: null`, `dynamicInstallAllowed: false` and `FROZEN_SOURCE_BEHAVIOR_ONLY_NOT_CURRENT_LIVE_PARITY`.

- [ ] **Step 3: Extend the integrity validator from six to nine exact files**

Change the expected vendored-file count to 9. Add explicit validation that the `BreadTrackedCurveState` source record points to the frozen Pons curve path/blob and carries `BOUNDED_TRACKED_RESERVE_EXTRACTION`.

The validator must continue recomputing Git blob SHA-1 from local vendored file bytes and reject any drift.

- [ ] **Step 4: Verify bootstrap GREEN**

Run:

```bash
node scripts/validation/validate-all.mjs
node --test tests/bootstrap/*.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit source-boundary enforcement**

Commit message:

```text
chore: enforce Day 2 tracked state provenance
```

---

### Task 5: Integrated review, evidence, handoff and exact-head gate

**Files:**
- Create: `docs/evidence/day2-tracked-curve-state.md`
- Modify: `docs/current-build-state.yaml`
- Review all files changed by this lane.

**Interfaces:**
- Consumes: Tasks 1-4 complete GREEN state.
- Produces: durable Lane-2 evidence and the single safe next action.

- [ ] **Step 1: Run full repository verification**

Required CI-equivalent checks:

```bash
node scripts/validation/validate-all.mjs
node --test tests/bootstrap/*.test.mjs
node tests/bootstrap/bootstrap-smoke.mjs
pnpm install --frozen-lockfile
pnpm validate
pnpm test
pnpm typecheck
pnpm build
cd contracts && forge build && forge test
```

Infrastructure health must also verify PostgreSQL and Redis exactly as existing CI does.

- [ ] **Step 2: Review the diff for forbidden scope**

Reject the lane if the production diff introduces any of:

```text
buy(
sell(
sweepFees(
rescueFees(
graduate(
feeEscrow
buybackVault
snipe
trustedForwarder
msg.value
_sendQuote
_receiveQuote
Uniswap
```

The only allowed occurrences of blocked terms are explanatory docs/tests asserting absence; they must not create production behavior.

Also verify `BreadTrackedCurveState` remains `abstract` and exposes no external state mutation function.

- [ ] **Step 3: Write durable evidence**

`docs/evidence/day2-tracked-curve-state.md` must record:

- base merge `aca14483ef5d8bee707a39e7ea628569d22d1828`;
- frozen Pons curve path/blob;
- RED and GREEN heads/run IDs;
- exact Math/Panic/SafeCast blob SHAs;
- allocation/graduation test counts;
- six-decimal quote-accounting results;
- donation-resistance results;
- tiny-trade deterministic/fuzz results;
- source-integrity validation result;
- diff-review result;
- retained 7A blockers;
- explicit statement that this is not a deployable trading curve and not live Pons parity.

- [ ] **Step 4: Update `docs/current-build-state.yaml`**

Record Lane 2 as `DAY_2_TRACKED_CURVE_STATE_INTEGRATED_PASS` only after merge. Before merge, record the exact candidate branch/head and `next_action` as the exact-head CI/merge gate.

Do not mark Day 2 complete unless the controlling Day-2 checklist has been re-read after Lane 2 and all remaining Day-2 requirements are demonstrably satisfied.

- [ ] **Step 5: Run exact-head CI and merge with expected-head guard**

All four existing jobs must PASS on the exact candidate SHA:

```text
bootstrap-validation
dependency-build
foundry-bootstrap
infrastructure-health
```

Merge only with the exact tested head SHA. After merge, write a metadata-only closeout handoff from current `main` if the merge SHA itself needs to be recorded durably.
