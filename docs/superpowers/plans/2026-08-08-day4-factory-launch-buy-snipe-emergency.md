# Day 4 Factory, Launch+Buy, Snipe & Emergency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Bread's ratified Day-4 launch-control lane: Factory/Deployer + economics pinning, canonical-USDC launch fees, atomic Launch+Buy, exact buy-only quadratic opening protection, and restriction-only emergency control, while preserving every accepted Day-1 through Day-3 accounting invariant.

**Architecture:** `BreadLaunchFactory` owns launch orchestration and future launch configuration but never duplicates curve pricing or fee ledgers. `BreadLaunchDeployer` is a factory-only deployment helper; `BreadBondingCurve` remains the sole trade/tracked-reserve/fee-accrual authority and receives only the minimum Day-4 additions for launch timestamp, one-call factory exempt buy, opening protection and emergency gating. `BreadEmergencyController` is a separate restriction oracle with no custody/economic authority, while `BreadFeeEscrow` remains the sole claim ledger.

**Tech Stack:** Solidity 0.8.26, Foundry v1.5.0-compatible workspace, OpenZeppelin `Ownable` / `SafeERC20` / `ReentrancyGuard` / `Math`, Node 24.18.0, pnpm 11.15.1, GitHub Actions.

**Ratified source baseline:** Project Source Pack `v1.4-day4-design`, explicitly read back and reconciled in the active chat; `PROJECT_SOURCE_RATIFICATION_FOR_DAY4_PRODUCTION = RATIFIED`.

**Accepted production baseline before Day 4:** `main` at `c6fcb53c854e45843b60720e3be859a49965bad2`; accepted Day-3 production `4f572bfd61cd57b33be994b895295be4522179b2`; durable Day-3 closeout `a67f42cae2b69c5c8ec4b07f0c2f2695ac4ea8a3`.

**Approved design evidence:** `checkpoint/day4-preflight-design` design commit `324b6055a0bed278766e1b48016774ac745b3781` plus ratification record `docs/source-reconciliation/day4-project-source-v1.4-promotion.md`.

## Global Constraints

- Canonical business/accounting quote asset is ERC20 USDC with 6 decimals. No native quote branch enters Day 4.
- No production `launchFeeUsdc`, FeePolicy value, treasury address, Arc mainnet address or DEX value is guessed. Tests use explicit fixture values.
- No Day-4 CREATE2/deterministic-address public promise and no exact current-live Pons factory parity claim.
- No Day-5 graduation adapter/executor/locker implementation, buyback/vesting implementation, native-quote implementation or Arc-mainnet activation.
- Preserve `BreadBondingCurve` as pricing/tracked-reserve/fee-accrual authority. Factory must never copy curve pricing into a second accounting engine.
- Preserve `BreadFeeEscrow` as the only claim ledger and `BreadFeePolicy` as the fee-policy authority.
- Day 4 does **not** add a new automatic FeeEscrow creditor registrar. The existing owner-controlled `setAuthorizedCreditor` model remains canonical: the Factory is authorized once by Protocol Admin before non-zero launch-fee use; a new curve is authorized by Protocol Admin before its first fee sweep. A registrar changes credit authority and therefore requires a separately ratified amendment.
- `STARTING_SNIPE_TAX_BPS = 9900`, `SNIPE_DURATION_SECONDS = 5`, terminal bps `0`, exact integer vector `9900/6336/3564/1584/396/0` at elapsed `0/1/2/3/4/>=5`.
- Opening tax is buy-only. The only exemption is the one factory-only initial buy within canonical `launchTokenAndBuy`; there is no persistent exempt-wallet mapping.
- Opening tax is calculated after base fee + creator tax and is added to existing `quoteFeeBalance`; creator tax remains in `creatorTaxBalance`.
- Final crossing fill uses the ratified two-stage full-precision ceiling gross-up and must reduce to accepted Day-3 rounding when snipe bps is zero.
- Emergency ordering is `NORMAL < NO_NEW_LAUNCHES < BUY_PAUSED < TRADING_PAUSED`; `graduationPaused` is independent. Guardian only tightens; Protocol Admin alone loosens/unpauses.
- Guardian gets no transfer/arbitrary-call/upgrade/FeePolicy/launch-fee/recipient/tax/timestamp/exemption/deployer/economics setter.
- Production admin target remains a 2-of-3 Safe. Tests prove contract-owner/multisig compatibility; they do not claim that a test EOA is production-complete.
- Every production-facing behavior begins with a behavior-specific RED. Syntax/configuration failures do not count as RED.
- `LOCAL_COMPONENT_PASS != DAY_4_PASS`. Day 4 closes only after integrated exact-head CI, guarded merge, and fresh merged-main closeout.

## File Structure Freeze

### Create

- `config/protocol/day4-launch-control-source-inventory.json` — ratified source/reference provenance and Day-4 frozen identifiers; no runtime economics defaults.
- `contracts/src/interfaces/IBreadLaunchFactory.sol` — canonical Day-4 launch structs, launch views and launch entrypoints.
- `contracts/src/interfaces/IBreadEmergencyController.sol` — restriction enum and read interface consumed by Factory/curve.
- `contracts/src/factory/BreadLaunchDeployer.sol` — factory-only token/curve deployment + metadata caps.
- `contracts/src/factory/BreadLaunchFactory.sol` — launch config/economics digest/records/launch-fee/Launch+Buy orchestration.
- `contracts/src/security/BreadEmergencyController.sol` — restriction state and roles only.
- `contracts/test/helpers/BreadDay4Actors.sol` — external caller/admin/guardian actors and pre-controller open restriction stub.
- `contracts/test/helpers/BreadDay4Fixture.sol` — canonical-USDC Day-4 fixture shared by integration/invariant tests.
- `contracts/test/BreadLaunchFactory.t.sol` — Factory/Deployer/config/digest/metadata/record tests.
- `contracts/test/BreadLaunchFee.t.sol` — canonical-USDC launch-fee/FeeEscrow/rollback tests.
- `contracts/test/BreadLaunchAndBuy.t.sol` — atomic lifecycle/slippage/refund/allowance/custody tests.
- `contracts/test/BreadOpeningProtection.t.sol` — deterministic formula/timestamp/exemption/routing/final-fill tests.
- `contracts/test/BreadOpeningProtectionInvariant.t.sol` — INV-040–044 fuzz/invariant tests.
- `contracts/test/BreadEmergencyController.t.sol` — role/state/guardian/admin tests.
- `contracts/test/BreadDay4Integration.t.sol` — real Factory + curve + escrow + emergency vertical-flow tests.
- `contracts/test/BreadDay4Invariant.t.sol` — integrated Day-1–Day-4 stateful invariant handler.
- `docs/evidence/day4-factory-launch-buy-snipe-emergency.md` — exact RED/GREEN/CI/security evidence.
- `contracts/test/Day4CloseoutPresence.t.sol` — fresh post-merge closeout presence test, created only after implementation merge.

### Modify

