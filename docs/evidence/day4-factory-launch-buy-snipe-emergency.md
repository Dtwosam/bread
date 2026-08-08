# Day 4 Factory / Launch+Buy / Opening Protection / Emergency Evidence

Status: **IMPLEMENTATION CANDIDATE — FINAL STAMPED-HEAD CI PENDING; NO DAY-4 PASS**

## Accepted authority and baseline

- Project Source Pack: `v1.4-day4-design`
- Day-4 production ratification: `RATIFIED`
- approved design: `324b6055a0bed278766e1b48016774ac745b3781`
- implementation plan: `docs/superpowers/plans/2026-08-08-day4-factory-launch-buy-snipe-emergency.md`
- plan self-review: `docs/superpowers/plans/2026-08-08-day4-plan-self-review.md`
- merged Day-4 production-start main: `ef03e60f9bbd5737a991dd3b1b747866d8ad8f3a`
- implementation branch: `checkpoint/day4-launch-control`
- implementation PR: `#15`
- accepted Day-3 production: `4f572bfd61cd57b33be994b895295be4522179b2`
- accepted Day-3 closeout: `a67f42cae2b69c5c8ec4b07f0c2f2695ac4ea8a3`

This document records candidate implementation evidence only. `LOCAL_COMPONENT_PASS`, `INTEGRATED_CANDIDATE_PASS`, and green PR CI are not the Day-4 closeout verdict. The final Day-4 verdict is permitted only after the implementation candidate merges and a fresh closeout branch from the actual merged `main` passes its own exact-head CI.

## Task 1 — Factory / Deployer

### RED

- behavior commit: `0356e6d39b699df37124cea1c4f57949f3cf86a8`
- CI: `31270305259`
- Node validation: PASS
- Foundry: expected compile RED because `BreadLaunchFactory.sol` and `BreadLaunchDeployer.sol` were intentionally absent

### Non-viaIR compiler investigation

The first minimal implementation exposed a Solidity 0.8.26 `Stack too deep` backend boundary. The failure was isolated before architecture changed:

- `31270651274`: production contracts without the new Factory test still failed; the new test was not a necessary cause
- `31270743325`: clean Deployer-only reproduction failed
- `31270817328`: same nested deployment decoder without contract creation passed
- `31270826372`: curve construction alone passed
- `31270873490`: token construction alone reproduced the stack failure

Diagnostic PRs `#16`–`#22` were closed unmerged after evidence capture.

The bounded repair changed only `BreadLaunchToken` constructor transport to `Metadata` and `LaunchContext` structs. Runtime getters, attribution, fixed-supply mint-to-curve behavior, transfer/burn behavior, metadata meaning, and Day-2/Day-3 invariants remain unchanged. Global `via_ir = true` was not enabled.

### GREEN

- exact head: `ba1615efac52d4f5132636d5875dce6083eaf8dd`
- CI: `31271282775`
- all four repository jobs: PASS
- Foundry: `107 passed / 0 failed / 0 skipped`
- component result: `FACTORY_DEPLOYER_LOCAL_GREEN`

## Task 2 — Canonical-USDC launch fee

### RED

- test commit: `9c44d8df9b7184bf02ba58f0053787fa110b9ccf`
- CI: `31271422396`
- Foundry: `108 passed / exactly 5 intended failed / 0 skipped`
- zero-fee control passed; all nonzero custody/authorization/short-transfer/protocol-credit cases failed because the Factory had not implemented launch-fee routing yet

### GREEN

- exact head: `17db4687cd090e32d49c68a63ab3f875a85914a5`
- CI: `31271512833`
- all four repository jobs: PASS
- Foundry: `113 passed / 0 failed / 0 skipped`
- nonzero launch fee is exact canonical USDC, credits the economics-pinned protocol recipient through existing `BreadFeeEscrow`, clears temporary allowance, leaves no Factory intent residue, and rolls the full launch back on transfer/credit failure
- no automatic FeeEscrow creditor registrar was added
- component result: `CANONICAL_USDC_LAUNCH_FEE_ESCROW_LOCAL_GREEN`

