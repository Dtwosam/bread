# Day 2 Core Math & Token Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first Bread financial-core Solidity code as source-faithful Bread-named ports of the frozen Pons V2 launcher token and bonding-curve math, with deterministic differential and bounded fuzz coverage.

**Architecture:** Keep the lane deliberately split into two small production units: `BreadBondingCurveMath` is a pure quote library with no state, and `BreadLaunchToken` is a fixed-supply metadata ERC-20 with no privileged mutation path. Tests independently encode the frozen reference formulas/expected token behavior so Bread is checked against the approved source rather than against itself. OpenZeppelin files required by the token are vendored from the same frozen Pons commit, not fetched dynamically in CI.

**Tech Stack:** Solidity 0.8.26, Foundry v1.5.0, frozen Pons reference commit `d5491e20be56051a68abf47136f6890c3ce3ff7d`, vendored OpenZeppelin Contracts v5.5.0-compatible files from that same frozen tree, GitHub Actions.

## Global Constraints

- Source basis is frozen Pons commit `d5491e20be56051a68abf47136f6890c3ce3ff7d` only.
- `BreadLaunchToken` source basis blob: `3a362035edbcc8be7aeb54f1beb41fa1e01c230a`.
- `BreadBondingCurveMath` source basis blob: `73929a6f64fc4a3e684ffff895a6ef0a018c2019`.
- Production names are `BreadLaunchToken` and `BreadBondingCurveMath`.
- Preserve frozen arithmetic, integer rounding, errors, metadata behavior, mint destination, ERC-20 transfer/allowance behavior and holder burn behavior.
- No owner/admin, post-construction mint, blacklist, transfer tax, pause, launch-buy, reserve custody, curve state machine, snipe logic, fee escrow, graduation, hook, router, pool or Arc mainnet value may enter this lane.
- Active blockers remain active: `CURRENT_PONS_FACTORY_SOURCE_PARITY`, `EXACT_SNIPE_IMPLEMENTATION`, `LAUNCH_AND_BUY_SOURCE`, `FEE_ESCROW_SOURCE`, `LIVE_RUNTIME_CONFIG`, `PONS_AUDIT_FINDINGS`, `ARC_MAINNET_VALUES`.
- Do not claim current-live Pons parity from frozen-source parity.
- TDD is mandatory: observe RED before each production unit is introduced.
- Every accepted change must keep the existing four CI jobs green and leave the tracked workspace clean.

---

### Task 1: Freeze Day-2 source/dependency inventory and math RED tests

**Files:**
- Create: `config/protocol/day2-core-source-inventory.json`
- Create: `contracts/test/BreadBondingCurveMath.t.sol`
- Create: `contracts/test/helpers/FrozenPonsBondingCurveMathReference.sol`
- Modify: `docs/current-build-state.yaml`

**Interfaces:**
- Consumes: approved Day-2 design and frozen Pons source commit.
- Produces: an independent reference formula helper plus tests that target the not-yet-existing `BreadBondingCurveMath` API.

- [ ] **Step 1: Add the frozen source inventory**

Create `config/protocol/day2-core-source-inventory.json` with the exact approved source identities:

```json
{
  "schemaVersion": 1,
  "referenceRepository": "https://github.com/ponsdotdev/ponsfamily",
  "referenceCommit": "d5491e20be56051a68abf47136f6890c3ce3ff7d",
  "productionPorts": {
    "BreadLaunchToken": {
      "sourcePath": "contractsV2/src/v2/PonsV2LauncherToken.sol",
      "blobSha": "3a362035edbcc8be7aeb54f1beb41fa1e01c230a",
      "spdx": "MIT"
    },
    "BreadBondingCurveMath": {
      "sourcePath": "contractsV2/src/v2/libraries/PonsV2BondingCurveMath.sol",
      "blobSha": "73929a6f64fc4a3e684ffff895a6ef0a018c2019",
      "spdx": "MIT"
    }
  },
  "dependencyPolicy": {
    "openzeppelinSource": "frozen-pns-tree",
    "openzeppelinObservedVersion": "5.5.0",
    "dynamicInstallAllowed": false
  },
  "parityClaim": "FROZEN_SOURCE_BEHAVIOR_ONLY_NOT_CURRENT_LIVE_PARITY"
}
```

Use the actual string `frozen-pons-tree` for `openzeppelinSource`; the spelling above is only invalid if mistyped during execution. The committed JSON must contain `"openzeppelinSource": "frozen-pons-tree"`.

- [ ] **Step 2: Add an independent frozen-reference math helper**

Create `contracts/test/helpers/FrozenPonsBondingCurveMathReference.sol` with functions that independently encode the frozen arithmetic and return/revert rules. It must not import Bread production code.

Core exact-input reference:

