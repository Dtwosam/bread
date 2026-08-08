# Day 3 External-Component Research Matrix

Status: **RESEARCH EVIDENCE — NOT AN IMPLEMENTATION AUTHORIZATION**  
Repository: `Dtwosam/bread`  
Working branch: `checkpoint/day3-trading-fees-escrow-preflight`  
Bread integration baseline: `5d13689f1ebc54f609c0fcf61ea43287b207e61a`  
Research date: 2026-08-08

## 1. Purpose and controlling boundary

This artifact records the external-component source preflight required before Bread writes Day-3 production financial code. It does not update Bread economics, does not establish current Pons parity, and does not authorize implementation.

Controlling rule:

> External components are implementation evidence and implementation aids. Bread remains the protocol authority for accounting, economics, privileges, custody, events, and integration semantics.

The matrix is evaluated against Bread's current accepted baseline and the component-sourcing/reuse gate at `de50a7e635a58891efe42f7db40d231acde7846f`.

No candidate may become a standalone subsystem. A selected primitive must be adapted behind Bread-owned interfaces and must advance the same continuously integrated Bread baseline.

## 2. Handoff and repository reconciliation

Before this research, the repository-side handoff and GitHub history were reconciled:

- `main` accepted Day-2 merge baseline: `5d13689f1ebc54f609c0fcf61ea43287b207e61a`.
- Active branch: `checkpoint/day3-trading-fees-escrow-preflight`.
- Component-sourcing/reuse gate: `de50a7e635a58891efe42f7db40d231acde7846f`.
- Pre-research branch HEAD/handoff commit: `b9d38009901520ce3b28b51169fc71217c2aa3a1`.
- Branch was three commits ahead of `main`, zero behind, with merge base equal to the accepted Day-2 baseline.
- Day-2 closeout workflow run `31256962864` was successful across the required bootstrap, dependency/build, Foundry, PostgreSQL and Redis lanes.
- No Day-3 production financial code was present or authorized.

Result: **HANDOFF_RECONCILIATION_PASS — safe to continue research.**

## 3. Bread requirements used for classification

### 3.1 FeeEscrow minimum requirements

A Bread FeeEscrow must preserve all of the following:

- canonical six-decimal ERC20 USDC only for Bread V1 business accounting;
- exact recipient claim ledger ownership;
- no double claim;
- state/accounting update before external transfer control;
- a failed transfer must not destroy a valid claim;
- no admin withdrawal of recipient claim balances;
- explicit reconciliation of actual USDC balance against total outstanding claims;
- deterministic credit/claim events suitable for SDK/indexer/API/dashboard consumers;
- reentrancy safety;
- no arbitrary custody escape;
- exact integration with Bread FeePolicy/trading accounting rather than a second fee ledger.

### 3.2 FeePolicy minimum requirements

Bread owns the meaning of:

- protocol fee;
- creator fee;
- creator tax separation;
- recipient identities;
- fee snapshots and when they become immutable for a launch/trade;
- buyback allocation boundaries;
- rounding and remainder ownership;
- canonical six-decimal USDC accounting.

A third-party splitter must not become the source of truth for these values.

### 3.3 Launch+Buy minimum requirements

Any future Bread Launch+Buy path must be one atomic Bread lifecycle, including the exact launch, quote, bounded input/output protection, partial final-buy behavior where applicable, refund behavior, recipient delivery, and event semantics. It may not silently change the bonding-curve or fee economics.

### 3.4 Snipe-protection minimum requirements

Snipe/economic fairness is protocol-level behavior. Infrastructure rate limits are not a substitute. Any selected mechanism must have explicit, testable semantics for:

- who is affected;
- buy/sell directionality;
- maximum charge/restriction;
- monotonic/terminal behavior;
- exemptions if any;
- proceeds destination;
- admin mutability;
- interaction with base fees, creator economics and escrow accounting.

Because exact current Pons snipe source is unresolved, selecting non-Pons semantics is an explicit Bread economic/security decision.

## 4. Candidate summary