- `contracts/src/core/BreadBondingCurve.sol` — minimal shared-buy refactor, factory-only launch buy, timestamp/opening-tax logic, snipe accounting/event, emergency buy/sell gates.
- `contracts/test/BreadBondingCurveTrading.t.sol` — constructor/zero-snipe Day-3 compatibility coverage after Day-4 constructor integration.
- `contracts/test/BreadTradingFeeEscrowIntegration.t.sol` — opening-tax/Factory-launched curve fee-sweep integration without changing FeeEscrow ledger semantics.
- `contracts/test/BreadFinalBuyInvariant.t.sol` — prove zero-snipe behavior remains Day-3-compatible and opening-tax crossing rule preserves reserved floor.
- `contracts/test/BreadTradingInvariant.t.sol` — include elapsed-time ordinary buys without weakening prior invariants.
- `contracts/test/BreadTradingSecurity.t.sol` — emergency/reentry/refund/unauthorized factory-entry regressions.
- `scripts/validation/validate-all.mjs` — call Day-4 source/config validation.
- `docs/current-build-state.yaml` — checkpoint/commit/gates after accepted slices and closeout.

### Explicitly unchanged in Day 4

- `contracts/src/libraries/BreadBondingCurveMath.sol`
- `contracts/src/core/BreadTrackedCurveState.sol`
- `contracts/src/BreadLaunchToken.sol`
- `contracts/src/fees/BreadFeePolicy.sol`
- `contracts/src/fees/BreadFeeEscrow.sol`
- `contracts/src/interfaces/IBreadFeePolicy.sol`
- `contracts/src/interfaces/IBreadFeeEscrow.sol`

---

### Task 0: Integrate the ratified preflight documentation before production work

**Files:**
- Existing: `docs/superpowers/specs/2026-08-08-day4-factory-launch-buy-snipe-emergency-design.md`
- Existing: `docs/source-reconciliation/day4-project-source-v1.4-promotion.md`
- Existing: `docs/current-build-state.yaml`
- This plan: `docs/superpowers/plans/2026-08-08-day4-factory-launch-buy-snipe-emergency.md`

**Interfaces:**
- Consumes: accepted `main` `c6fcb53c854e45843b60720e3be859a49965bad2`.
- Produces: a docs-only verified `main` descendant from which the production branch is created.

- [ ] **Step 1: Verify preflight branch is docs-only relative to accepted main**

Run through Git/GitHub compare:

```bash
git diff --name-only c6fcb53c854e45843b60720e3be859a49965bad2...HEAD
```

Expected files are only the Day-4 spec, ratification/promotion record, this plan and `docs/current-build-state.yaml`. Any Solidity/config/runtime/test file blocks this gate.

- [ ] **Step 2: Run repository validation on the exact preflight head**

```bash
pnpm validate
pnpm test
pnpm lint
pnpm typecheck
pnpm build
cd contracts && forge test -vvv
```

Expected: every command PASS; Foundry remains the accepted Day-3 suite because production code is unchanged.

- [ ] **Step 3: Open a docs-only PR to `main`, require exact-head CI and merge with expected-head protection**

Record exact candidate SHA and workflow run IDs. Required GitHub jobs remain `bootstrap-validation`, `dependency-build`, `foundry-bootstrap`, and `infrastructure-health` if the workflow remains unchanged.

- [ ] **Step 4: Verify merged `main` contains RATIFIED source state and this plan**

```bash
git show main:docs/source-reconciliation/day4-project-source-v1.4-promotion.md | grep 'PROJECT_SOURCE_RATIFICATION_FOR_DAY4_PRODUCTION = RATIFIED'
git show main:docs/superpowers/plans/2026-08-08-day4-factory-launch-buy-snipe-emergency.md >/dev/null
```

- [ ] **Step 5: Create production execution branch from that exact merged main**

```bash
git switch main
git pull --ff-only
git switch -c checkpoint/day4-launch-control
```

Expected: branch base is the verified docs-only main descendant; production work never starts from the older implementation-only Day-3 commit.

---

### Task 1: Freeze Day-4 interfaces/source inventory and capture Factory/Deployer RED

**Files:**
- Create: `config/protocol/day4-launch-control-source-inventory.json`
- Create: `contracts/src/interfaces/IBreadLaunchFactory.sol`
- Create: `contracts/src/interfaces/IBreadEmergencyController.sol`
- Create: `contracts/test/helpers/BreadDay4Actors.sol`
- Create: `contracts/test/BreadLaunchFactory.t.sol`
- Production files intentionally absent during RED:
  - `contracts/src/factory/BreadLaunchFactory.sol`
  - `contracts/src/factory/BreadLaunchDeployer.sol`

**Interfaces:**
- Consumes: `BreadFeePolicySnapshot`, `IBreadFeePolicy`, `IBreadFeeEscrow`, existing `BreadLaunchToken` metadata fields.
- Produces: frozen structs/signatures used by all later tasks.

Use this interface shape:

```solidity
interface IBreadLaunchFactory {
    struct LaunchConfig {
        uint256 supply;
        uint256 phantomQuote;
        uint256 graduationThreshold;
        uint256 launchFeeUsdc;
        bool enabled;
    }

    struct LaunchParams {
        string name;
        string symbol;
        string logo;
        string description;
        string twitter;
        string telegram;
        string discord;
        string website;
        string farcaster;
        address creatorFeeRecipient;
        uint16 creatorTaxBps;
        bytes32 expectedEconomics;
    }

    struct LaunchRecord {
        address token;
        address curve;
        address deployer;
        address creatorFeeRecipient;
        uint16 creatorTaxBps;
        bytes32 economicsDigest;
        uint64 launchTimestamp;
        uint64 configVersion;
    }

    function previewLaunchEconomics() external view returns (bytes32 digest);
    function currentLaunchConfig() external view returns (LaunchConfig memory config, uint64 version);
    function getLaunch(address token) external view returns (LaunchRecord memory record);
    function tokenForCurve(address curve) external view returns (address token);
    function launchToken(LaunchParams calldata params) external returns (address token, address curve);
    function launchTokenAndBuy(
        LaunchParams calldata params,
        uint256 quoteIn,
        uint256 minTokensOut,
        address recipient
    ) external returns (address token, address curve, uint256 tokensOut);
}
```

Freeze the restriction read interface:

```solidity
interface IBreadEmergencyController {
    enum RestrictionMode {
        NORMAL,
        NO_NEW_LAUNCHES,
        BUY_PAUSED,
        TRADING_PAUSED
    }

    function restrictionMode() external view returns (RestrictionMode mode);
    function graduationPaused() external view returns (bool paused);
    function launchesAllowed() external view returns (bool allowed);
    function buysAllowed() external view returns (bool allowed);
    function sellsAllowed() external view returns (bool allowed);
}
```

- [ ] **Step 1: Record the ratified provenance and identifiers**

`day4-launch-control-source-inventory.json` must record:

```json
{
  "projectSourcePack": "v1.4-day4-design",
  "acceptedMain": "c6fcb53c854e45843b60720e3be859a49965bad2",
  "approvedDesign": "324b6055a0bed278766e1b48016774ac745b3781",
  "ponsReference": {
    "repo": "ponsdotdev/ponsfamily",
    "commit": "d5491e20be56051a68abf47136f6890c3ce3ff7d",
    "factory": "contractsV2/src/v2/PonsV2LaunchFactory.sol",
    "deployer": "contractsV2/src/v2/PonsV2LaunchDeployer.sol",
    "role": "REFERENCE_ONLY"
  },
  "clankerOpeningReference": {
    "repo": "clanker-devco/v4-contracts",
    "commit": "b004c2edda29fa282a16d5d1441a26484f70b37f",
    "path": "src/mev-modules/ClankerMevDescendingFees.sol",
    "role": "REFERENCE_ONLY"
  },
  "openingPolicy": {
    "startingBps": 9900,
    "durationSeconds": 5,
    "terminalBps": 0,
    "routing": "QUOTE_FEE_BALANCE"
  }
}
```

- [ ] **Step 2: Write Factory/Deployer RED tests**

Cover exact launch config validation, disabled launch, zero creator recipient, empty name/symbol, stale non-zero economics digest, digest mutation on every bound economic field, digest stability on unrelated operational state, deployer-only-factory protection, token full-supply-to-curve, curve initialization, launch record contents and metadata upper bounds `64/16/512/2048/256` bytes.

Representative RED:

```solidity
function testLaunchRecordsPinnedEconomicsAndCanonicalPair() public {
    bytes32 expected = factory.previewLaunchEconomics();
    IBreadLaunchFactory.LaunchParams memory p = _params(expected);

    (address token, address curve) = factory.launchToken(p);
    IBreadLaunchFactory.LaunchRecord memory record = factory.getLaunch(token);

    assert(record.curve == curve);
    assert(record.deployer == address(this));
    assert(record.economicsDigest == expected);
    assert(BreadBondingCurve(curve).pairToken() == address(usdc));
    assert(BreadLaunchToken(token).balanceOf(curve) == config.supply);
}
```

- [ ] **Step 3: Run RED**

```bash
cd contracts
forge test --match-contract BreadLaunchFactoryTest -vvv
```

Expected: FAIL because `BreadLaunchFactory` / `BreadLaunchDeployer` do not exist. Existing unrelated tests must still compile/pass when run separately.

- [ ] **Step 4: Commit the behavior-specific RED**

```bash
git add config/protocol/day4-launch-control-source-inventory.json contracts/src/interfaces contracts/test/BreadLaunchFactory.t.sol contracts/test/helpers/BreadDay4Actors.sol
git commit -m "test: capture Day 4 factory and deployer red"
```

---

### Task 2: Implement Factory/Deployer launch-only lifecycle and economics pin

**Files:**
- Create: `contracts/src/factory/BreadLaunchDeployer.sol`
- Create: `contracts/src/factory/BreadLaunchFactory.sol`
- Modify: `contracts/test/BreadLaunchFactory.t.sol`

**Interfaces:**
- Consumes: Task-1 `IBreadLaunchFactory`; current Day-3 curve/token/FeePolicy/FeeEscrow.
- Produces: `setLaunchDeployer`, `setLaunchConfig`, `previewLaunchEconomics`, `launchToken`, canonical launch record/event.

Use factory-only deployer input:

```solidity
struct BreadLaunchDeployment {
    address usdc;
    address creatorFeeRecipient;
    address originalDeployer;
    address factory;
    address feePolicy;
    address feeEscrow;
    uint256 phantomQuote;
    uint16 creatorTaxBps;
    uint256 graduationThreshold;
    uint256 supply;
    string name;
    string symbol;
    string logo;
    string description;
    string twitter;
    string telegram;
    string discord;
    string website;
    string farcaster;
}
```

`BreadLaunchDeployer` core:

```solidity
address public immutable factory;

modifier onlyFactory() {
    if (msg.sender != factory) revert NotFactory();
    _;
}

function deployLaunch(BreadLaunchDeployment calldata p)
    external
    onlyFactory
    returns (address token, address curve)
{
    _requireMetadataWithinLimits(p);
    curve = address(new BreadBondingCurve(
        p.usdc,
        p.creatorFeeRecipient,
        p.factory,
        p.feePolicy,
        p.feeEscrow,
        p.phantomQuote,
        p.creatorTaxBps,
        p.graduationThreshold
    ));
    BreadLaunchToken.Socials memory socials = BreadLaunchToken.Socials({
        twitter: p.twitter,
        telegram: p.telegram,
        discord: p.discord,
        website: p.website,
        farcaster: p.farcaster
    });
    token = address(new BreadLaunchToken(
        p.name, p.symbol, p.logo, p.description, socials,
        p.originalDeployer, curve, p.factory, p.supply
    ));
}
```

Factory uses one-time post-deploy wiring to avoid a Factory/Deployer constructor cycle:

```solidity
function setLaunchDeployer(BreadLaunchDeployer next) external onlyOwner {
    if (address(launchDeployer) != address(0)) revert LaunchDeployerAlreadySet();
    if (address(next).code.length == 0 || next.factory() != address(this)) revert InvalidLaunchDeployer();
    launchDeployer = next;
    emit LaunchDeployerSet(address(next));
}
```

Economics digest must be exactly:

```solidity
keccak256(abi.encode(
    address(usdc),
    config.supply,
    config.phantomQuote,
    config.graduationThreshold,
    policy.protocolFeeRecipient,
    policy.tradeFeeBps,
    policy.protocolFeeShareBps,
    policy.maxCreatorTaxBps,
    config.launchFeeUsdc,
    stackVersion,
    configVersion,
    uint16(9900),
    uint8(5),
    uint16(0),
    OPENING_PROTECTION_POLICY_ID,
    OPENING_TAX_ROUTING_ID
));
```

- [ ] **Step 1: Implement only enough launch-only code to satisfy the RED**

Factory constructor receives explicit owner, canonical USDC, FeePolicy, FeeEscrow, initial `LaunchConfig`, `bytes32 stackVersion`. It starts from the explicit config's `enabled` value; tests should normally use disabled until deployer wiring is complete.

- [ ] **Step 2: Enforce current policy and launch config without guessing values**

Reject zero dependencies, zero supply/phantom/threshold, empty stack version, invalid creator recipient/name/symbol, creator tax above current policy max, disabled launch, missing deployer, and stale non-zero `expectedEconomics`.

- [ ] **Step 3: Deploy pair, initialize curve, write one canonical record**

```solidity
(address token, address curve) = launchDeployer.deployLaunch(deployment);
BreadBondingCurve(curve).initialize(token);
uint64 launchedAt = uint64(block.timestamp);
_launches[token] = LaunchRecord({
    token: token,
    curve: curve,
    deployer: msg.sender,
    creatorFeeRecipient: params.creatorFeeRecipient,
    creatorTaxBps: params.creatorTaxBps,
    economicsDigest: digest,
    launchTimestamp: launchedAt,
    configVersion: configVersion
});
_tokenForCurve[curve] = token;
```

- [ ] **Step 4: Prove future config cannot rewrite an old launch**

After `setLaunchConfig(next)` increments `configVersion`, old token/curve supply, phantom quote, threshold, FeePolicy snapshot, creator tax, launch record digest and timestamp must remain unchanged.

- [ ] **Step 5: Run focused and adjacent GREEN**

