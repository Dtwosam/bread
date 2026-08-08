# Day 4 Factory / Launch+Buy / Opening Protection / Emergency Evidence

Status: **TDD IN PROGRESS — NO DAY-4 PASS**

## Accepted start

- merged Day-4 preflight main: `ef03e60f9bbd5737a991dd3b1b747866d8ad8f3a`
- Project Source Pack: `v1.4-day4-design`
- Day-4 production ratification: `RATIFIED`
- implementation branch: `checkpoint/day4-launch-control`
- draft implementation PR: `#15`

## Task 1 — Factory / Deployer RED

- exact RED checkpoint retained as branch `checkpoint/day4-launch-control-red`
- RED behavior commit: `0356e6d39b699df37124cea1c4f57949f3cf86a8`
- PR RED head used by CI: `a07e7a9fe945bc6c39d7ee9c83a0ed8cee9349fb`
- required behavior fixture: `contracts/test/BreadLaunchFactory.t.sol`
- production `BreadLaunchFactory.sol` and `BreadLaunchDeployer.sol` intentionally absent
- CI run: `31270305259`
- `bootstrap-validation`: PASS
- `foundry-bootstrap`: EXPECTED RED at `forge build`
- exact Foundry cause: unresolved imports `src/factory/BreadLaunchFactory.sol` and `src/factory/BreadLaunchDeployer.sol`
- no unrelated Solidity/compiler failure was observed before those missing sources

## Task 1 — GREEN compiler investigation

The first minimal Factory/Deployer implementation exposed a Solidity 0.8.26 non-viaIR compiler boundary. The failure was investigated before changing architecture.

### Failed candidate attempts on PR #15

- initial Factory/Deployer implementation head `833bfe288b3cb3a88dcebe982b15e024e9e0d9d5`, CI `31270365965`: Foundry `Stack too deep`
- Factory deployment-building helper refactor head `93822aee3d6f1da1f206a4999698cb59243caded`, CI `31270411596`: same compiler failure
- grouped Deployer core/metadata payload head `71e0de80717fd532f6a6d3dedee9aa5cc93ad643`, CI `31270506185`: same compiler failure
- economics-digest static struct head `ab22af8354c297ed74540eff1a262fffd3af4514`, CI `31270553594`: same compiler failure

After three targeted fixes failed, implementation guessing stopped and diagnostic isolation began.

### Diagnostic isolation

- PR #16 / run `31270651274`: production contracts without new Factory test still FAIL; test is not a necessary cause.
- PR #17 / run `31270657138`: inherited Deployer-only attempt FAIL, but retained shared Day-4 ABI helpers and was treated as confounded rather than dispositive.
- PR #18 / run `31270743325`: clean branch from merged main + only current `BreadLaunchDeployer.sol` FAILS Foundry compile. The production Deployer boundary independently reproduces the issue.
- PR #20 / run `31270817328`: clean branch + same nested Deployer calldata decoder but no contract creation PASSES all four CI jobs. The deployment calldata decoder is exonerated.
- PR #21 / run `31270826372`: clean branch + static core payload + `new BreadBondingCurve(...)` PASSES all four CI jobs. Curve construction is exonerated.
- PR #22 / run `31270873490`: clean branch + only metadata/social payload + `new BreadLaunchToken(...)` FAILS Foundry compile with the same `Stack too deep` backend error. Token construction call is the isolated root cause.
- diagnostic PRs #16–#22 were closed without merge after evidence capture.

### Root cause / bounded repair rule

The accepted `BreadLaunchToken` runtime contract itself compiled and passed Day-2/Day-3 tests on main. The failure occurs when the new factory-only Deployer must invoke its existing wide constructor carrying four top-level strings, a five-string `Socials` struct, attribution addresses and supply through Solidity 0.8.26's non-viaIR creation-call code generation.

Project Source v1.4 freezes Factory/Deployer semantics, bounded metadata, the canonical `BreadLaunchToken` role and launch public semantics, but does not freeze the token constructor ABI. The bounded repair is therefore constructor-transport only: group token metadata/socials and launch attribution/supply into compact constructor structs while preserving all runtime state/getters, entire-supply-to-curve minting, transfer/burn behavior and Day-2/Day-3 invariants. No economics, permission, runtime ledger, public trading interface or metadata meaning changes.

Global `via_ir = true` was not used as a shortcut.

### Bounded constructor repair result

`BreadLaunchToken` now receives two constructor transport structs:

- `Metadata`: name, symbol, logo, description, existing `Socials`
- `LaunchContext`: deployer, curve, launchFactory, supply

The runtime token storage/getters, fixed-supply mint-to-curve behavior, transfer/burn behavior and zero-address rules are unchanged. The original Day-2 token suite and every Day-2/Day-3 launch-token fixture were migrated without removing or weakening assertions.

Exact Task-1 GREEN head: `ba1615efac52d4f5132636d5875dce6083eaf8dd`

Exact Task-1 GREEN CI: `31271282775`

- `bootstrap-validation`: PASS
- `dependency-build`: PASS
- `foundry-bootstrap`: PASS
- `infrastructure-health`: PASS
- Solidity 0.8.26 non-viaIR compile: PASS
- Foundry: **107 passed / 0 failed / 0 skipped** across 15 suites
- `BreadLaunchFactoryTest`: **8/8 PASS**
- original `BreadLaunchTokenTest`: **13/13 PASS**
- carried-forward Day-3 Buy/Sell, final-fill, FeeEscrow, FeePolicy, tracked-state, trading-security and invariant suites: PASS

