# Bread Source Pack v1.3 — Post-Research Architecture Freeze

Status: **APPROVED SOURCE-OF-TRUTH AMENDMENT — IMPLEMENTATION GATE, NOT PRODUCTION CODE**  
Project: Bread  
Source Pack: v1.3  
Approval date: 2026-08-08 14:35 +01:00  
Repository: `Dtwosam/bread`  
Working branch: `checkpoint/day3-trading-fees-escrow-preflight`  
Accepted integrated baseline: `5d13689f1ebc54f609c0fcf61ea43287b207e61a`  
Component research matrix: `docs/source-reconciliation/day3-external-component-research-matrix.md`

## 1. Authority and scope

This document is the consolidated post-research Source Pack v1.3 amendment for Bread.

It does **not** replace the full v1.1 Project Source set. It freezes only the previously unresolved Day-3/Day-4 architecture decisions covered here. All v1.1 requirements remain controlling unless this document explicitly amends them.

The existing source hierarchy remains intact. In particular:

- `00-bread-master-source-of-truth-v1.1` remains the project-level authority except for decisions explicitly superseded here.
- `03-pons-v2-to-arc-fork-delta` remains the fork-delta authority except where this amendment converts an unresolved exact-source/reconstruction gate into an explicitly approved Bread-owned implementation decision.
- `05C-financial-invariants-security-verification-plan` remains mandatory and is extended, not weakened, by this amendment.
- `06C-exact-10-day-build-order-daily-gates-v1.1` remains the build-order authority. This amendment resolves sourcing/architecture gates but does not authorize skipping its tests, integration gates or independent-review requirements.
- `06E`, `06F`, `06H` and the current-build-state handoff protocol continue to require one continuously integrated Bread baseline. `LOCAL_COMPONENT_PASS != BREAD_PASS` remains controlling.

This amendment is grounded in:

1. the accepted Day-2 integrated baseline;
2. the frozen old Pons V2 source/behavior evidence already retained by Bread;
3. the Day-3 external-component research matrix;
4. exact third-party source provenance/license review recorded in that matrix; and
5. explicit architecture/economic approval to proceed with the recommended Bread-owned direction.

## 2. Non-negotiable Bread boundaries

The following remain unchanged:

- Bread V1 finance uses **canonical 6-decimal ERC20 USDC only**.
- No native quote asset is introduced into launchpad business accounting.
- Tracked reserves, not raw token balances, remain authoritative for curve state where already specified.
- Direct donations must not rewrite price, graduation state, fee entitlement or escrow entitlement.
- Existing launch snapshots cannot be rewritten by later global configuration changes.
- No external protocol becomes a standalone Bread subsystem merely because its code is used as a reference.
- No third-party fee percentages, recipients, snipe parameters, admin powers, custody model or chain constants become Bread economics by inheritance.
- Unresolved Arc mainnet constants remain unresolved until officially published/verified.
- Current-live Pons parity must not be claimed where exact source/runtime evidence remains unavailable.

## 3. Approved architecture decision A — FeeEscrow

### 3.1 Verdict

**ADAPT** the minimal accounting pattern demonstrated by Clanker `ClankerFeeLocker`, but implement a **Bread-owned FeeEscrow** behind Bread-owned interfaces and Bread-owned accounting authority.

Primary technical reference retained in the research matrix:

- repository: `clanker-devco/v4-contracts`
- pinned source commit: `b004c2edda29fa282a16d5d1441a26484f70b37f`
- reference path: `src/ClankerFeeLocker.sol`
- reference license evidence: MIT/SPDX in inspected source

This is an adaptation decision, not a wholesale import decision.

### 3.2 Canonical asset and ledger

Bread FeeEscrow shall:

- accept/account only the canonical Bread USDC configured by the integrated Bread deployment;
- maintain recipient claim balances in exact USDC base units;
- maintain an explicit `totalOutstanding` or equivalent authoritative outstanding-claims accumulator;
- never infer recipient entitlement from the escrow's raw USDC balance;
- never allow unsolicited USDC donations to increase any user's claimable amount;
- expose deterministic balance/outstanding views required by contracts, indexers and monitoring.

### 3.3 Credit authority

Fee credits are protocol accounting actions, not permissionless deposits.

The final interface must restrict credit authority to the exact Bread trading/fee-accounting path frozen by the implementation design. No arbitrary EOA or unrelated contract may assign claims.

The credit operation must reconcile actual USDC custody with the amount credited. If transfer-in semantics are used, the credited amount must equal the verified amount actually received under Bread's canonical-USDC assumptions.