```bash
cd contracts
forge test --match-contract BreadLaunchFactoryTest -vvv
forge test --match-contract BreadBondingCurveTradingTest -vvv
forge test --match-contract BreadTradingFeeEscrowIntegrationTest -vvv
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add contracts/src/factory contracts/src/interfaces/IBreadLaunchFactory.sol contracts/test/BreadLaunchFactory.t.sol
git commit -m "feat: add Bread launch factory and deployer"
```

---

### Task 3: TDD exact canonical-USDC launch-fee credit and rollback

**Files:**
- Create: `contracts/test/BreadLaunchFee.t.sol`
- Modify: `contracts/src/factory/BreadLaunchFactory.sol`
- Modify: `contracts/test/helpers/BreadDay4Actors.sol`

**Interfaces:**
- Consumes: existing `IBreadFeeEscrow.credit(address,uint256)` and `authorizedCreditor(address)`.
- Produces: exact `launchFeeUsdc` custody → protocol FeeEscrow credit with no Factory residual.

No FeeEscrow ABI change is permitted in this task.

- [ ] **Step 1: Write launch-fee RED**

Tests must cover:

```solidity
function testNonZeroLaunchFeeCreditsSnapshottedProtocolRecipientAndLeavesNoFactoryCustody() public {
    uint256 beforeFactory = usdc.balanceOf(address(factory));
    uint256 beforeEscrow = usdc.balanceOf(address(escrow));
    usdc.mint(address(this), config.launchFeeUsdc);
    assert(usdc.approve(address(factory), config.launchFeeUsdc));

    factory.launchToken(_params(factory.previewLaunchEconomics()));

    assert(usdc.balanceOf(address(factory)) == beforeFactory);
    assert(usdc.balanceOf(address(escrow)) == beforeEscrow + config.launchFeeUsdc);
    assert(escrow.balanceOf(PROTOCOL_RECIPIENT) == config.launchFeeUsdc);
}
```

Also prove zero-fee launch takes no USDC, unauthorized Factory creditor causes whole launch to revert with no durable token/record, short-transfer canonical-asset fixture rejects, FeeEscrow credit failure rolls back deployment, and stale economics pin reverts before custody is durable.

- [ ] **Step 2: Run RED against launch-only Factory**

```bash
cd contracts
forge test --match-contract BreadLaunchFeeTest -vvv
```

Expected: launch-fee assertions fail because Factory does not collect/credit fee.

- [ ] **Step 3: Implement exact per-intent custody**

```solidity
uint256 factoryBalanceBefore = usdc.balanceOf(address(this));
if (config.launchFeeUsdc != 0) {
    uint256 receivedBefore = usdc.balanceOf(address(this));
    usdc.safeTransferFrom(msg.sender, address(this), config.launchFeeUsdc);
    uint256 received = usdc.balanceOf(address(this)) - receivedBefore;
    if (received != config.launchFeeUsdc) revert UnexpectedReceivedAmount(config.launchFeeUsdc, received);
}
```

- [ ] **Step 4: Credit launch fee through canonical escrow after pair creation but inside same transaction**

```solidity
if (config.launchFeeUsdc != 0) {
    usdc.forceApprove(address(feeEscrow), config.launchFeeUsdc);
    feeEscrow.credit(policy.protocolFeeRecipient, config.launchFeeUsdc);
    usdc.forceApprove(address(feeEscrow), 0);
    emit LaunchFeeCredited(token, policy.protocolFeeRecipient, config.launchFeeUsdc);
}
if (usdc.balanceOf(address(this)) != factoryBalanceBefore) revert ResidualFactoryCustody();
```

The Factory must already be owner-authorized in FeeEscrow. Do not auto-authorize itself.

- [ ] **Step 5: Run focused + escrow regression GREEN**

```bash
cd contracts
forge test --match-contract BreadLaunchFeeTest -vvv
forge test --match-contract BreadFeeEscrowTest -vvv
forge test --match-contract BreadFeeEscrowInvariantTest -vvv
```

- [ ] **Step 6: Commit**

```bash
git add contracts/src/factory/BreadLaunchFactory.sol contracts/test/BreadLaunchFee.t.sol contracts/test/helpers/BreadDay4Actors.sol
git commit -m "feat: route launch fees through canonical escrow"
```

---

### Task 4: TDD atomic Launch+Buy over the canonical curve path

**Files:**
- Create: `contracts/test/BreadLaunchAndBuy.t.sol`
- Modify: `contracts/src/core/BreadBondingCurve.sol`
- Modify: `contracts/src/factory/BreadLaunchFactory.sol`
- Modify: `contracts/test/BreadBondingCurveTrading.t.sol`
- Modify: `contracts/test/BreadTradingSecurity.t.sol`

**Interfaces:**
- Consumes: current Day-3 public `buy(uint256,uint256,address)`.
- Produces additive Factory-only `buyForLaunch` while preserving the public `buy` ABI.

Factory-only curve surface:

```solidity
function buyForLaunch(uint256 quoteIn, uint256 minTokensOut, address recipient)
    external
    nonReentrant
    returns (uint256 tokensOut, uint256 spent, uint256 refund);
```

At this task snipe bps is still zero for all paths; Task 5 specializes ordinary buys.

- [ ] **Step 1: Write atomic lifecycle RED**

Cover exact total custody `launchFeeUsdc + quoteIn`, zero quote reject, zero recipient reject, exact token delivery, `minTokensOut` rollback, final crossing refund returned to the original user, Factory balance restored to pre-intent balance, allowance cleared, refund transfer failure rollback, deployment/initialization/buy failure rollback, and no launch record/token remains durable after a failed initial buy.

- [ ] **Step 2: Run RED**

```bash
cd contracts
forge test --match-contract BreadLaunchAndBuyTest -vvv
```

Expected: FAIL because `launchTokenAndBuy` / `buyForLaunch` do not exist.

- [ ] **Step 3: Refactor current curve buy into one internal authority**

Preserve public ABI:

```solidity
function buy(uint256 quoteIn, uint256 minTokensOut, address recipient)
    external
    nonReentrant
    returns (uint256 tokensOut)
{
    (tokensOut,,) = _buy(quoteIn, minTokensOut, recipient, 0, false);
}

function buyForLaunch(uint256 quoteIn, uint256 minTokensOut, address recipient)
    external
    nonReentrant
    returns (uint256 tokensOut, uint256 spent, uint256 refund)
{
    if (msg.sender != factory) revert UnauthorizedFactory();
    return _buy(quoteIn, minTokensOut, recipient, 0, true);
}
```

`_buy` contains the existing Day-3 pricing/clamp/slippage/state/refund path. Task 4 must not change zero-snipe numeric outputs.

- [ ] **Step 4: Implement Factory atomic orchestration without pricing duplication**