| Component | Candidate | Exact source | License evidence | Classification | Short rationale |
|---|---|---|---|---|---|
| FeeEscrow | Clanker `ClankerFeeLocker` | `clanker-devco/v4-contracts@b004c2e`, `src/ClankerFeeLocker.sol`, blob `fff50acd...` | file SPDX `MIT`; root `LICENSE` not found at pinned commit | **ADAPT — recommended** | Closest launchpad primitive: generic ERC20, balance-delta deposits, pull ledger, state-before-transfer, no rescue path. Needs Bread USDC-only authority and explicit solvency state. |
| FeeEscrow | Flaunch `FeeEscrow` | `flayerlabs/flaunchgg-contracts@3a7cde1`, `src/contracts/escrows/FeeEscrow.sol`, blob `b46e3b7f...` | file SPDX `MIT`; root `LICENSE` not found at pinned commit | **REFERENCE ONLY** | Useful pull-claim pattern but hard-coupled to flETH, Uniswap V4 `PoolId` and mutable indexer attribution. |
| FeeEscrow | OpenZeppelin `PaymentSplitter` | `OpenZeppelin/openzeppelin-contracts@v4.9.6`, `contracts/finance/PaymentSplitter.sol`, blob `daa9090e...` | MIT root license | **REFERENCE ONLY** | Mature pull-payment reference, but entitlement is derived from aggregate balance/released history and fixed shares, not exact Bread trade credits; donations affect distributable totals. |
| FeeEscrow | Doppler `StreamableFeesLockerV2` | `whetstoneresearch/doppler@b4308a0`, `src/lockers/StreamableFeesLockerV2.sol`, blob `ac38a7e6...` | BUSL-1.1; production rights restricted absent an applicable grant/license until change date | **REJECT** | Uniswap V4 position/stream custody is a different system and license blocks unqualified production adaptation. |
| FeePolicy | Flaunch `FeeDistributor` + `StaticFeeCalculator` | `flayerlabs/flaunchgg-contracts@3a7cde1`, `src/contracts/hooks/FeeDistributor.sol`; `src/contracts/fees/StaticFeeCalculator.sol`, blob `f748b1c3...` | file SPDX `MIT` | **REFERENCE ONLY** | Good evidence for separating configured base fee from calculator logic, but Flaunch's waterfall, bid-wall, referral and governance economics are foreign to Bread. |
| FeePolicy | OpenZeppelin `PaymentSplitter` | `OpenZeppelin/openzeppelin-contracts@v4.9.6` | MIT | **REFERENCE ONLY** | Useful cumulative release math and checks-effects-interactions reference, but static share economics do not model Bread per-trade fee/tax accounting. |
| FeePolicy | 0xSplits `PullSplit` | `0xSplits/splits-contracts-monorepo@71f09d3`, `packages/splits-v2/src/splitters/pull/PullSplit.sol`, blob `9fdde257...` | GPL-3.0-or-later; GPLv3 root license | **REJECT** | Adds a warehouse/token-accounting subsystem and split-control model, creating duplicate custody/accounting and copyleft integration cost. |
| FeePolicy | Doppler `Airlock` fee accounting | `whetstoneresearch/doppler@b4308a0`, `src/Airlock.sol`, blob `1154a5e3...` | BUSL-1.1 | **REJECT** | Hard-codes foreign protocol/integrator fee economics and broad module/admin model; wrong semantic authority and restricted license. |
| Launch+Buy | Flaunch `FlaunchZap` | `flayerlabs/flaunchgg-contracts@3a7cde1`, `src/contracts/zaps/FlaunchZap.sol` | file SPDX `MIT` | **REFERENCE ONLY — primary lifecycle reference** | Strong atomic launch/premine/refund shape; however it is ETH/flETH, Flaunch NFT/treasury-manager and Uniswap V4 specific. |
| Launch+Buy | Clanker `ClankerUniv4EthDevBuy` | `clanker-devco/v4-contracts@b004c2e`, `src/extensions/ClankerUniv4EthDevBuy.sol`, blob `498201c2...` | file SPDX `MIT` | **REFERENCE ONLY — fallback lifecycle reference** | Factory-only atomic deployment extension with recipient delivery, but WETH/Permit2/V4 coupling and final token buy uses `amountOutMinimum = 1`, which is not acceptable Bread slippage semantics. |
| Launch+Buy | Doppler `Airlock` | `whetstoneresearch/doppler@b4308a0`, `src/Airlock.sol`, blob `1154a5e3...` | BUSL-1.1 | **REJECT** | Mature modular launch coordinator, but auction/migration/governance economics and restricted production license make it unsuitable as Bread source. |
| Snipe protection | Clanker `ClankerMevDescendingFees` | `clanker-devco/v4-contracts@b004c2e`, `src/mev-modules/ClankerMevDescendingFees.sol`, blob `d2aa634b...` | file SPDX `MIT` | **ADAPT — conditional on explicit Bread economic approval** | Concrete bounded decaying-fee mechanism and best source candidate, but it is a V4-hook LP-fee module and does not establish Pons semantics or Bread buy-only behavior. |
| Snipe protection | Clanker `ClankerSniperAuctionV2` | `clanker-devco/v4-contracts@b004c2e`, `src/mev-modules/ClankerSniperAuctionV2.sol` | file SPDX `MIT` | **REJECT** | Imports a gas-price auction, WETH payments, factory/LP reward economics, EIP-1559/sequencer assumptions and owner-mutable auction parameters. |
| Snipe protection | Flaunch `FixedPriceWindowFeeCalculator` prototype | `flayerlabs/flaunchgg-contracts@3a7cde1`, `src/contracts/fees/prototype/FixedPriceWindowFeeCalculator.sol`, blob `3c77d45a...` | file SPDX `MIT` | **REJECT** | Source explicitly states `PROTOTYPE`, `NOT audited`, `NOT tested`, `NOT for production`; semantics are fixed-price-window reverts rather than proven Bread/Pons snipe behavior. |
| Snipe protection | Doppler auction architecture | `whetstoneresearch/doppler@b4308a0`, coordinated through `src/Airlock.sol` and pool initializer modules | BUSL-1.1 | **REFERENCE ONLY** | Price-discovery auctions are a credible fairness model but are architecturally and economically different from Bread's current bonding-curve baseline and cannot be copied into production under the present license evidence. |