Task-1 component result: **FACTORY_DEPLOYER_LOCAL_GREEN**.

## Task 2 — Canonical-USDC launch-fee RED

RED test commit: `9c44d8df9b7184bf02ba58f0053787fa110b9ccf`

Exact RED CI: `31271422396`

- Solidity compile: PASS
- prior Factory/Deployer and all Day-1–Day-3 suites: PASS
- total: **108 passed / 5 failed / 0 skipped**
- `BreadLaunchFeeTest`: **1 passed / exactly 5 intended failed**
- passing control: zero launch fee took no USDC and required no Factory creditor authorization
- intended failures: nonzero launch fee was not yet collected/credited; insufficient allowance did not yet block; unauthorized Factory creditor did not yet roll back; short-transfer launch fee did not yet reject; updated pinned protocol recipient did not yet receive credit

The RED was behavior-specific: the existing Factory ignored `launchFeeUsdc`; no unrelated compile/regression failure was present.

## Task 2 — Canonical-USDC launch-fee GREEN

Minimal production implementation:

- receives only configured `launchFeeUsdc` from the caller using `SafeERC20.safeTransferFrom`
- verifies exact Factory balance delta before launch continues
- deploys/initializes the pair inside the same transaction
- approves exactly the launch-fee amount to the existing canonical FeeEscrow
- credits the current economics-pinned `protocolFeeRecipient`
- clears the temporary escrow allowance after successful credit
- requires post-intent Factory USDC balance to equal the pre-intent balance
- zero launch fee performs no transfer/authorization/credit
- does not add a creditor registrar or alter `BreadFeeEscrow` authority; Protocol Admin still authorizes the Factory once using the existing Day-3 owner control
- any transfer/escrow/authorization failure reverts the entire launch transaction

Exact GREEN head: `17db4687cd090e32d49c68a63ab3f875a85914a5`

Exact GREEN CI: `31271512833`

- `bootstrap-validation`: PASS
- `dependency-build`: PASS
- `foundry-bootstrap`: PASS
- `infrastructure-health`: PASS
- `BreadLaunchFeeTest`: **6/6 PASS**
- Foundry: **113 passed / 0 failed / 0 skipped** across 16 suites
- all prior Factory/Deployer, token, Buy/Sell, final-fill, FeeEscrow, FeePolicy, tracked-state, trading-security and invariant suites: PASS

Task-2 component result: **CANONICAL_USDC_LAUNCH_FEE_ESCROW_LOCAL_GREEN**.

## Task 3 — Atomic Launch+Buy RED

RED test commit: `9452f3925342a5c6977f3de7054bfa88a918bcfb`

Exact RED CI: `31271648604`

- Solidity compile: PASS
- prior Factory/Deployer, launch-fee and all Day-1–Day-3 suites: PASS
- Foundry total: **117 passed / 2 failed / 0 skipped** across 17 suites
- `BreadLaunchAndBuyTest`: **4 passed / exactly 2 intended failed**
- passing controls included zero-quote/zero-recipient rejection expectations, failed-call rollback expectations, unauthorized curve launch-buy entry, and unchanged public Buy numerics
- intended failures were the two success paths requiring the missing `launchTokenAndBuy` implementation: ordinary atomic launch+buy and final-crossing launch+buy refund

The RED remained behavior-specific: no unrelated compile or prior-regression failure occurred.

## Task 3 — Atomic Launch+Buy GREEN

Minimal implementation:

- public `BreadBondingCurve.buy(...)` keeps its accepted ABI and now delegates to one shared internal `_buy(...)` implementation
- additive `BreadBondingCurve.buyForLaunch(...)` is `factory`-only and delegates to the exact same pricing/tracked-reserve/fee/refund path
- `buyForLaunch` returns `tokensOut`, actual `spent`, and exact `refund`; it does not introduce separate pricing/accounting
- Factory `launchTokenAndBuy(...)` validates nonzero quote and recipient, then receives exactly `launchFeeUsdc + quoteIn`
- pair deployment/initialization, launch-fee FeeEscrow credit, initial curve Buy, allowance cleanup, user refund, launch record and final Factory custody check all execute in one transaction
- Factory approves exactly `quoteIn` to the new curve and clears allowance after the call
- curve final-fill refund returns to Factory, and Factory forwards exactly that amount to the original launch caller
- any slippage, transfer, escrow or Buy failure reverts the entire launch, including launch-fee claim creation and deployment effects
- no snipe/opening-tax logic and no emergency behavior entered this slice

Exact GREEN head: `c9b731ae545c29e9405b95a0dc26ba08f25a96c6`

Exact GREEN CI: `31271736825`

- `bootstrap-validation`: PASS
- `dependency-build`: PASS
- `foundry-bootstrap`: PASS
- `infrastructure-health`: PASS
- `BreadLaunchAndBuyTest`: **6/6 PASS**
- Foundry: **119 passed / 0 failed / 0 skipped** across 17 suites
- public Day-3 Buy deterministic vectors remain PASS
- final-fill invariant remains PASS
- launch-fee, FeeEscrow, FeePolicy, token, tracked-state, trading-security and trading-invariant suites remain PASS

Task-3 component result: **ATOMIC_LAUNCH_AND_BUY_LOCAL_GREEN**.

This is not Day-4 PASS. Exact opening protection, two-stage snipe final-fill proof, EmergencyController integration and Day-4 integrated invariants remain unimplemented/unproved.

No local/component result in this document is Day-4 PASS. The final verdict is permitted only after integrated exact-head implementation CI, guarded merge, fresh merged-main closeout and exact-head closeout CI.