```solidity
uint256 factoryBalanceBefore = usdc.balanceOf(address(this));
uint256 totalIn = config.launchFeeUsdc + quoteIn;
_receiveExactUsdc(msg.sender, totalIn);
(address token, address curve, BreadFeePolicySnapshot memory policy) = _deployAndInitialize(params, digest);
_creditLaunchFee(token, policy.protocolFeeRecipient, config.launchFeeUsdc);
usdc.forceApprove(curve, quoteIn);
(uint256 tokensOut, uint256 spent, uint256 refund) =
    BreadBondingCurve(curve).buyForLaunch(quoteIn, minTokensOut, recipient);
usdc.forceApprove(curve, 0);
if (refund != 0) usdc.safeTransfer(msg.sender, refund);
if (usdc.balanceOf(address(this)) != factoryBalanceBefore) revert ResidualFactoryCustody();
emit LaunchAndBuyExecuted(msg.sender, token, curve, recipient, quoteIn, spent, refund, tokensOut);
```

- [ ] **Step 5: Prove Day-3 zero-snipe compatibility**

Existing deterministic ordinary/final buy tests must return byte-for-byte-equivalent amounts, fee/tax buckets, trackedQuote, trackedTokens and refunds when the Day-4 opening tax is not yet active.

- [ ] **Step 6: Run focused + Day-3 regression GREEN**

```bash
cd contracts
forge test --match-contract BreadLaunchAndBuyTest -vvv
forge test --match-contract BreadBondingCurveTradingTest -vvv
forge test --match-contract BreadFinalBuyInvariantTest -vvv
forge test --match-contract BreadTradingSecurityTest -vvv
```

- [ ] **Step 7: Commit**

```bash
git add contracts/src/core/BreadBondingCurve.sol contracts/src/factory/BreadLaunchFactory.sol contracts/test/BreadLaunchAndBuy.t.sol contracts/test/BreadBondingCurveTrading.t.sol contracts/test/BreadTradingSecurity.t.sol
git commit -m "feat: add atomic Bread launch and buy"
```

---

### Task 5: TDD exact opening-tax formula, timestamp, one-call exemption and fee routing

**Files:**
- Create: `contracts/test/BreadOpeningProtection.t.sol`
- Modify: `contracts/src/core/BreadBondingCurve.sol`
- Modify: `contracts/test/BreadTradingFeeEscrowIntegration.t.sol`

**Interfaces:**
- Consumes: Task-4 shared `_buy` path.
- Produces: `launchTimestamp`, `currentSnipeTaxBps`, `launchBuyExemptionConsumed`, `OpeningProtectionApplied` event.

Use exact constants:

```solidity
uint16 public constant STARTING_SNIPE_TAX_BPS = 9_900;
uint8 public constant SNIPE_DURATION_SECONDS = 5;
uint16 public constant TERMINAL_SNIPE_TAX_BPS = 0;
uint256 private constant BASIS_POINTS = 10_000;

uint64 public launchTimestamp;
bool public launchBuyExemptionConsumed;
```

- [ ] **Step 1: Write deterministic RED vectors**

```solidity
function testExactSnipeVector() public {
    assert(curve.currentSnipeTaxBps() == 9900);
    vm.warp(uint256(curve.launchTimestamp()) + 1); assert(curve.currentSnipeTaxBps() == 6336);
    vm.warp(uint256(curve.launchTimestamp()) + 2); assert(curve.currentSnipeTaxBps() == 3564);
    vm.warp(uint256(curve.launchTimestamp()) + 3); assert(curve.currentSnipeTaxBps() == 1584);
    vm.warp(uint256(curve.launchTimestamp()) + 4); assert(curve.currentSnipeTaxBps() == 396);
    vm.warp(uint256(curve.launchTimestamp()) + 5); assert(curve.currentSnipeTaxBps() == 0);
    vm.warp(uint256(curve.launchTimestamp()) + 6); assert(curve.currentSnipeTaxBps() == 0);
}
```

Also RED-test: timestamp set exactly once on `initialize`, no reset, ordinary buy taxed, sell unaffected, launch-only no initial buy creates no active exemption, `buyForLaunch` factory-only, second exempt call rejected, creator/launcher/recipient have no later exemption, and opening tax goes to `quoteFeeBalance` rather than `creatorTaxBalance` or a new ledger.

- [ ] **Step 2: Run RED**

```bash
cd contracts
forge test --match-contract BreadOpeningProtectionTest -vvv
```

- [ ] **Step 3: Set timestamp on one-shot initialization**

```solidity
function initialize(address token_) external {
    if (msg.sender != factory) revert UnauthorizedFactory();
    _initializeTrackedCurve(token_);
    launchTimestamp = uint64(block.timestamp);
}
```

There is no timestamp setter.

- [ ] **Step 4: Implement exact bps function**

```solidity
function currentSnipeTaxBps() public view returns (uint16) {
    uint256 elapsed = block.timestamp - uint256(launchTimestamp);
    if (elapsed >= SNIPE_DURATION_SECONDS) return 0;
    uint256 remaining = SNIPE_DURATION_SECONDS - elapsed;
    return uint16(uint256(STARTING_SNIPE_TAX_BPS) * remaining * remaining / 25);
}
```

`NotInitialized` must prevent a pre-initialization call from being interpreted as a live launch window.

- [ ] **Step 5: Apply exact charge order in ordinary buys**

```solidity
uint256 baseFee = spent * tradeFeeBps / BASIS_POINTS;
uint256 creatorTax = spent * creatorTaxBps / BASIS_POINTS;
uint256 afterStandard = spent - baseFee - creatorTax;
uint256 snipeTax = afterStandard * snipeTaxBps / BASIS_POINTS;
uint256 netCurveInput = afterStandard - snipeTax;
```

Price tokens only from `netCurveInput`. Accounting:

```solidity
quoteFeeBalance += baseFee + snipeTax;
creatorTaxBalance += creatorTax;
trackedQuote += spent;
```

- [ ] **Step 6: Enforce one-call launch exemption**

`buyForLaunch` requires Factory, same launch timestamp and `launchBuyExemptionConsumed == false`; set the consumed latch before entering external transfer effects. It passes `snipeTaxBps = 0`. The latch is not an address grant and never permits a later public caller.

- [ ] **Step 7: Emit separate observability event without changing canonical ledgers**

```solidity
event OpeningProtectionApplied(
    address indexed buyer,
    address indexed recipient,
    uint16 taxBps,
    uint256 taxAmount,
    bool launchBuyExempt
);
```

Emit on every successful buy, including zero-bps post-expiry and exempt Launch+Buy.

- [ ] **Step 8: Prove sweep routing**

After an ordinary opening-window buy, Protocol Admin test fixture authorizes the launched curve using existing `feeEscrow.setAuthorizedCreditor(curve, true)`, then `sweepFees()` must split `baseFee + snipeTax` by snapshotted `protocolFeeShareBps` while creator tax stays entirely creator-side.

- [ ] **Step 9: Run focused GREEN**

```bash
cd contracts
forge test --match-contract BreadOpeningProtectionTest -vvv
forge test --match-contract BreadTradingFeeEscrowIntegrationTest -vvv
```

- [ ] **Step 10: Commit**

```bash
git add contracts/src/core/BreadBondingCurve.sol contracts/test/BreadOpeningProtection.t.sol contracts/test/BreadTradingFeeEscrowIntegration.t.sol
git commit -m "feat: add Bread opening protection"
```

---

### Task 6: TDD final crossing fill under the two-stage snipe gross-up