## Task 3 — Atomic Launch+Buy

### RED

- test commit: `9452f3925342a5c6977f3de7054bfa88a918bcfb`
- CI: `31271648604`
- Foundry: `117 passed / exactly 2 intended failed / 0 skipped`
- intended failures were the missing ordinary and final-crossing `launchTokenAndBuy` success paths

### GREEN

- exact head: `c9b731ae545c29e9405b95a0dc26ba08f25a96c6`
- CI: `31271736825`
- all four repository jobs: PASS
- Foundry: `119 passed / 0 failed / 0 skipped`
- public `buy` and Factory-only `buyForLaunch` share one internal pricing/accounting path
- Factory receives exactly `launchFeeUsdc + quoteIn`, uses a temporary exact curve allowance, forwards the curve's final-fill refund to the original caller, clears allowance, and returns to its pre-intent USDC balance
- slippage/transfer/FeeEscrow/buy failures roll back deployment and launch-fee effects atomically
- component result: `ATOMIC_LAUNCH_AND_BUY_LOCAL_GREEN`

## Task 4 — Exact opening protection

### RED

- original RED commit: `55dddfad...`
- fixture-only correction head: `5c2a4e8e...`
- accepted RED CI: `31272045019`
- Solidity compile: PASS
- Foundry: `121 passed / exactly 6 intended opening-protection failures`
- sell exclusion and pre-initialization rejection controls already passed

### GREEN

- exact opening vector is `9900 / 6336 / 3564 / 1584 / 396 / 0` bps at elapsed `0 / 1 / 2 / 3 / 4 / >=5` seconds
- launch timestamp is one-shot and the Factory launch record reads the curve's canonical `launchTimestamp`
- ordinary buy charge order is standard fee + creator tax, then opening tax on the remaining amount
- opening tax joins `quoteFeeBalance`; creator tax remains in `creatorTaxBalance`
- sells never charge opening tax
- only the same-launch Factory `buyForLaunch` call can consume the one-use exemption; no wallet mapping exists
- replay and delayed Factory exemption attempts revert
- canonical timestamp compatibility CI: `31272664078`
- Foundry: `127 passed / 0 failed / 0 skipped`
- component result: `OPENING_PROTECTION_LOCAL_GREEN`

## Task 5 — Opening-window final crossing

### RED

- RED commit: `061a6f15...`
- CI: `31272888360`
- Foundry: `128 passed / exactly 6 intended final-fill failures`
- elapsed-5 zero-snipe control passed; elapsed 0–4 demonstrated the old Day-3 one-stage gross-up was insufficient for opening-tax final fills

### GREEN

The ratified two-stage full-precision ceiling rule is implemented:

1. ceiling gross through the opening-tax layer
2. ceiling gross through standard fee + creator tax
3. recompute all floor charges from actual `spent`
4. require actual `netCurveInput >= netRequired`
5. refund all excess received quote

The zero-snipe case reduces to the accepted Day-3 gross-up. The underfunded-boundary test now searches for an amount whose recomputed post-fee/post-snipe net is actually below `netRequired`; it does not incorrectly assume that `grossRequired - 1` must always be insufficient when the sequential ceiling is conservative.

- GREEN head: `762b0ed4...`
- CI: `31272992032`
- Foundry: `134 passed / 0 failed / 0 skipped`
- component result: `SNIPE_FINAL_FILL_LOCAL_GREEN`

## Task 6 — Restriction-only EmergencyController

The standalone controller implements:

- `NORMAL < NO_NEW_LAUNCHES < BUY_PAUSED < TRADING_PAUSED`
- independent `graduationPaused`
- Guardian may only increase restriction and may only set graduation pause to true
- Protocol Admin alone may reduce restrictions, clear graduation pause, and rotate Guardian
- owner renunciation is disabled
- no transfer, arbitrary-call, FeePolicy, launch-fee, recipient, tax, timestamp, exemption, deployer, or economics mutation capability exists on the Guardian surface