## 5. Detailed candidate findings

### 5.1 FeeEscrow — Clanker `ClankerFeeLocker`

**Repository / provenance**

- Repository: <https://github.com/clanker-devco/v4-contracts>
- Pinned commit: `b004c2edda29fa282a16d5d1441a26484f70b37f`
- Source: `src/ClankerFeeLocker.sol`
- Blob: `fff50acd16fdb5585a0ebca14dd15f7ea35e6397`
- File license marker: `SPDX-License-Identifier: MIT`
- Root `LICENSE` was not found by repository fetch at this pinned commit, so any later code-copy step must preserve file licensing/attribution and reconfirm repository licensing before merge.

**Architecture**

- `feesToClaim[feeOwner][token]` is the recipient/token ledger.
- `allowedDepositors` constrains who may credit the escrow.
- `storeFees` measures balance before/after `transferFrom` and credits only the actual amount received.
- `claim` can be called by any address but always sends funds to `feeOwner`.
- `claim` zeros the ledger before `SafeERC20.safeTransfer`.
- Both credit and claim paths are `nonReentrant`.
- No arbitrary owner rescue/withdraw path exists in the inspected contract.

**Security / production evidence**

Clanker publicly lists `ClankerFeeLocker` deployments in its v4 repository README. Macro audited adjacent Clanker fee-flow and sniper components in 2025. Macro A-3 explicitly reviewed `ClankerLpLockerFeeConversion` and `ClankerSniperAuctionV0`, including their calls into `feeLocker.storeFees`; the report identified and tracked fixes in the surrounding reward flow. The exact current `ClankerFeeLocker.sol` blob above is not established by this research as exact audit scope, so Bread must not label the blob itself "audited" without additional scope proof.

Macro A-3: <https://0xmacro.com/library/audits/clanker-3>

**Bread semantic fit**

High as a primitive, not as authority:

- ERC20 generic, therefore mechanically compatible with six-decimal USDC.
- Pull-ledger semantics align well with Bread.
- Balance-delta deposits are a useful defensive pattern.
- Failed ERC20 transfer reverts the whole claim transaction, preserving the pre-call ledger state.

**Required Bread modifications**