**Files:**
- Modify: `contracts/src/core/BreadBondingCurve.sol`
- Extend: `contracts/test/BreadOpeningProtection.t.sol`
- Modify: `contracts/test/BreadFinalBuyInvariant.t.sol`

**Interfaces:**
- Consumes: current `BreadBondingCurveMath.getAmountIn` and `Math.mulDiv(..., Math.Rounding.Ceil)`.
- Produces: exact ratified crossing-fill behavior with/without opening tax.

- [ ] **Step 1: Write RED for each elapsed-second tax vector crossing the reserved floor**

For `t = 0,1,2,3,4,5`, force offered quote above the final-fill requirement and assert exact sellable output, reserved floor, `spent <= received`, refund `received - spent`, and `netCurveInput >= netRequired`.

- [ ] **Step 2: Write one-unit/boundary RED**

Cover gross requirement minus one, exact gross requirement, plus one, six-decimal USDC one-unit rounding, and too-strict clamped slippage rollback.

- [ ] **Step 3: Run RED**

```bash
cd contracts
forge test --match-contract BreadOpeningProtectionTest --match-test 'test.*Final|test.*Crossing' -vvv
forge test --match-contract BreadFinalBuyInvariantTest -vvv
```

Expected: current single gross-up underfunds or misaccounts snipe-tax crossing cases.

- [ ] **Step 4: Implement exact two-stage full-precision gross-up**

```solidity
uint256 netRequired = BreadBondingCurveMath.getAmountIn(
    available,
    quoteReserve_,
    tokenReserve_,
    0
);
uint256 afterStandardRequired = Math.mulDiv(
    netRequired,
    BASIS_POINTS,
    BASIS_POINTS - uint256(snipeTaxBps),
    Math.Rounding.Ceil
);
uint256 grossRequired = Math.mulDiv(
    afterStandardRequired,
    BASIS_POINTS,
    BASIS_POINTS - uint256(tradeFeeBps) - uint256(creatorTaxBps),
    Math.Rounding.Ceil
);
spent = Math.min(grossRequired, received);
```

Then recompute all floor charges from exact `spent` and require computed `netCurveInput >= netRequired` before transferring exactly `available` tokens.

- [ ] **Step 5: Preserve accepted Day-3 zero-snipe semantics**

At `snipeTaxBps == 0`, assert the first gross-up is identity and exact `spent/refund/fee/tax` equals the pre-Day-4 deterministic final-buy vector.

- [ ] **Step 6: Run GREEN + no-extraction fuzz**

```bash
cd contracts
forge test --match-contract BreadOpeningProtectionTest -vvv
forge test --match-contract BreadFinalBuyInvariantTest -vvv
forge test --match-contract BreadTradingInvariantTest -vvv
```

- [ ] **Step 7: Commit**

```bash
git add contracts/src/core/BreadBondingCurve.sol contracts/test/BreadOpeningProtection.t.sol contracts/test/BreadFinalBuyInvariant.t.sol
git commit -m "fix: apply exact snipe final-fill gross-up"
```

---

### Task 7: TDD EmergencyController and wire the same restriction oracle into Factory/curve

**Files:**
- Create: `contracts/src/security/BreadEmergencyController.sol`
- Create: `contracts/test/BreadEmergencyController.t.sol`
- Modify: `contracts/src/factory/BreadLaunchFactory.sol`
- Modify: `contracts/src/factory/BreadLaunchDeployer.sol`
- Modify: `contracts/src/core/BreadBondingCurve.sol`
- Modify: existing direct-curve test fixtures to inject an always-open test controller.

**Interfaces:**
- Consumes: Task-1 `IBreadEmergencyController`.
- Produces: `restrictionMode`, `graduationPaused`, `guardian`, admin/guardian transitions, allow-view helpers.

Concrete mutation surface:

```solidity
function setRestrictionMode(IBreadEmergencyController.RestrictionMode next) external;
function setGraduationPaused(bool paused) external;
function setGuardian(address nextGuardian) external onlyOwner;
```

- [ ] **Step 1: Write role/state RED**

Tests must prove Guardian can jump/equal only upward, cannot lower/unpause, can set graduation pause false→true only, cannot clear it, unauthorized caller cannot mutate, Protocol Admin can move either direction, admin can clear graduation pause, guardian rotation is admin-only, zero guardian rejects, and renouncing ownership is disabled so restrictions cannot become permanently uncleareable.

- [ ] **Step 2: Write consumer-gate RED**

Exact expectations:

```text
NORMAL            launch=yes buy=yes sell=yes
NO_NEW_LAUNCHES   launch=no  buy=yes sell=yes
BUY_PAUSED        launch=no  buy=no  sell=yes
TRADING_PAUSED    launch=no  buy=no  sell=no
```

Existing launch snapshots/timestamps must remain unchanged across every emergency transition.

- [ ] **Step 3: Run RED**

```bash
cd contracts
forge test --match-contract BreadEmergencyControllerTest -vvv
```

- [ ] **Step 4: Implement restriction-only controller**

```solidity
function setRestrictionMode(RestrictionMode next) external {
    RestrictionMode previous = restrictionMode;
    if (msg.sender == owner()) {
        restrictionMode = next;
    } else if (msg.sender == guardian) {
        if (uint8(next) < uint8(previous)) revert GuardianCannotReduceRestriction();
        restrictionMode = next;
    } else {
        revert UnauthorizedEmergencyActor();
    }
    emit RestrictionModeUpdated(msg.sender, previous, next);
}
```

`setGraduationPaused(false)` succeeds only for owner. Guardian may only set `true`. `setGuardian` is owner-only and emits previous/next guardian. Override `renounceOwnership` to revert.

- [ ] **Step 5: Wire Factory launch gate**

Factory stores immutable `IBreadEmergencyController emergencyController`. Before either launch surface:

```solidity
if (!emergencyController.launchesAllowed()) revert LaunchesRestricted();
```

- [ ] **Step 6: Wire curve buy/sell gates**

Curve stores immutable controller. Public buy and `buyForLaunch` require `buysAllowed()`. Sell requires `sellsAllowed()`. No emergency state is copied into curve accounting.

- [ ] **Step 7: Update direct Day-3 fixtures without weakening integration proof**

Existing unit tests may inject `BreadAlwaysOpenEmergencyController` from `BreadDay4Actors.sol`; Day-4 integration tests must use the real controller.

- [ ] **Step 8: Run focused + all touched regressions**

```bash
cd contracts
forge test --match-contract BreadEmergencyControllerTest -vvv
forge test --match-contract BreadLaunchFactoryTest -vvv
forge test --match-contract BreadLaunchAndBuyTest -vvv
forge test --match-contract BreadBondingCurveTradingTest -vvv
forge test --match-contract BreadTradingSecurityTest -vvv
```

- [ ] **Step 9: Commit**

```bash
git add contracts/src/security/BreadEmergencyController.sol contracts/src/interfaces/IBreadEmergencyController.sol contracts/src/factory contracts/src/core/BreadBondingCurve.sol contracts/test
git commit -m "feat: add restriction-only Bread emergency control"
```

---