```solidity
uint256 amountInWithFee = amountIn * (10_000 - feeBps);
uint256 numerator = amountInWithFee * reserveOut;
uint256 denominator = reserveIn * 10_000 + amountInWithFee;
return numerator / denominator;
```

Core exact-output reference:

```solidity
uint256 numerator = amountOut * reserveIn * 10_000;
uint256 denominator = (reserveOut - amountOut) * (10_000 - feeBps);
return numerator / denominator + 1;
```

- [ ] **Step 3: Write the failing Foundry math tests**

Create `contracts/test/BreadBondingCurveMath.t.sol`. It must import `../src/libraries/BreadBondingCurveMath.sol`, which does not exist yet, and cover at minimum:

```solidity
function testGetAmountOutMatchesFrozenReference() public;
function testGetAmountInMatchesFrozenReference() public;
function testQuoteAmountOutMatchesFrozenReference() public;
function testGetAmountOutRevertsOnZeroInput() public;
function testGetAmountOutRevertsOnZeroReserve() public;
function testGetAmountOutRevertsWhenRoundedOutputIsZero() public;
function testQuoteAmountOutReturnsZeroForInvalidNonRevertingCases() public;
function testGetAmountInRevertsOnInvalidLiquidityAndFullFee() public;
function testFuzz_GetAmountOutMatchesFrozenReference(uint128 amountSeed, uint128 reserveInSeed, uint128 reserveOutSeed, uint16 feeSeed) public;
function testFuzz_GetAmountInMatchesFrozenReference(uint128 outputSeed, uint128 reserveInSeed, uint128 reserveOutSeed, uint16 feeSeed) public;
function testFuzz_OutputAlwaysBelowReserveOut(uint128 amountSeed, uint128 reserveInSeed, uint128 reserveOutSeed, uint16 feeSeed) public;
function testFuzz_LargerInputNeverProducesSmallerOutput(uint128 aSeed, uint128 deltaSeed, uint128 reserveInSeed, uint128 reserveOutSeed, uint16 feeSeed) public;
function testFuzz_LargerFeeNeverProducesLargerOutput(uint128 amountSeed, uint128 reserveInSeed, uint128 reserveOutSeed, uint16 feeASeed, uint16 feeDeltaSeed) public;
```

Normalize fuzz values inside the test into bounded domains before arithmetic, for example reserves in `[1, type(uint96).max]`, fees in `[0, 9_999]`, and exact output strictly below `reserveOut`. Do not use assumptions that allow the fuzzer to spend most runs rejecting inputs.

- [ ] **Step 4: Record the active Day-2 branch in the handoff**

Update `docs/current-build-state.yaml` so `working_branches` contains `checkpoint/day2-core-math-token`, `active_lane` names the core math/token TDD lane, and every existing blocker remains present.

- [ ] **Step 5: Open a draft PR and run RED CI**

Expected Foundry result: FAIL because `BreadBondingCurveMath.sol` is absent. Existing non-Foundry jobs should remain structurally healthy unless the branch-state change exposes an unrelated continuity regression.

- [ ] **Step 6: Commit the RED state**

Commit message:

```text
test: define Day 2 bonding curve math parity
```

Record the RED workflow run ID in Day-2 evidence later; do not weaken the test to make RED disappear.

---

### Task 2: Implement `BreadBondingCurveMath` and close the math GREEN cycle

**Files:**
- Create: `contracts/src/libraries/BreadBondingCurveMath.sol`
- Modify: `contracts/test/BreadBondingCurveMath.t.sol` only if the RED run reveals a test/reference bug rather than a production requirement.

**Interfaces:**
- Produces:
  - `BreadBondingCurveMath.getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut, uint256 feeBps) internal pure returns (uint256)`
  - `BreadBondingCurveMath.quoteAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut, uint256 feeBps) internal pure returns (uint256)`
  - `BreadBondingCurveMath.getAmountIn(uint256 amountOut, uint256 reserveIn, uint256 reserveOut, uint256 feeBps) internal pure returns (uint256)`
  - custom errors `InsufficientInputAmount`, `InsufficientOutputAmount`, `InsufficientLiquidity`.

- [ ] **Step 1: Add the minimal source-faithful library**

Use Solidity `^0.8.26`, `BASIS_POINTS = 10_000`, and preserve the exact frozen formulas and branch ordering:

```solidity
function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut, uint256 feeBps)
    internal
    pure
    returns (uint256 amountOut)
{
    if (amountIn == 0) revert InsufficientInputAmount();
    if (reserveIn == 0 || reserveOut == 0) revert InsufficientLiquidity();

    amountOut = _amountOut(amountIn, reserveIn, reserveOut, feeBps);
    if (amountOut == 0) revert InsufficientOutputAmount();
}
```