1. Bind the contract to Bread's canonical USDC address instead of arbitrary per-call tokens.
2. Replace foreign `allowedDepositors` semantics with a Bread-owned credit authority tied to the current trading/FeePolicy handoff; no EOA super-admin.
3. Add explicit `totalOutstanding` accounting and a solvency view/invariant (`USDC.balanceOf(escrow) >= totalOutstanding`).
4. Freeze Bread-specific credit/claim event names and fields for future SDK/indexer/API/dashboard consumers.
5. Keep no admin rescue of outstanding recipient claims.
6. Decide whether claim-on-behalf remains permissionless; if retained it must always pay the ledger owner, never the caller-selected destination.
7. Ensure Safe/multisig and guardian boundaries match Bread's existing security model.

**Required Bread tests/invariants**

- credit conservation;
- actual balance / total outstanding reconciliation after every state transition;
- no double claim;
- recipient isolation;
- unauthorized credit rejection;
- failed transfer preserves claim;
- reentrancy attempts cannot duplicate or redirect claims;
- direct USDC donation does not create recipient entitlement;
- zero/tiny credits do not create harvestable rounding;
- exact trade-fee handoff integration.

**Classification: `ADAPT` — recommended primary FeeEscrow source primitive.**

It should not be copied wholesale. Bread should adapt the minimal ledger/transfer pattern into a Bread-owned USDC escrow surface.

### 5.2 FeeEscrow — Flaunch `FeeEscrow`

**Repository / provenance**

- Repository: <https://github.com/flayerlabs/flaunchgg-contracts>
- Pinned commit: `3a7cde1bfcca36760de1e72a45677b9096c9d64d` (`Flaunch V1.2`)
- Source: `src/contracts/escrows/FeeEscrow.sol`
- Blob: `b46e3b7ff4bd1aef30c2ad48f968c0682ea72b9d`
- Interface: `src/interfaces/IFeeEscrow.sol`
- File license marker: `MIT`; root `LICENSE` was not found by repository fetch at this pinned commit.

**Architecture**

- Single configured `nativeToken` expected to be flETH.
- Recipient balance ledger and per-pool allocation total.
- Allocation pulls tokens after accounting changes; transfer failure reverts atomically.
- Withdrawal zeros caller balance before external transfer/unwrap.
- Optional unwrap sends native ETH.
- Owner may replace an indexer used for pool attribution.
- No arbitrary owner sweep was found in the inspected contract.

**Security / production evidence**

Flaunch documents four audit rounds: initial Omniscia review, two Enigma Dark reviews in December 2024, and an Enigma Dark v1.1 protocol-upgrade review in March 2025. The official audit page does not establish that the pinned V1.2 FeeEscrow blob above was exact audit scope.

Audit page: <https://docs.flaunch.gg/protocol/audits>

**Bread fit / continuity cost**

The checks-effects-interactions shape is useful, but direct adaptation would carry unnecessary foreign state:

- flETH/native-ETH semantics instead of canonical USDC;
- Uniswap V4 `PoolId` attribution;
- mutable indexer dependency;
- no explicit Bread-style total-outstanding solvency ledger.

**Classification: `REFERENCE ONLY`.**

Use its claim ordering and failed-transfer behavior as test/reference material, not as Bread's escrow state model.

### 5.3 FeeEscrow / FeePolicy — OpenZeppelin `PaymentSplitter`

**Provenance**

- Repository: <https://github.com/OpenZeppelin/openzeppelin-contracts>
- Tag: `v4.9.6`
- Source: `contracts/finance/PaymentSplitter.sol`
- Blob: `daa9090eba997fba38b82718475db4a1c3514244`
- License: MIT, root license present.

**Architecture**

- Fixed shares at deployment.
- Pull release model.
- Cumulative released accounting.
- ERC20 safe transfer.

**Bread mismatch**

Entitlement is derived from `token.balanceOf(this) + totalReleased`, so unrelated direct token transfers increase the amount considered received and therefore alter payee entitlement. That is intentionally valid for a generic splitter but conflicts with Bread's donation-resistant exact trade-credit accounting.

Static shares also do not model Bread's launch/trade fee snapshots, creator-tax separation or buyback allocation.

**Classification: `REFERENCE ONLY`.**

Reference the mature pull-payment/checks-effects-interactions pattern, not its entitlement model.