### Task 8: Prove the real vertical launch → buy → fee/escrow → emergency path

**Files:**
- Create: `contracts/test/helpers/BreadDay4Fixture.sol`
- Create: `contracts/test/BreadDay4Integration.t.sol`
- Modify: `contracts/test/BreadTradingFeeEscrowIntegration.t.sol`

**Interfaces:**
- Consumes: real Factory, Deployer, curve, FeePolicy, FeeEscrow, EmergencyController.
- Produces: one integrated acceptance fixture with no mocks for those production contracts.

- [ ] **Step 1: Build real fixture with explicit non-live values**

Example fixture values:

```text
ONE_USDC = 1_000_000
SUPPLY = 1_000_000 ether
PHANTOM_QUOTE = 10_000 * ONE_USDC
GRADUATION_THRESHOLD = 100_000 * ONE_USDC
TRADE_FEE_BPS = 100
PROTOCOL_SHARE_BPS = 2_500
MAX_CREATOR_TAX_BPS = 500
CREATOR_TAX_BPS = 500
LAUNCH_FEE_USDC = 10 * ONE_USDC
```

These are test values only and must never be exported as live configuration.

- [ ] **Step 2: Explicitly configure existing FeeEscrow authority**

After Factory deployment/wiring and before non-zero launch-fee tests:

```solidity
escrow.setAuthorizedCreditor(address(factory), true);
```

After each successful launch and before the first curve fee sweep:

```solidity
escrow.setAuthorizedCreditor(address(curve), true);
```

This preserves the ratified Day-3 owner-controlled credit authority. The test must prove unauthorized Factory/curve credit fails before those owner actions.

- [ ] **Step 3: Prove atomic launch+buy + launch-fee credit + opening exemption**

At launch timestamp, the initial Factory buy pays base fee + creator tax but zero opening tax; launch fee is credited to protocol recipient separately; no Factory residual remains.

- [ ] **Step 4: Prove subsequent same-window ordinary buy pays opening tax**

The same user, creator, deployer and token recipient must all receive the same non-exempt treatment. After authorizing the curve, `sweepFees` routes base fee + snipe tax via the existing split and creator tax separately.

- [ ] **Step 5: Prove emergency transitions against the live launch**

Move `NORMAL → NO_NEW_LAUNCHES`: new launch reverts while existing buy/sell works. Move to `BUY_PAUSED`: launch/buy revert while sell works. Move to `TRADING_PAUSED`: launch/buy/sell all revert. Only admin can return to NORMAL.

- [ ] **Step 6: Prove no emergency transition changes financial snapshots**

Snapshot and compare launch digest, `tradeFeeBps`, `protocolFeeShareBps`, `creatorTaxBps`, `phantomQuote`, `graduationThreshold`, `launchTimestamp`, FeeEscrow claims and tracked reserves before/after restriction changes.

- [ ] **Step 7: Run integration GREEN**

```bash
cd contracts
forge test --match-contract BreadDay4IntegrationTest -vvv
forge test --match-contract BreadTradingFeeEscrowIntegrationTest -vvv
```

- [ ] **Step 8: Commit**

```bash
git add contracts/test/helpers/BreadDay4Fixture.sol contracts/test/BreadDay4Integration.t.sol contracts/test/BreadTradingFeeEscrowIntegration.t.sol
git commit -m "test: prove integrated Day 4 launch control path"
```

---

### Task 9: Stateful INV-040–044 / INV-060–063 and adversarial security proof

**Files:**
- Create: `contracts/test/BreadOpeningProtectionInvariant.t.sol`
- Create: `contracts/test/BreadDay4Invariant.t.sol`
- Modify: `contracts/test/BreadTradingInvariant.t.sol`
- Modify: `contracts/test/BreadTradingSecurity.t.sol`

**Interfaces:**
- Consumes: all real Day-4 production contracts.
- Produces: stateful Day-4 financial/admin proof while preserving earlier invariants.

- [ ] **Step 1: Implement opening-protection fuzz assertions**

For bounded arbitrary elapsed time:

```solidity
uint16 tax = curve.currentSnipeTaxBps();
assert(tax <= 9900);
if (elapsed >= 5) assert(tax == 0);
```

For ordered timestamps `a <= b`, assert `tax(a) >= tax(b)`.

- [ ] **Step 2: Prove INV-040–044 under randomized buys/sells/sweeps**

Handler actions: ordinary buy, sell, elapsed-time warp 0–8 seconds, curve fee sweep after owner authorization, creator/protocol claim, direct USDC donation, direct launch-token donation, and failed clamped buy. Assert:

```text
INV-040 snipe tax bounded/nonnegative
INV-041 non-increasing + exact zero at/after 5s
INV-042 sell path never charges opening tax
INV-043 only factory initial buy exemption; no replay/address-derived exemption
INV-044 base fee + opening tax reaches canonical quoteFeeBalance/sweep/FeeEscrow accounting with no disappearance
```

- [ ] **Step 3: Prove INV-060–063 under randomized emergency/config actions**

Handler actions: guardian tighten, guardian graduation pause, admin tighten/loosen, admin guardian rotation, future launch config update. Assert Guardian never decreases mode/clears pause/moves funds/changes economics; only admin decreases; existing launch records/snapshots never change; production-handoff test uses a contract owner to demonstrate multisig-compatible ownership and separately marks an EOA-owned fixture as not production-complete.

- [ ] **Step 4: Add adversarial transaction ordering**

Cover user prepares quote at one mode then guardian tightens before execution; stale economics digest after config update; launch fee short-transfer; refund recipient revert; second `buyForLaunch`; direct call to deployer; direct call to curve initialize; unauthorized creator recipient change.

- [ ] **Step 5: Run invariant/security suite**

```bash
cd contracts
forge test --match-contract BreadOpeningProtectionInvariantTest -vvv
forge test --match-contract BreadDay4InvariantTest -vvv
forge test --match-contract BreadTradingInvariantTest -vvv
forge test --match-contract BreadTradingSecurityTest -vvv
```

Foundry defaults remain 256 fuzz runs and invariant 64 runs × depth 32 from `contracts/foundry.toml`.

- [ ] **Step 6: Run full Foundry regression**

```bash
cd contracts
forge test -vvv
```

Expected: every Day-1 through Day-4 test PASS; no ignored/skipped money-path test.

- [ ] **Step 7: Commit**

```bash
git add contracts/test/BreadOpeningProtectionInvariant.t.sol contracts/test/BreadDay4Invariant.t.sol contracts/test/BreadTradingInvariant.t.sol contracts/test/BreadTradingSecurity.t.sol
git commit -m "test: prove Day 4 financial and emergency invariants"
```

---

### Task 10: Source integrity, diff/security review and exact-head CI

**Files:**
- Modify: `scripts/validation/validate-all.mjs`
- Create/modify Day-4 validator called by `validate-all.mjs`.
- Create: `docs/evidence/day4-factory-launch-buy-snipe-emergency.md`
- Modify: `docs/current-build-state.yaml`

**Interfaces:**
- Consumes: exact implementation candidate head.
- Produces: merge-eligible evidence only if every gate is green.