### 3.4 Claim semantics

Bread FeeEscrow must preserve the minimum invariants already specified in `03` and `05C`:

- a recipient can claim only its own ledger entitlement;
- claim state is debited before external token transfer/control;
- a reverting transfer reverts the transaction so the user's claim is preserved;
- a successful claim cannot be replayed;
- no admin/guardian/rescue path may withdraw USDC required to back recipient claims;
- deterministic credit and claim events must expose recipient, amount and sufficient accounting identity for canonical indexing.

Permissionless execution **on behalf of** a recipient is allowed only if funds are always sent to the snapshotted/credited recipient and the caller cannot redirect them.

### 3.5 Solvency invariant

At every externally observable successful state transition:

`USDC.balanceOf(FeeEscrow) >= totalOutstanding`

The implementation and stateful invariant suite must prove this across credits, claims, failed claims, direct donations and arbitrary valid operation sequences.

Any excess USDC above `totalOutstanding` is not recipient entitlement. Treatment of genuine excess/recovery must be separately specified and may never reduce backing below outstanding claims.

### 3.6 Explicitly rejected inheritance

Bread does not inherit:

- Clanker's multi-token fee ledger as a Bread requirement;
- Flaunch flETH/native unwrap semantics;
- Uniswap V4 `PoolId` as FeeEscrow accounting identity;
- mutable third-party indexer authority over entitlement;
- OpenZeppelin PaymentSplitter aggregate-receipt/share accounting;
- Doppler streaming-position custody.

## 4. Approved architecture decision B — FeePolicy and fee splitting

### 4.1 Verdict

**BREAD-OWNED IMPLEMENTATION.**

No external splitter, warehouse or protocol-specific fee distributor becomes canonical Bread fee policy.

Third-party fee code remains reference material only.

### 4.2 Authority and snapshots

Bread FeePolicy is the only authority for the fee parameters that Bread itself controls.

The implementation must preserve the existing project distinction between:

- base protocol/creator fee allocation; and
- optional creator tax where Pons semantics define it as separate.

Per-launch economics that are defined as immutable/snapshotted must be frozen at the launch boundary and must not be rewritten by later global policy changes.

Where `LIVE_RUNTIME_CONFIG` remains unresolved, this Source Pack does **not** invent or hardcode a missing percentage. Unknown live values stay unknown until reconciled or explicitly replaced by a later approved Bread economic decision.

### 4.3 Accounting requirements

For every charged trade:

- fee/tax calculation uses exact Bread rounding rules;
- base-fee allocation reconciles exactly to the charged base fee;
- creator tax remains separately identifiable where applicable;
- all escrow-routed recipient amounts reconcile to credits actually created in FeeEscrow;
- no fee path relies on raw contract donations for entitlement;
- no component may silently retain unaccounted USDC.

`INV-001` through `INV-006`, `INV-030` through `INV-035`, and all other applicable 05C invariants remain mandatory.

### 4.4 Governance boundary

Admin/multisig capabilities may change only those future/global parameters explicitly allowed by the controlling permissions spec.

They may not:

- rewrite historical launch snapshots;
- redirect already-earned recipient claims;
- bypass creator-tax bounds;
- move escrow-backed claims;
- use the emergency role to create new economics.

## 5. Approved architecture decision C — Launch+Buy

### 5.1 Verdict

**BREAD-OWNED ATOMIC LIFECYCLE.**

Flaunch `FlaunchZap` is retained as the primary lifecycle/reference pattern and Clanker developer-buy flow as a secondary reference. Neither is reused as Bread production semantics.

### 5.2 Canonical behavior

Bread Launch+Buy must execute as one atomic user intent over Bread's own factory/deployer/trading interfaces.

It must preserve:

- canonical 6-decimal USDC input;
- Bread launch snapshot/economics identity;
- the source-verified Bread/Pons curve buy path;
- user-supplied slippage/minimum-output protection;
- partial final-buy clamp semantics;
- exact refund/accounting of unconsumed USDC on a final crossing buy;
- no stranded temporary token or USDC custody;
- full transaction rollback if any required launch or buy stage fails.

The atomic wrapper must not weaken the underlying Buy invariants. In particular, `INV-020`, `INV-022`, donation resistance and tracked-reserve accounting remain controlling.

### 5.3 No foreign routing semantics

Bread Launch+Buy must not introduce as implicit requirements:

- ETH/WETH launch funding;
- Permit2;
- Universal Router;
- Uniswap V4 pool keys;
- Flaunch NFTs/treasury managers;
- a hardcoded `amountOutMinimum = 1`-style final purchase;
- any external protocol's launch fee or recipient model.

### 5.4 Implementation timing

The architecture is now resolved, but production Launch+Buy remains a Day-4 implementation item under `06C`. Day-3 code must not pull it forward merely because its architecture is frozen.

## 6. Approved architecture decision D — Bread anti-snipe protection

### 6.1 Verdict

Bread will implement a **Bread-owned descending, buy-only opening anti-snipe tax/fee mechanism**.

Clanker `ClankerMevDescendingFees` is retained only as the strongest technical reference for bounded per-launch configuration, monotonic decay and deterministic terminal behavior.

Bread does **not** adopt Clanker's percentages, duration, parabolic formula, hook architecture or other economics.

### 6.2 Existing verified behavioral target

The existing `07A` reconciliation records the live Pons behavior available to Bread as:

- buy-only opening tax;
- starts at approximately 99%;
- decays exponentially to zero over 5 seconds;
- launcher/creator-fee recipient and fixed launch-time exemptions can be exempt.

This Source Pack preserves that verified behavior as Bread's target envelope because it is already part of the fork evidence. It does not claim exact Pons formula parity.

### 6.3 Frozen Bread semantic requirements

The Bread implementation must be:

- buy-only unless a later explicit Source-of-Truth amendment says otherwise;
- bounded so tax can never exceed the approved maximum or become negative;
- monotonic non-increasing throughout the protection window;
- exactly zero at/after the terminal boundary;
- based on a launch-time snapshot that cannot be reset to restart the high-tax period;
- explicit about every exemption at launch/configuration time;
- impossible for arbitrary users to self-exempt;
- routed through Bread's canonical fee-accounting/FeeEscrow path so proceeds cannot disappear;
- independent of user-controlled raw balance donation effects.

`INV-040` through `INV-044` remain mandatory.

### 6.4 Formula gate — deliberately still open

The exact fixed-point decay function is **not** recovered from a verified current Pons implementation and is therefore not invented in this document.

The old blocker `EXACT_SNIPE_IMPLEMENTATION` is superseded as an architecture/source blocker by the approved Bread-owned decision, but a narrower implementation gate remains:

`BREAD_SNIPE_DECAY_FORMULA`

Before Day-4 production implementation, Bread must freeze one deterministic formula that satisfies the target envelope and then prove:

- initial/maximum bound behavior;
- monotonicity for every timestamp in the window;
- exact terminal zero;
- rounding safety at 6-decimal USDC amounts;
- no timestamp/reset bypass;
- exemption correctness;
- differential vectors against any verified Pons observations available at that time.

This formula gate is a bounded implementation/economic exactness decision, not a reason to reopen the overall anti-snipe architecture.

## 7. Continuous integration impact map

No approved sourced primitive may be developed as an isolated mini-product.

### 7.1 Day-3 FeePolicy/FeeEscrow/trading lane

Upstream inputs:

- accepted Day-2 tracked curve state and bonding-curve math;
- canonical USDC configuration;
- launch snapshots/economic configuration interfaces already present;
- controlling fee/tax bounds from Source of Truth.

Same-lane integration requirements:

- Buy/Sell computes exact fee/tax obligations;
- FeePolicy resolves the snapshotted split;
- FeeEscrow receives/records the exact recipient credit in the same canonical accounting flow;
- claims are exercised against those credits;
- indexer-facing events/interfaces are frozen from the canonical contract accounting rather than recreating balances off-chain.

Required regression evidence includes:

- launch -> buy -> sell -> claim;
- slippage failure rollback;
- partial final-buy/refund reconciliation;
- fee/tax rounding boundaries;
- failed claim transfer rollback;
- donation resistance;
- solvency under stateful sequences;
- all applicable 05C invariants;
- all previously passing Day-1/Day-2 regressions.

### 7.2 Day-4 Launch+Buy/snipe lane

Launch+Buy and anti-snipe must consume the already-integrated canonical factory/trading/FeePolicy/FeeEscrow interfaces. They may not define competing fee or accounting state.

Required regression evidence includes:

- atomic launch+buy success;
- launch+buy rollback on buy/slippage failure;
- final partial-buy refund through atomic path;
- anti-snipe maximum/monotonic/terminal vectors;
- exempt and non-exempt launch paths;
- sell unaffected under buy-only protection;
- tax proceeds reconcile through the same FeePolicy/FeeEscrow path;
- no restart/reset of protection window;
- prior Day-3 claim/solvency invariants remain green.