### 5.4 FeeEscrow — Doppler `StreamableFeesLockerV2`

**Provenance**

- Repository: <https://github.com/whetstoneresearch/doppler>
- Pinned commit: `b4308a08581471d2298975873f2b661e3367d5c7`
- Source: `src/lockers/StreamableFeesLockerV2.sol`
- Blob: `ac38a7e6e697d205659d8f29ef609faef2f049c7`
- SPDX: BUSL-1.1.
- Root BSL parameters: Whetstone Research; non-production copying/modification permitted; production use requires an applicable Additional Use Grant/commercial license until the earlier specified change date, currently stated as 2027-12-31 or another specified date.

**Architecture / Bread mismatch**

This contract manages locked Uniswap V4 positions, stream beneficiaries, approved migrators and later unlock of LP positions. It is not a per-recipient USDC fee ledger.

It would introduce a second custody/position system and V4-specific state into Bread.

**Classification: `REJECT` as FeeEscrow implementation source.**

It may remain reference material for future lock/vesting edge cases only.

### 5.5 FeePolicy — Flaunch `FeeDistributor` / `StaticFeeCalculator`

**Provenance**

- Pinned repository/commit: `flayerlabs/flaunchgg-contracts@3a7cde1bfcca36760de1e72a45677b9096c9d64d`.
- `src/contracts/hooks/FeeDistributor.sol` — file SPDX MIT.
- `src/contracts/fees/StaticFeeCalculator.sol` — blob `f748b1c352ecbde5d022afa6fd35e03af79d40cf`, file SPDX MIT.

**Useful pattern**

`StaticFeeCalculator` simply returns the configured base fee it receives. This is strong evidence for keeping fee authority outside a low-level calculation primitive.

**Foreign economics to exclude**

`FeeDistributor` implements Flaunch-specific waterfall semantics, including referrer, protocol, creator and bid-wall allocations, global and pool overrides, governance authority, creator-controlled allocation and flETH/V4 state.

Bread must not inherit those percentages, recipients, priority ordering or governance powers.

**Classification: `REFERENCE ONLY`.**

Recommended Bread implication: FeePolicy should be a small Bread-owned policy/snapshot contract or library whose values and rounding meaning come only from Bread Source of Truth. Do not import an external fee distributor as canonical state.

### 5.6 FeePolicy — 0xSplits `PullSplit`

**Provenance**

- Repository: <https://github.com/0xSplits/splits-contracts-monorepo>
- Pinned commit: `71f09d309aabf967994ef623340129f186c340fd`
- Source: `packages/splits-v2/src/splitters/pull/PullSplit.sol`
- Blob: `9fdde2574903288244c9dbb681aa3e26b2f7386c`
- SPDX/root license: GPL-3.0-or-later / GPLv3.

**Security evidence**

The repository contains a detailed Splits V2 audit by Zach Obront. The historical audit scope initially found two High findings that were fixed, along with medium/low issues and explicit architectural caveats. The current pinned 2026 commit is newer than the final reviewed audit commit recorded in that report, so exact-head audit coverage is not assumed.

Audit artifact: `audits/splits-v2.md` in the same repository.

**Bread mismatch**

`PullSplit` depends on `SplitsWarehouse`, split hashes, warehouse balances, batch transfers and optional distributor reward behavior. Inserting it into Bread would create another accounting/custody plane parallel to Bread FeePolicy/FeeEscrow.

The historical audit is also a useful warning against unnecessary payment-system complexity: the report documented a prior incentive-drain interaction in the warehouse architecture and gas/rounding concerns for large recipient sets.

**Classification: `REJECT` as Bread FeePolicy/FeeEscrow implementation.**

Reuse test ideas, not the subsystem.

### 5.7 FeePolicy / launch coordinator — Doppler `Airlock`

**Provenance**

- Repository/commit: `whetstoneresearch/doppler@b4308a08581471d2298975873f2b661e3367d5c7`
- Source: `src/Airlock.sol`
- Blob: `1154a5e39eb2c87adba06741b204bf8379ad0a71`
- SPDX/root license: BUSL-1.1 / Business Source License 1.1.

**Architecture**