- [ ] **Step 1: Add executable Day-4 source/config validation**

Validate source inventory required fields, exact frozen reference commits/paths, exact snipe constants/vector identifiers, absence of runtime defaults in the inventory, and presence of ratified Project Source label.

- [ ] **Step 2: Run repository-wide local gate**

```bash
pnpm validate
pnpm test
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
cd contracts && forge test -vvv
```

All must PASS on the same candidate head.

- [ ] **Step 3: Run scope/security diff review**

Explicitly reject candidate if diff contains:

```text
native quote/WETH/Permit2/Universal Router
Day-5 DEX/graduation/locker code
buyback/vesting implementation
CREATE2/predicted-address promise
new FeeEscrow ledger or creditor registrar
new snipe treasury/claim ledger
Guardian fund/economic/dependency authority
hardcoded Arc mainnet/live launchFee/FeePolicy values
current-live Pons parity claim
```

- [ ] **Step 4: Review every external call/state-before-call boundary**

Inspect Factory USDC transfer/approval/credit/refund ordering, curve token/USDC transfer ordering, FeeEscrow credit/sweep rollback, `nonReentrant` surfaces, temporary approvals, final-fill arithmetic denominators and emergency gate placement.

- [ ] **Step 5: Write evidence with exact test counts/commands/commit SHA**

The evidence status remains `CANDIDATE — EXACT-HEAD CI PENDING` until GitHub Actions completes. Never stamp Day-4 PASS from local results.

- [ ] **Step 6: Push candidate and require exact-head GitHub CI**

Require every repository-mandated job green. Record exact run ID and job conclusions in evidence.

- [ ] **Step 7: Guarded merge only the tested head**

Use expected-head protection. If candidate head changes after CI, rerun the full exact-head gate.

- [ ] **Step 8: Verify merged main contains production surfaces and prior Day-3 closeout**

Check `BreadLaunchFactory`, `BreadLaunchDeployer`, `BreadEmergencyController`, modified `BreadBondingCurve`, and all Day-3 canonical FeePolicy/FeeEscrow files from actual merged main.

---

### Task 11: Fresh merged-main Day-4 closeout; Day 5 remains blocked until this passes

**Files:**
- Create from actual merged implementation main: `contracts/test/Day4CloseoutPresence.t.sol`
- Update: `docs/evidence/day4-factory-launch-buy-snipe-emergency.md`
- Update: `docs/current-build-state.yaml`

**Interfaces:**
- Consumes: actual post-implementation `main`, never a stale pre-merge closeout branch.
- Produces: durable Day-4 PASS baseline and exact next action for Day 5 preflight.

- [ ] **Step 1: Create a fresh closeout branch from actual merged main**

```bash
git switch main
git pull --ff-only
git switch -c checkpoint/day4-closeout
```

- [ ] **Step 2: Add presence test importing actual merged Day-4 production contracts**

```solidity
import {BreadLaunchFactory} from "../src/factory/BreadLaunchFactory.sol";
import {BreadLaunchDeployer} from "../src/factory/BreadLaunchDeployer.sol";
import {BreadEmergencyController} from "../src/security/BreadEmergencyController.sol";
import {BreadBondingCurve} from "../src/core/BreadBondingCurve.sol";
import {BreadFeeEscrow} from "../src/fees/BreadFeeEscrow.sol";
import {BreadFeePolicy} from "../src/fees/BreadFeePolicy.sol";
```

Test only compile/presence/integration identity; do not invent new Day-5 behavior in closeout.

- [ ] **Step 3: Run full closeout prerequisite gate**

```bash
pnpm validate
pnpm test
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
cd contracts && forge test -vvv
```

- [ ] **Step 4: Stamp only after prerequisite exact head is green**

Required verdict:

```text
DAY_4_FACTORY_LAUNCH_BUY_SNIPE_EMERGENCY_INTEGRATED_PASS
```

Evidence must include ratified Source Pack `v1.4-day4-design`, implementation merge SHA, prerequisite closeout SHA/run, exact snipe vector, INV-040–044 result, INV-060–063 result, prior regression result and remaining global blockers.

- [ ] **Step 5: Run exact stamped-head CI and guarded merge**

If all required jobs pass, merge only that exact closeout head. Then verify the verdict and presence test from `main`.

- [ ] **Step 6: Write post-closeout handoff from actual main**

`docs/current-build-state.yaml` must set Day 4 `DURABLY_CLOSED`, record exact production/closeout commits and CI run IDs, keep `CURRENT_PONS_FACTORY_SOURCE_PARITY`, `LIVE_RUNTIME_CONFIG`, `PONS_AUDIT_FINDINGS`, `ARC_MAINNET_VALUES` scoped honestly, and set the next checkpoint to **Day 5 — NOT STARTED / preflight only**.

---

## Plan Self-Review Checklist

Before execution begins, verify all of these against Source Pack v1.4 and the approved design:

- [ ] Every Day-4 module named in 06A has a producing task and integration consumer.
- [ ] Factory never duplicates pricing/tracked reserves/fee allocations.
- [ ] FeeEscrow ABI/credit authority remains Day-3 canonical; no registrar is slipped into Day 4.
- [ ] Launch fee is exact canonical USDC → snapshotted protocol FeeEscrow credit with whole-intent rollback.
- [ ] Launch+Buy has exact caller refund, allowance cleanup and per-intent custody restoration.
- [ ] Public buy ABI remains compatible; factory-only exempt buy is additive and one-use.
- [ ] Exact `9900/6336/3564/1584/396/0` vector and exact terminal zero are tested.
- [ ] Opening tax joins `quoteFeeBalance`; creator tax remains separate.
- [ ] Two-stage ceiling gross-up and zero-snipe Day-3 equivalence have deterministic and fuzz tests.
- [ ] Emergency Factory/curve gates use one controller and exact mode semantics.
- [ ] Guardian has no fund/economic/configuration authority and cannot loosen restrictions.
- [ ] Protocol Admin can rotate a compromised guardian and is the only role that can unpause.
- [ ] INV-040–044 and INV-060–063 are explicitly exercised.
- [ ] Every touched Day-1–Day-3 regression family is rerun before merge.
- [ ] No Day-5 scope, live config, Arc-mainnet value or Pons parity claim enters production.
- [ ] Implementation merge and closeout are two separately exact-head-verified stages.

## Execution Order Summary

```text
RATIFIED v1.4 sources
→ commit/self-review this plan
→ docs-only exact-head CI + merge
→ fresh production branch from merged main
→ Factory/Deployer RED→GREEN
→ launch-fee RED→GREEN
→ atomic Launch+Buy RED→GREEN
→ opening formula/routing RED→GREEN
→ final-fill gross-up RED→GREEN
→ EmergencyController + real gate integration RED→GREEN
→ vertical launch/buy/escrow/emergency integration
→ INV-040–044 + INV-060–063 + all prior regressions
→ exact-head CI/security review
→ guarded implementation merge
→ fresh merged-main closeout
→ exact-head closeout CI/merge
→ DAY_4_FACTORY_LAUNCH_BUY_SNIPE_EMERGENCY_INTEGRATED_PASS
→ Day 5 preflight only
```