Standalone EmergencyController suite reached `144/144` Foundry PASS before consumer integration.

## Task 7 — Emergency consumer integration repair

A previously reported PR check correctly caught incomplete integration:

- failing PR head: `aadef406fd63dd9cd8f6a3101b8a9c314f500ea2`
- CI: `31272943677`
- `foundry-bootstrap`: compile FAIL because `BreadEmergencyIntegration.t.sol` expected the ratified final Factory constructor with an emergency-controller dependency while production Factory still exposed the pre-integration constructor
- other three CI jobs passed

The failure was not bypassed. Production was repaired so the same EmergencyController is wired through `BreadLaunchFactory -> BreadLaunchDeployer -> BreadBondingCurve`:

- Factory launch surfaces are `nonReentrant`
- Factory checks `launchesAllowed()` before launch custody/deployment
- curve checks `buysAllowed()` before buy custody
- curve checks `sellsAllowed()` before sell custody
- direct financial/unit fixtures use a test-only always-open controller; real Day-4 integration tests use `BreadEmergencyController`

Exact permission matrix proved:

| Mode | New launch | Buy | Sell |
| --- | --- | --- | --- |
| NORMAL | allowed | allowed | allowed |
| NO_NEW_LAUNCHES | blocked | allowed | allowed |
| BUY_PAUSED | blocked | blocked | allowed |
| TRADING_PAUSED | blocked | blocked | blocked |

Emergency transitions do not rewrite launch economics, launch timestamp, tracked reserves, pending fees/tax, or existing FeeEscrow claims.

## Task 8 — Real vertical integration

`contracts/test/helpers/BreadDay4Fixture.sol` and `contracts/test/BreadDay4Integration.t.sol` use the real:

- `BreadLaunchFactory`
- `BreadLaunchDeployer`
- `BreadBondingCurve`
- `BreadLaunchToken`
- `BreadFeePolicy`
- `BreadFeeEscrow`
- `BreadEmergencyController`

The fixture's economics are explicit test-only values and are not live-runtime defaults.

The vertical proof covers:

- explicit Factory FeeEscrow authorization before nonzero launch fee
- atomic launch + exempt initial buy
- same-window ordinary opening-tax buy
- explicit curve FeeEscrow authorization before first sweep
- canonical protocol/creator claim accounting
- zero Factory intent residue
- emergency transition snapshot immutability

## Task 9 — Invariants and adversarial ordering

Dedicated invariant suites are present:

- `contracts/test/BreadOpeningProtectionInvariant.t.sol`
- `contracts/test/BreadDay4Invariant.t.sol`

They explicitly prove:

- `INV-040`: opening tax is bounded by 9900 bps
- `INV-041`: opening tax is non-increasing and exactly zero at/after five seconds
- `INV-042`: sell path never adds opening tax
- `INV-043`: only the Factory initial buy is exempt; replay/address-derived exemption fails
- `INV-044`: opening tax remains in canonical fee accounting through sweep and claims
- `INV-060`: Guardian only increases restriction and cannot alter funds/economics
- `INV-061`: Protocol Admin is the recovery/unpause authority
- `INV-062`: future launch config cannot rewrite existing launch snapshots
- `INV-063`: Factory and EmergencyController admin surfaces work with contract ownership, which proves Safe compatibility without claiming a live production Safe deployment
- Guardian tightening between quote preparation and execution blocks the buy before custody/state mutation
- stale economics pin after configuration movement cannot launch

## Integrated candidate proof

Expanded implementation head before documentation stamp:

- head: `7611f58ecddcf59f1a2a8f10458aa7d6795a44ab`
- CI: `31274793743`
- all four repository jobs: PASS
- Foundry: **162 passed / 0 failed / 0 skipped across 24 suites**

Pre-stamp candidate after source-integrity/format-gate repair:

- head: `5905458428fa1d5c28d451b8cdf2e76106ad86dc`
- CI: `31275313178`
- `bootstrap-validation`: PASS
- `dependency-build`: PASS
- `foundry-bootstrap`: PASS
- `infrastructure-health`: PASS
- Day-4 changed-file Prettier gate: PASS
- `pnpm validate`: PASS
- `pnpm test`: PASS
- `pnpm typecheck`: PASS
- `pnpm build`: PASS
- workspace-clean check: PASS
- Foundry remains **162 passed / 0 failed / 0 skipped**; no Solidity/test change occurred between the expanded proof and this formatting-gate repair

## Executable source-integrity gate

`scripts/validation/validate-day4-launch-control-source-integrity.mjs` is now called by `validate-all.mjs`. It rejects drift in:

- Project Source Pack `v1.4-day4-design`
- accepted Day-4 production-start main
- approved design commit
- frozen Pons/Clanker reference commits and `REFERENCE_ONLY` status
- exact `9900 / 5 seconds / 0` opening-policy constants
- `QUOTE_FEE_BALANCE` opening-tax routing
- one-use launch-buy exemption latch
- full-precision ceiling final-fill implementation
- Factory emergency launch gate
- Guardian tighten-only rule
- ratified Day-4 build-state source state
- live-runtime or current-Pons-parity claims that Project Sources do not authorize

## Formatting gate and baseline debt

The written implementation plan required formatting verification, but the inherited CI did not previously run Prettier.

- run `31274931934` added a repository-wide `pnpm format:check` and exposed **52 pre-existing formatting-debt files**, mostly outside Day-4 scope
- the global debt was not bulk-reformatted inside this financial-contract PR because that would create unrelated diff noise and weaken reviewability
- CI now enforces Prettier over the Day-4/PR-owned non-Solidity files changed by this implementation
- run `31275006909` narrowed the remaining Day-4 formatting debt to two validator files
- the exact Prettier output was applied; run `31275313178` proves the scoped Day-4 formatting gate PASS
- repository-wide historical formatting debt remains a separate cleanup concern and is not represented as Day-4 functionality failure

## Manual diff/security review

A manual security-oriented review of the actual PR diff found no reportable security issue and no forbidden Day-4 scope expansion. Specifically, the candidate contains no:

- native quote, WETH, Permit2, or Universal Router path
- Day-5 DEX/graduation/locker implementation
- buyback/vesting implementation
- CREATE2/deterministic-address promise
- new FeeEscrow ledger or automatic creditor registrar
- separate opening-tax treasury/claim ledger
- Guardian fund/economic/dependency mutation authority
- hard-coded Arc mainnet or guessed live runtime values
- claim of exact current-live Pons Factory parity

External-call/custody boundaries reviewed include Factory exact USDC receipt, temporary approvals, FeeEscrow credit rollback, Factory reentrancy protection, emergency checks before custody, curve transfer/state ordering, and final-fill denominator/net-required guards.

This was a manual diff-oriented security review plus executable tests. It is **not** represented as a completed external or Codex Security audit. `PONS_AUDIT_FINDINGS` remains an explicit release/security blocker.

## Remaining global blockers

These remain active with their existing scopes:

- `CURRENT_PONS_FACTORY_SOURCE_PARITY` — truthfulness/parity claims only
- `LIVE_RUNTIME_CONFIG` — real deployment values; no production values may be guessed
- `PONS_AUDIT_FINDINGS` — release/security gate
- `ARC_MAINNET_VALUES` — mainnet deployment gate

## Candidate gate

Current state after this evidence stamp:

`IMPLEMENTATION_CANDIDATE — FINAL_EXACT_HEAD_CI_PENDING`

Do not merge PR #15 until the exact stamped head passes all four repository jobs. After that implementation merge, create a fresh closeout branch from the actual merged `main`; run the full prerequisite gate and exact-head closeout CI. Only the fresh merged-main closeout may issue:

`DAY_4_FACTORY_LAUNCH_BUY_SNIPE_EMERGENCY_INTEGRATED_PASS`