Airlock is a broad modular launch coordinator: token factory, governance factory, pool initializer, liquidity migrator and later migration. It also stores protocol and integrator fee balances.

**Foreign economics / privileges**

The inspected source computes its own protocol/integrator fee formula and gives owner module-whitelisting and protocol-fee collection authority. Those are Doppler semantics, not Bread semantics.

**Security evidence**

Certora published a Doppler assessment from November 2024 that identified multiple issues including fund-drain/front-running/validation risks. Doppler also documents broader security review activity. This is valuable maturity evidence but not proof that the current pinned 2026 source is exact audit scope.

Certora report landing page: <https://www.certora.com/reports/doppler-security-assessment-report>

**Classification: `REJECT` for Bread FeePolicy and Launch+Buy source.**

The modular lifecycle may be referenced conceptually, but the code/economics/license should not enter Bread.

### 5.8 Launch+Buy — Flaunch `FlaunchZap`

**Provenance**

- Repository/commit: `flayerlabs/flaunchgg-contracts@3a7cde1bfcca36760de1e72a45677b9096c9d64d`
- Source: `src/contracts/zaps/FlaunchZap.sol`
- File SPDX: MIT.

**Useful architecture**

- A single entrypoint coordinates launch plus optional extra actions.
- Temporary custody/creator state is resolved inside one transaction.
- Premine assets are swept to the intended creator rather than left stranded.
- A fee quote includes launch cost plus premine cost and optional slippage buffer.
- The zap is designed not to retain funds between transactions.

**Bread mismatch**

- ETH/flETH denomination instead of canonical six-decimal ERC20 USDC.
- Flaunch ERC721 ownership semantics.
- Treasury manager / trusted-signer coupling.
- Uniswap V4 and Flaunch PositionManager lifecycle rather than Bread's bonding-curve state.

**Classification: `REFERENCE ONLY` — recommended primary lifecycle reference.**

Bread should implement a native Bread atomic Launch+Buy interface only after the Source of Truth freezes the exact semantics. The reference should inform atomic cleanup/refund/custody tests, not economics.

### 5.9 Launch+Buy — Clanker `ClankerUniv4EthDevBuy`

**Provenance**

- Repository/commit: `clanker-devco/v4-contracts@b004c2edda29fa282a16d5d1441a26484f70b37f`
- Source: `src/extensions/ClankerUniv4EthDevBuy.sol`
- Blob: `498201c2d280461fb9f763a649b5c8c50f6f1cc9`
- File SPDX: MIT.

**Useful architecture**

- Factory-only extension invoked in the deployment flow.
- Exact `msg.value` validation.
- Purchased token delivered to a configured recipient.
- Balance delta used to determine final token output.

**Bread mismatch/security concern**

- Native ETH/WETH input and Permit2/UniversalRouter/V4 dependencies.
- Potential two-hop WETH->paired-token->new-token path.
- The final new-token swap passes `amountOutMinimum = 1`; Bread requires explicit bounded slippage, so this behavior must not be copied.
- It is a post-pool dev-buy extension, not Bread's bonding-curve partial-final-buy/refund flow.

**Classification: `REFERENCE ONLY` — fallback lifecycle reference.**

### 5.10 Snipe — Clanker `ClankerMevDescendingFees`

**Provenance**

- Repository/commit: `clanker-devco/v4-contracts@b004c2edda29fa282a16d5d1441a26484f70b37f`
- Source: `src/mev-modules/ClankerMevDescendingFees.sol`
- Blob: `d2aa634bb7a61055696f8c04107922bec55571a9`
- File SPDX: MIT.

**Mechanism**

Per pool it records:

- starting fee;
- ending fee;
- seconds to decay;
- start timestamp.

It validates nonzero duration/start fee, start >= end, hook maximums and delay. The fee decays parabolically toward the terminal fee and the module disables after the configured period. It also prevents trading in the same timestamp as deployment.

**Security / production evidence**

Clanker publicly deploys sniper modules. Macro A-3 audited `ClankerSniperAuctionV0` and identified an important payee-authorization issue that was addressed. That report is direct evidence that Clanker's anti-snipe code has received professional scrutiny, but it did not establish exact coverage of the current `ClankerMevDescendingFees.sol` blob above.