```solidity
function quoteAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut, uint256 feeBps)
    internal
    pure
    returns (uint256 amountOut)
{
    if (amountIn == 0 || reserveIn == 0 || reserveOut == 0 || feeBps >= BASIS_POINTS) return 0;
    return _amountOut(amountIn, reserveIn, reserveOut, feeBps);
}
```

```solidity
function getAmountIn(uint256 amountOut, uint256 reserveIn, uint256 reserveOut, uint256 feeBps)
    internal
    pure
    returns (uint256 amountIn)
{
    if (amountOut == 0) revert InsufficientOutputAmount();
    if (reserveIn == 0 || reserveOut <= amountOut) revert InsufficientLiquidity();
    if (feeBps >= BASIS_POINTS) revert InsufficientLiquidity();

    uint256 numerator = amountOut * reserveIn * BASIS_POINTS;
    uint256 denominator = (reserveOut - amountOut) * (BASIS_POINTS - feeBps);
    amountIn = numerator / denominator + 1;
}
```

Do not add unchecked arithmetic, full-precision helpers, decimal normalization, fee caps other than the frozen branches, or alternative rounding.

- [ ] **Step 2: Run the focused Foundry math suite**

Run:

```bash
cd contracts && forge test --match-path test/BreadBondingCurveMath.t.sol -vvv
```

Expected: PASS, including deterministic and fuzz/differential cases.

- [ ] **Step 3: Run full Foundry build/test**

Run:

```bash
cd contracts && forge build && forge test
```

Expected: PASS.

- [ ] **Step 4: Commit math GREEN**

Commit message:

```text
feat: port Bread bonding curve math
```

Do not proceed to token production code if math parity is not green.

---

### Task 3: Vendor the exact required OpenZeppelin surface and create token RED tests

**Files:**
- Create exact frozen dependency files under `contracts/lib/openzeppelin-contracts/contracts/...`:
  - `token/ERC20/ERC20.sol`
  - `token/ERC20/IERC20.sol`
  - `token/ERC20/extensions/IERC20Metadata.sol`
  - `token/ERC20/extensions/ERC20Burnable.sol`
  - `utils/Context.sol`
  - `interfaces/draft-IERC6093.sol`
- Create: `contracts/test/BreadLaunchToken.t.sol`
- Modify: `contracts/foundry.toml` only if an explicit remapping is required by Foundry resolution.
- Modify: `config/protocol/day2-core-source-inventory.json` to record every vendored dependency path/blob SHA observed from the frozen Pons tree before the files are copied.

**Interfaces:**
- Consumes the frozen OpenZeppelin files imported by the approved Pons token.
- Produces token tests targeting absent `contracts/src/BreadLaunchToken.sol`.

- [ ] **Step 1: Fetch and record exact frozen OpenZeppelin dependency blobs**

Use only paths from the frozen Pons tree at commit `d5491e20...`. Preserve SPDX headers and file contents. Do not substitute a package-manager download or a newer upstream branch.

The observed ERC-20 source identifies OpenZeppelin Contracts `v5.5.0`; `ERC20Burnable.sol` carries its own upstream last-updated marker while remaining inside the same frozen dependency tree.

- [ ] **Step 2: Vendor only the six files required by the token import graph**

Keep their relative OpenZeppelin paths intact under `contracts/lib/openzeppelin-contracts/contracts/` so upstream relative imports continue to resolve. If Bread uses the upstream-style import string, add the exact remapping:

```toml
remappings = ["@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/"]
```

Do not vendor unrelated OpenZeppelin modules.

- [ ] **Step 3: Write the failing token test suite before `BreadLaunchToken.sol` exists**

`contracts/test/BreadLaunchToken.t.sol` must cover:

```solidity
function testMintsEntireSupplyOnlyToCurve() public;
function testStoresImmutableAttributionAddresses() public;
function testMetadataAndSocialsRoundTrip() public;
function testGetTokenInfoRoundTripsConstructorData() public;
function testRevertsWhenDeployerIsZero() public;
function testRevertsWhenCurveIsZero() public;
function testRevertsWhenLaunchFactoryIsZero() public;
function testStandardTransferAndAllowanceBehavior() public;
function testHolderBurnReducesBalanceAndTotalSupply() public;
function testBurnFromConsumesAllowanceAndReducesSupply() public;
function testNoPublicMintPrivilegeExists() public;
function testFuzz_InitialSupplyAlwaysBelongsToCurve(uint128 supplySeed) public;
```

Use `try/catch` or low-level calls for expected constructor/missing-selector failures so the test suite does not require a floating test helper dependency. For `testNoPublicMintPrivilegeExists`, low-level call a conventional `mint(address,uint256)` selector against the deployed token, require failure, and assert total supply is unchanged.

- [ ] **Step 4: Run token RED**

