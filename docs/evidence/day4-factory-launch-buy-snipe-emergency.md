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

### Root cause / bounded repair rule

The accepted `BreadLaunchToken` runtime contract itself compiled and passed Day-2/Day-3 tests on main. The failure occurs when the new factory-only Deployer must invoke its existing wide constructor carrying four top-level strings, a five-string `Socials` struct, attribution addresses and supply through Solidity 0.8.26's non-viaIR creation-call code generation.

Project Source v1.4 freezes Factory/Deployer semantics, bounded metadata, the canonical `BreadLaunchToken` role and launch public semantics, but does not freeze the token constructor ABI. The bounded repair is therefore constructor-transport only: group token metadata/socials and launch attribution/supply into compact constructor structs while preserving all runtime state/getters, entire-supply-to-curve minting, transfer/burn behavior and Day-2/Day-3 invariants. No economics, permission, runtime ledger, public trading interface or metadata meaning changes.

Global `via_ir = true` is not used as a shortcut. The constructor refactor must first prove the prior `BreadLaunchToken` regression suite and the Day-4 Deployer fixture GREEN under the existing compiler configuration.

- Task-1 GREEN: PENDING constructor-transport repair + full focused regressions.

No local/component result in this document is Day-4 PASS. The final verdict is permitted only after integrated exact-head implementation CI, guarded merge, fresh merged-main closeout and exact-head closeout CI.