Current Clanker public token pages also expose sniper-fee configurations in production, providing evidence that descending launch fees are actively used by the platform.

**Bread compatibility boundary**

The inspected module is a Uniswap V4 hook fee module. It does not prove:

- Pons semantics;
- Bread buy-only behavior;
- Bread sell treatment;
- Bread fee recipient path;
- Bread creator-tax separation;
- Bread constants/schedule.

Those must be explicitly defined by Bread before any adaptation.

**Classification: `ADAPT` — conditional on explicit Bread economic/security approval.**

If approved, only the minimal bounded/monotonic decay concept and validation pattern should be adapted behind Bread-owned semantics. Clanker constants and recipients must be excluded.

### 5.11 Snipe — Clanker `ClankerSniperAuctionV2`

**Provenance**

- Repository/commit: `clanker-devco/v4-contracts@b004c2edda29fa282a16d5d1441a26484f70b37f`
- Source: `src/mev-modules/ClankerSniperAuctionV2.sol`
- File SPDX: MIT.

**Mechanism / rejection rationale**

This is materially more invasive than a simple launch tax. It derives an auction signal from transaction gas price vs a basefee peg, pulls WETH payment from a payee, splits payment between factory and LP recipients, and has owner-mutable round/payment settings. It assumes EIP-1559/basefee behavior and Clanker's factory/locker topology.

Macro A-3 documented a prior `ClankerSniperAuctionV0` issue where an encoded payee could cause use of third-party approved assets; the issue was addressed in the audited flow. This is exactly the kind of additional approval/custody attack surface Bread can avoid by not importing the auction design.

**Classification: `REJECT`.**

### 5.12 Snipe — Flaunch fixed-price-window prototype

**Provenance**

- Repository/commit: `flayerlabs/flaunchgg-contracts@3a7cde1bfcca36760de1e72a45677b9096c9d64d`
- Source: `src/contracts/fees/prototype/FixedPriceWindowFeeCalculator.sol`
- Blob: `3c77d45ab96b9900f9dc480cd30d672f8e545b18`
- SPDX: MIT.

The source itself states, verbatim in its header, that it is a prototype, not audited, not tested and not for production. It enforces a fixed-price window by reverting buys that move beyond a configured launch tick, with amount- or time-bounded modes.

This is useful evidence that a launch-fairness rule must define partial-fill/revert semantics very carefully. It is not an acceptable production source candidate.

**Classification: `REJECT`.**

## 6. Recommended component decisions

These are **research recommendations, pending Source-of-Truth approval**.

### A. FeeEscrow

**Recommended:** adapt the minimal `ClankerFeeLocker` ledger/deposit/claim pattern into a Bread-owned, USDC-only FeeEscrow.

Do not reuse Clanker owner/depositor policy as-is. Bread must own credit authorization, total-outstanding accounting, solvency reconciliation and canonical events.

**Fallback:** a minimal Bread-specific escrow using the same mature checks-effects-interactions/SafeERC20 patterns, with Flaunch and OpenZeppelin as secondary references.

**Rejected:** Doppler StreamableFeesLocker; 0xSplits warehouse architecture.

### B. FeePolicy / fee splitting

**Recommended:** no external fee-policy contract should become Bread authority. Build a minimal Bread-owned FeePolicy/snapshot surface after economics are frozen in Source of Truth.

Use Flaunch `StaticFeeCalculator`/`FeeDistributor`, OpenZeppelin `PaymentSplitter`, and 0xSplits tests only as reference material for separation of policy, pull settlement, rounding and failure modes.

**Fallback:** none as a third-party subsystem. A Bread-owned policy layer is lower continuity/security cost than importing a second accounting system.

### C. Launch+Buy

**Recommended:** Bread-owned atomic Launch+Buy design, using `FlaunchZap` as the primary lifecycle/reference source and Clanker's dev-buy extension as a secondary reference.

No external implementation matches Bread's canonical USDC bonding-curve, partial-final-buy/refund and fee semantics closely enough for safe source-level reuse.

**Fallback:** keep `LAUNCH_AND_BUY_SOURCE` open until Bread's exact interface and transaction semantics are approved; do not import Doppler or a DEX-specific zap.

### D. Snipe protection