Expected Foundry result: FAIL because `BreadLaunchToken.sol` is absent. If dependency vendoring itself fails to compile, fix only the dependency graph and rerun until the failure is specifically the missing Bread production token.

- [ ] **Step 5: Commit token RED**

Commit message:

```text
test: define Bread launch token parity
```

---

### Task 4: Implement `BreadLaunchToken` and close the token GREEN cycle

**Files:**
- Create: `contracts/src/BreadLaunchToken.sol`

**Interfaces:**
- Struct: `BreadLaunchToken.Socials { string twitter; string telegram; string discord; string website; string farcaster; }`
- Immutables: `deployer`, `launchFactory`, `curve`.
- Metadata: public `logo`, public `description`, private `_socials`.
- Views: `socials()` and `getTokenInfo()` preserving constructor values.
- ERC-20/burn behavior inherited from the frozen OpenZeppelin surface.

- [ ] **Step 1: Add the minimal source-faithful Bread token**

Use imports:

```solidity
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
```

Constructor behavior must be exactly:

```solidity
if (deployer_ == address(0) || curve_ == address(0) || launchFactory_ == address(0)) {
    revert ZeroAddress();
}

deployer = deployer_;
launchFactory = launchFactory_;
curve = curve_;
logo = logo_;
description = description_;
_socials = socials_;
_mint(curve_, supply_);
```

No owner, no privileged mint, no pause, no transfer restriction, no tax, no factory callback.

- [ ] **Step 2: Run the focused token suite**

```bash
cd contracts && forge test --match-path test/BreadLaunchToken.t.sol -vvv
```

Expected: PASS.

- [ ] **Step 3: Run all Foundry tests**

```bash
cd contracts && forge build && forge test
```

Expected: PASS, including math and bootstrap coverage.

- [ ] **Step 4: Commit token GREEN**

Commit message:

```text
feat: port Bread launch token
```

---

### Task 5: Integrated review, evidence, exact-head CI and merge

**Files:**
- Create: `docs/evidence/day2-core-math-token.md`
- Modify: `docs/current-build-state.yaml`
- Modify: `README.md` only if the repository's current-state paragraph is stale after integration.

**Interfaces:**
- Produces a durable Day-2 evidence record and the next source-permitted handoff.

- [ ] **Step 1: Run a scope/security diff review**

Review the PR for all of the following and fix findings before closeout:

- no write/admin behavior beyond standard ERC-20 transfer/allowance/burn;
- no post-construction mint path;
- no reserve custody/state-machine code;
- no snipe, Launch+Buy, FeeEscrow, graduation, hook, pool/router or mainnet address code;
- formulas and branch ordering match the frozen source;
- vendored OpenZeppelin files match recorded frozen blobs;
- fuzz bounds do not mask valid formula discrepancies;
- tests compare against an independent frozen-reference encoding;
- all 7A blockers remain present in repository state.

- [ ] **Step 2: Write Day-2 evidence**

`docs/evidence/day2-core-math-token.md` must record:

- approved source commit and blob SHAs;
- dependency source/version/blob inventory;
- math RED run/head and GREEN run/head;
- token RED run/head and GREEN run/head;
- review findings and their fixes;
- final exact-head CI run;
- explicit statement that parity is only against the frozen source, not the current live Pons deployment;
- explicit list of retained 7A blockers.

- [ ] **Step 3: Update the durable handoff before the final gate**

Update `docs/current-build-state.yaml` with the Day-2 PR/branch, candidate head, test evidence and exact next action. Do not mark Day 2 complete until integration actually occurs.

- [ ] **Step 4: Run the exact final PR-head gate**

All four existing CI jobs must PASS on the same final SHA:

```text
bootstrap-validation
foundry-bootstrap
dependency-build
infrastructure-health
```

The dependency build must also pass its clean tracked-worktree check.

- [ ] **Step 5: Merge only the verified exact head**

Use an expected-head merge guard. If the PR head moved after the green run, rerun CI before merge.

- [ ] **Step 6: Post-merge closeout**

Create a metadata-only closeout successor if necessary so `main` records the actual Day-2 merge SHA and next action. Run the normal CI gate on that closeout before merging it.

Day 2 may be marked complete only after this handoff write gate passes.

---

## Plan Self-Review

- **Spec coverage:** token semantics, math formulas/errors/rounding, differential tests, fuzz properties, source/dependency freeze, non-goals, review, evidence and continuity gates are each mapped to a task.
- **Placeholder scan:** no TBD/TODO/"implement later" steps remain.
- **Type consistency:** production names and signatures match the approved design throughout.
- **Scope check:** the plan contains only source-verified token/math work; blocked Pons successor-stack behavior is not required by any task.
- **Dependency check:** OpenZeppelin is taken from the same frozen Pons tree rather than from a floating install.