## 8. External-component classifications after approval

| Area | Candidate | Final use in Bread |
| --- | --- | --- |
| FeeEscrow | Clanker `ClankerFeeLocker` | **ADAPT pattern into Bread-owned implementation** |
| FeeEscrow | Flaunch `FeeEscrow` | REFERENCE_ONLY |
| FeeEscrow | OpenZeppelin `PaymentSplitter` | REFERENCE_ONLY |
| FeeEscrow | Doppler `StreamableFeesLockerV2` | REJECT |
| FeePolicy | Bread-owned policy | **APPROVED CANONICAL DIRECTION** |
| FeePolicy | Flaunch fee calculator/distributor | REFERENCE_ONLY |
| FeePolicy | 0xSplits PullSplit/Warehouse | REJECT as Bread subsystem |
| FeePolicy | Doppler Airlock fees | REJECT |
| Launch+Buy | Bread-owned atomic lifecycle | **APPROVED CANONICAL DIRECTION** |
| Launch+Buy | FlaunchZap | REFERENCE_ONLY — primary lifecycle reference |
| Launch+Buy | Clanker Univ4 dev-buy | REFERENCE_ONLY — secondary flow reference |
| Snipe | Bread-owned descending buy-only protection | **APPROVED CANONICAL DIRECTION** |
| Snipe | ClankerMevDescendingFees | ADAPT/REFERENCE pattern only; no inherited economics |
| Snipe | ClankerSniperAuctionV2 | REJECT |
| Snipe | Flaunch FixedPriceWindow prototype | REJECT |

## 9. Blocker disposition

### 9.1 Resolved/superseded by this approved Source Pack

- `FEE_ESCROW_SOURCE` -> **RESOLVED_BY_APPROVED_BREAD_ADAPTATION_ARCHITECTURE**. Exact Pons source is no longer required to begin Bread's invariant-driven FeeEscrow implementation after the Day-3 implementation plan/gate is frozen.
- `LAUNCH_AND_BUY_SOURCE` -> **RESOLVED_BY_APPROVED_BREAD_OWNED_ARCHITECTURE**. Exact public Pons router source is no longer required for architecture selection; Bread must still match the retained behavioral requirements and tests.
- `EXACT_SNIPE_IMPLEMENTATION` -> **SUPERSEDED_BY_APPROVED_BREAD_OWNED_ARCHITECTURE**. Exact Pons source parity is no longer the implementation prerequisite.

### 9.2 Active bounded gate created by this Source Pack

- `BREAD_SNIPE_DECAY_FORMULA` -> exact deterministic Bread decay formula must be frozen and proved before Day-4 production implementation.

### 9.3 Still active and unchanged

- `CURRENT_PONS_FACTORY_SOURCE_PARITY`
- `LIVE_RUNTIME_CONFIG`
- `PONS_AUDIT_FINDINGS`
- `ARC_MAINNET_VALUES`

These unresolved items must continue to be represented honestly. They do not authorize guessed values.

## 10. Implementation authorization boundary

This Source Pack resolves the architecture-selection gate. It does **not** directly authorize an unplanned production-code jump.

Before Day-3 money-path Solidity begins, the next durable artifact must freeze the Day-3 implementation plan/continuous-integration impact map for:

1. Buy/Sell with slippage and partial final buy/refund;
2. Bread FeePolicy snapshot and creator-tax separation;
3. Bread FeeEscrow credit/claim/solvency accounting; and
4. the exact tests/invariants and integration order required for Bread PASS.

Buyback/vesting remains separately gated by its existing source/invariant decision and must not be smuggled into the FeeEscrow lane.

Launch+Buy and anti-snipe remain Day-4 production scope even though their architecture is now frozen.

## 11. Approval verdict

**SOURCE_PACK_V1_3_POST_RESEARCH_ARCHITECTURE_FREEZE_APPROVED**

Approved direction:

- FeeEscrow: Bread-owned canonical-USDC adaptation of the minimal Clanker locker pattern.
- FeePolicy: Bread-owned canonical policy/snapshot accounting.
- Launch+Buy: Bread-owned atomic lifecycle using external systems as reference only.
- Snipe: Bread-owned descending buy-only opening protection, preserving the verified Pons behavior envelope while explicitly freezing Bread's exact decay formula before Day-4 implementation.

No production financial code is introduced by this document.