**Best concrete source candidate:** Clanker's bounded descending-fee mechanism.

However, selecting it would be an explicit Bread fork from unresolved Pons snipe semantics. This is not a research-only choice because it changes who pays what during a launch.

If Bread adopts it, the Source of Truth must separately freeze:

- buy-only vs both directions;
- starting and terminal tax/fee;
- duration and decay function;
- exemptions;
- proceeds allocation;
- admin mutability limits;
- exact interaction with base fee/creator tax;
- terminal behavior.

Until that economic/security decision is approved, `EXACT_SNIPE_IMPLEMENTATION` remains open.

## 7. Blocker impact

No blocker is silently cleared by this research artifact.

| Blocker | Research result |
|---|---|
| `FEE_ESCROW_SOURCE` | **Candidate resolution available:** Clanker-derived Bread adaptation is recommended. Clear only after explicit approval, SOT amendment, design/TDD/invariant/integration proof. |
| `LAUNCH_AND_BUY_SOURCE` | **Replacement path identified, not cleared:** Bread-owned atomic implementation with Flaunch/Clanker reference evidence. Requires Bread interface/semantic approval and SOT amendment. |
| `EXACT_SNIPE_IMPLEMENTATION` | **Still open:** Clanker descending fee is a credible alternative, but choosing it changes Bread economic semantics and is not Pons parity. |
| `CURRENT_PONS_FACTORY_SOURCE_PARITY` | Unchanged. |
| `LIVE_RUNTIME_CONFIG` | Unchanged. |
| `PONS_AUDIT_FINDINGS` | Unchanged. External audits do not prove Pons findings. |
| `ARC_MAINNET_VALUES` | Unchanged. |

## 8. Source-of-Truth amendments required after approval

The consolidated post-research Source Pack v1.3 should record, at minimum:

1. FeeEscrow selected source inspiration/provenance and exact excluded Clanker assumptions.
2. Bread USDC-only escrow interface, credit authority, event semantics and `totalOutstanding` solvency meaning.
3. Bread FeePolicy as the sole fee/economic source of truth; external splitters remain reference only.
4. Canonical fee snapshot timing, rounding/remainder ownership and creator-tax separation.
5. Bread-owned Launch+Buy atomic interface and exact refund/slippage/partial-final-buy semantics.
6. Explicitly excluded Flaunch ETH/flETH, treasury-manager/NFT, bid-wall/referral/governance economics.
7. Explicitly excluded Clanker WETH/V4/Permit2, gas-auction, factory reward and mutable foreign-admin economics.
8. Doppler BUSL restriction and decision not to use its code in production without a separately established license grant.
9. 0xSplits GPL/warehouse decision and decision not to create a parallel payment ledger.
10. Snipe mechanism decision, if approved, with all economic constants/authority frozen as Bread semantics rather than copied values.
11. New tests/invariants and vertical integration impact map for contracts -> canonical events -> SDK -> indexer -> API -> dashboard/E2E as those consumers exist.
12. Explicit blocker transitions and evidence needed before each may be marked cleared.

## 9. Required next gate

**NEXT_ACTION:** present this matrix and the recommended architecture to the user. Production implementation remains blocked.

The consequential decision that cannot be inferred from external source evidence is snipe economics: whether Bread intentionally replaces unresolved Pons semantics with a Bread-owned descending launch fee/tax inspired by the Clanker pattern, or keeps `EXACT_SNIPE_IMPLEMENTATION` unresolved pending better Pons evidence.

Fee percentages, creator percentages, buyback allocations, snipe constants and live runtime values remain unselected by this artifact.

## 10. Research verdict

`DAY_3_EXTERNAL_COMPONENT_RESEARCH_MATRIX_COMPLETE_PENDING_ARCHITECTURE_APPROVAL`

The research supports a coherent Bread path rather than a stitched protocol:

- **FeeEscrow:** adapt one minimal mature primitive into Bread-owned USDC semantics.
- **FeePolicy:** keep Bread-owned; use external systems only as references/tests.
- **Launch+Buy:** keep Bread-owned atomic lifecycle; external zaps are references only.
- **Snipe:** credible alternative source exists, but choosing the economics requires explicit approval.

No Day-3 production financial code is authorized by this verdict.
