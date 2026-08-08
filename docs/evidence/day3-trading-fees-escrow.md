# Day 3 — Trading, Fees & Escrow Evidence

Status: **CANDIDATE — FINAL EXACT-HEAD CLOSEOUT CI REQUIRED**  
Repository: `Dtwosam/bread`  
Execution branch: `checkpoint/day3-trading-fees-escrow`  
Draft PR: `#8`  
Accepted integration baseline: `5d13689f1ebc54f609c0fcf61ea43287b207e61a`  
Preflight/design handoff head: `6968003b7cce91dfcc433b9339375b88cb1c0882`

## 1. Controlling source and design

Day 3 was implemented from the approved post-research architecture, not from a floating external protocol snapshot:

- Bread Source Pack v1.3: `docs/source-reconciliation/bread-source-pack-v1.3.md`
- Day-3 design: `docs/superpowers/specs/2026-08-08-day3-trading-fees-escrow-design.md`
- Day-3 TDD/integration plan: `docs/superpowers/plans/2026-08-08-day3-trading-fees-escrow.md`
- Day-3 source inventory: `config/protocol/day3-trading-source-inventory.json`
- Day-3 source-integrity validator: `scripts/validation/validate-day3-source-integrity.mjs`

Frozen Pons trading reference:

- repository: `ponsdotdev/ponsfamily`
- commit: `d5491e20be56051a68abf47136f6890c3ce3ff7d`
- path: `contractsV2/src/v2/PonsV2BondingCurve.sol`
- blob: `a5d84b3c355a1661e1bf61a4dd4e29591fbf6074`
- use: frozen ERC-20 trading behavior reference only; **not** a claim of current-live Pons parity.

FeeEscrow adaptation reference:

- repository: `clanker-devco/v4-contracts`
- commit: `b004c2edda29fa282a16d5d1441a26484f70b37f`
- path: `src/ClankerFeeLocker.sol`
- use: `ADAPT_PATTERN_ONLY`

All Day-3 OpenZeppelin additions are vendored from the frozen Pons tree and checked by exact Git blob SHA. Dynamic dependency installation remains disabled.

## 2. Production scope built

### BreadFeeEscrow

Implemented canonical-USDC custody and claim accounting with:

- owner-managed authorized creditor set;
- nonzero recipient and nonzero credit requirements;
- exact balance-delta custody verification before entitlement creation;
- per-recipient ledger plus `totalOutstanding`;
- donation/surplus separation;
- full and partial pull claims;
- state debit before external token transfer;
- reentrancy protection on claims;
- no alternate-recipient claim path;
- no admin rescue of recipient claims;
- deterministic credit/claim/authority events;
- frozen consumer interface in `IBreadFeeEscrow`.

### BreadFeePolicy

Implemented Bread-owned future-launch policy with:

- explicit constructor inputs; no guessed live defaults;
- protocol fee recipient;
- trade fee BPS;
- protocol share of the base fee;
- maximum creator-tax BPS;
- frozen combined trade-fee + creator-tax safety ceiling of 20%;
- owner-only future-policy updates;
- live/rotatable fee-sweep operator;
- validation-before-write and deterministic update events.

Existing curves snapshot policy economics at launch. Later policy changes do not rewrite an existing curve.

### BreadBondingCurve trading layer

Implemented canonical 6-decimal ERC-20 USDC trading over `BreadTrackedCurveState`:

- factory-only one-shot token initialization;
- snapshotted fee economics;
- creator tax bounded by the launch snapshot;
- ordinary Buy with exact USDC receipt, quote-leg fee/tax, price slippage, tracked reserve updates and token delivery;
- ordinary Sell with exact token receipt, gross quote pricing, quote-leg fee/tax, net-output slippage, tracked reserve updates and USDC payout;
- frozen-source partial final-buy clamp to `sellableTokens()`;
- token-side repricing via `getAmountIn`;
- ceiling gross-up for fee/tax;
- exact refund of offered quote above actual final-buy spend;
- source-derived clamped-buy price-bound slippage semantics;
- Buy/Sell closure once `readyToGraduate()` is reached;
- factory-controlled creator fee-recipient rotation for future sweeps;
- no-buyback fee sweep into canonical FeeEscrow;
- base-fee split between protocol and creator, with creator tax kept separate and assigned entirely to the creator;
- state/pending-bucket updates before external escrow calls so failed handoff rolls back atomically.

## 3. Explicitly not built

The execution branch does **not** add or authorize:

- buyback or vesting execution;
- automatic graduation or DEX liquidity transfer;
- Launch+Buy;
- anti-snipe production code or a Bread decay formula;
- native quote handling;
- guessed live fee percentages;
- Arc mainnet constants;
- current-live Pons parity claims.

## 4. TDD evidence

Production-facing tests were written before each new behavior. Representative observed RED gates include:

- run `31260602928`: first FeeEscrow test failed only because `BreadFeeEscrow.sol` did not exist; bootstrap validation passed.
- run `31260943328`: donation/surplus RED.
- run `31261005155`: full-claim RED.
- run `31261124881`: corrected partial-claim RED after discarding a malformed test fixture.
- run `31261235874`: zero-recipient credit runtime RED with all prior tests passing.
- run `31261286066`: zero-value credit runtime RED with all prior tests passing.
- run `31261603608`: FeePolicy production files missing RED.
- run `31261661874`: five invalid-policy cases failed while prior tests passed.
- run `31261818515`: ordinary Buy RED because `BreadBondingCurve.sol` did not exist.
- run `31261892628`: ordinary Sell RED because `sell(...)` did not exist.
- run `31262046762`: final crossing Buy failed at the temporary partial-fill guard.
- run `31262169098`: fee-sweep RED because `sweepFees()` did not exist.
- run `31262246192`: creator fee-recipient authority RED because its setter did not exist.

Two failures were explicitly rejected as invalid RED evidence and did not authorize production changes:

- a Solidity test variable used the reserved word `partial`;
- a Foundry test name used the removed legacy `testFail...` convention.

Later stack-too-deep failures in expanded security/invariant tests were test-structure issues only and were corrected without changing production semantics.

## 5. Security, fuzz and invariant coverage

### FeeEscrow

Coverage includes:

- unauthorized credit rejection;
- owner-only creditor authority changes;
- exact custody/ledger/outstanding reconciliation;
- direct donation creates surplus only;
- zero recipient / zero amount rejection;
- over-claim rollback;
- failed ERC-20 transfer rollback;
- short/fee-like transfer rejection without creating underfunded entitlement;
- token callback observes claim ledger/outstanding already debited before transfer control;
- fuzzed partial claims preserve solvency;
- sequential two-recipient credits, partial claims, donation, final claims and surplus reconciliation.

Required invariant exercised:

`USDC.balanceOf(FeeEscrow) >= totalOutstanding`

and, for known test recipients, recipient ledgers sum exactly to `totalOutstanding`.

### Trading

Coverage includes:

- ordinary Buy accounting;
- ordinary Sell accounting;
- price/slippage rollback for Buy and Sell;
- frozen economic snapshot despite later FeePolicy changes;
- creator-tax maximum enforcement;
- factory-only one-shot initialization;
- quote and token donation resistance on concrete trading reserves;
- final-fill clamp/reprice/refund;
- clamped-fill price-bound semantics and one-unit-too-strict rollback;
- final-fill sell closure;
- repeated fuzzed Buy→Sell cannot extract more quote than supplied;
- fuzzed oversized final buys stop exactly at the reserved floor and refund all quote above actual spend;
- sequential two-Buy → Sell → donation → policy update → fee sweep → protocol/creator claims with reserve/accounting checks at every phase.

Key identities exercised include:

- `realQuoteReserve = trackedQuote - quoteFeeBalance - creatorTaxBalance`;
- `getReserves().quote = phantomQuote + realQuoteReserve`;
- `getReserves().token = trackedTokens`;
- `trackedTokens >= reservedTokens`;
- raw donations do not change tracked reserves;
- after a successful sweep, real quote reserve is unchanged while pending fee/tax leaves `trackedQuote` and enters FeeEscrow custody;
- protocol claim + creator claim equals the exact swept pending amount;
- after both claims, FeeEscrow `totalOutstanding == 0` and escrow custody attributable to those claims is zero.

## 6. Integration handoff evidence

The canonical flow exercised is:

`Buy/Sell -> pending base fee + creator tax -> sweepFees -> FeeEscrow.credit -> recipient claim`

Additional integration proofs cover:

- live sweep-operator rotation without rewriting snapshotted curve economics;
- unauthorized sweep rejection;
- FeeEscrow-credit failure rolling back curve buckets, tracked quote and custody;
- creator fee-recipient rotation affecting future sweeps only, without rewriting previously credited claims;
- creator and protocol claims settling the escrow outstanding ledger to zero.

`LOCAL_COMPONENT_PASS != BREAD_PASS` remains controlling: the escrow is evaluated through the actual trading handoff, not contract tests alone.

## 7. Remaining blockers / future gates

No unresolved external blocker was silently cleared by implementation. Remaining gates include:

- `CURRENT_PONS_FACTORY_SOURCE_PARITY`
- `BREAD_SNIPE_DECAY_FORMULA`
- `LIVE_RUNTIME_CONFIG`
- `PONS_AUDIT_FINDINGS`
- `ARC_MAINNET_VALUES`

Day-4 Launch+Buy and anti-snipe work remains separately gated. Buyback/vesting and graduation transfer remain separately gated as specified by the controlling source pack/build order.

## 8. Candidate verdict

**DAY_3_TRADING_FEES_ESCROW_IMPLEMENTATION_CANDIDATE_READY_FOR_EXACT_HEAD_CLOSEOUT**

This is not the final Day-3 PASS yet. Final PASS requires the exact evidence/build-state head itself to complete the repository CI gates successfully with no additional production changes.
