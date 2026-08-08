# Day 3 Trading, Fees & Escrow Implementation Plan

**Goal:** Implement Bread's canonical-USDC Buy/Sell money path, snapshotted FeePolicy and solvent pull-based FeeEscrow from the accepted Day-2 curve core, while keeping buyback, graduation transfer, Launch+Buy and anti-snipe out of Day 3.

**Architecture:** `BreadBondingCurve` extends the integrated `BreadTrackedCurveState`; it snapshots current `BreadFeePolicy` economics at construction, accrues quote-denominated base fee and creator tax during Buy/Sell, and later sweeps the fixed protocol/creator allocation into `BreadFeeEscrow`. `BreadFeeEscrow` is a canonical-USDC-only authorized-credit ledger with explicit `totalOutstanding` solvency accounting. Every unit is wired into the same Bread path before PASS.

**Starting head:** `60a0dc052b73fe7e829ae59fa3ba2b26d6d37a41` plus this design/plan documentation on `checkpoint/day3-trading-fees-escrow-preflight`.

**Production branch to create for execution:** `checkpoint/day3-trading-fees-escrow`

**Tech stack:** Solidity 0.8.26, Foundry v1.5.0, Node 24 validation, exact frozen Pons OpenZeppelin source files, GitHub Actions.

## Global constraints

- Source Pack v1.3 is controlling for the new architecture decisions.
- Canonical quote is 6-decimal ERC20 USDC only.
- No defaults are invented for unresolved live fee percentages; tests/deployment fixtures provide explicit bounded parameters.
- Frozen Pons trading reference is `PonsV2BondingCurve.sol` blob `a5d84b3c355a1661e1bf61a4dd4e29591fbf6074` at commit `d5491e20be56051a68abf47136f6890c3ce3ff7d`.
- Clanker `ClankerFeeLocker.sol` is pattern reference only; Bread's FeeEscrow interface/accounting remains Bread-owned.
- No production file may be added before its production-facing test has produced a specific RED.
- No buyback/vesting, graduation transfer, Launch+Buy, anti-snipe, native quote, guessed Arc mainnet values or current-live parity claim enters this lane.
- `LOCAL_COMPONENT_PASS != BREAD_PASS`.

---

## Task 1 — Freeze Day-3 source/dependency inventory and capture FeeEscrow RED

**Files**

- Create: `config/protocol/day3-trading-source-inventory.json`
- Create: `contracts/test/BreadFeeEscrow.t.sol`
- Create test helpers only as required for transfer/reentrancy failure characterization.
- Production files intentionally absent:
  - `contracts/src/interfaces/IBreadFeeEscrow.sol`
  - `contracts/src/fees/BreadFeeEscrow.sol`

### Steps

- [ ] Record Source Pack v1.3 commit, frozen Pons curve path/blob, Clanker FeeLocker provenance, and every exact frozen OpenZeppelin file used by Day 3.
- [ ] Extend the executable source-integrity validator so every newly vendored OpenZeppelin file is checked by exact Git blob SHA.
- [ ] Add FeeEscrow tests for constructor/zero address, unauthorized credit, exact credit, direct donation non-entitlement, full claim, partial claim, over-claim, deterministic events, and solvency views.
- [ ] Add a malicious/reentrant token test double only to prove state-before-transfer/failure rollback behavior; it must never become a supported production quote token.
- [ ] Run Foundry and capture the expected RED caused only by missing `IBreadFeeEscrow` / `BreadFeeEscrow` production files.
- [ ] Commit RED evidence.

**Expected RED:** missing Bread FeeEscrow production source/interface, with unrelated existing tests remaining healthy.

---

## Task 2 — Implement minimal BreadFeeEscrow and reach local GREEN

**Files**

- Create: `contracts/src/interfaces/IBreadFeeEscrow.sol`
- Create: `contracts/src/fees/BreadFeeEscrow.sol`
- Vendor exact frozen OpenZeppelin transfer/reentrancy dependencies required by the implementation.

### Required implementation

- [ ] Immutable canonical USDC token.
- [ ] Owner-controlled `authorizedCreditor` mapping; no balance-edit/admin-withdraw function.
- [ ] `credit(recipient, amount)` pulls exact USDC from the authorized caller using balance-delta verification.
- [ ] `balanceOf[recipient]` and `totalOutstanding` increase exactly by custody received.
- [ ] `claim()` and `claim(amount)` debit state before SafeERC20 transfer to `msg.sender` only.
- [ ] `surplus()` is `max(raw USDC balance - totalOutstanding, 0)` and creates no entitlement.
- [ ] Events exactly match the frozen Day-3 design.

### GREEN gate

- [ ] FeeEscrow deterministic tests pass.
- [ ] FeeEscrow fuzz tests cover arbitrary bounded credit/partial-claim sequences.
- [ ] Stateful invariant proves `USDC.balanceOf(escrow) >= totalOutstanding`.
- [ ] Direct donations never alter `balanceOf` or `totalOutstanding`.
- [ ] Existing repository tests remain green.

Do **not** call this Bread PASS yet.

---

## Task 3 — Capture FeePolicy RED and implement future-policy/snapshot contract

**Files**

- Create: `contracts/test/BreadFeePolicy.t.sol`
- Create: `contracts/src/interfaces/IBreadFeePolicy.sol`
- Create: `contracts/src/fees/BreadFeePolicy.sol`

### RED first

- [ ] Write tests for explicit constructor config, invalid recipient/bounds, owner-only policy update, owner-only sweep-operator rotation, emitted old/new policy, and snapshot stability expected by a launched curve fixture.
- [ ] Capture RED on absent production files.

### Implementation

- [ ] Define `BreadFeePolicySnapshot` with `protocolFeeRecipient`, `tradeFeeBps`, `protocolFeeShareBps`, `maxCreatorTaxBps`.
- [ ] Constructor receives explicit values; no guessed production defaults.
- [ ] Enforce combined `tradeFeeBps + maxCreatorTaxBps <= 2_000` safety ceiling from the frozen Pons source.
- [ ] `currentFeePolicy()` returns current future-launch config.
- [ ] `setCurrentFeePolicy()` owner-only.
- [ ] `feeSweepOperator()` live operational role, independently rotatable by owner.
- [ ] Emergency Guardian is not represented in this component.

### GREEN gate

- [ ] All policy validation/authorization tests pass.
- [ ] Updating current policy does not mutate a snapshot already copied into a launched curve fixture.
- [ ] Existing tests remain green.

---

## Task 4 — Capture concrete trading RED from the frozen Pons Buy/Sell behavior

**Files**

- Create: `contracts/test/BreadBondingCurveTrading.t.sol`
- Create: `contracts/test/helpers/BreadLaunchFixture.sol` if useful.
- Production file intentionally absent: `contracts/src/core/BreadBondingCurve.sol`

### Fixture

Use:

```text
ONE_USDC = 1_000_000
pairToken = MockUSDC6
explicit tradeFeeBps fixture value
explicit creatorTaxBps fixture value <= policy maximum
phantomQuote / graduationThreshold in six-decimal USDC base units
BreadLaunchToken minted directly to the curve
```

The test address may act as the injected Day-4 factory authority solely for Day-3 initialization and creator-recipient update tests.

### Deterministic RED coverage

- [ ] initialize only once and only through injected factory authority;
- [ ] creator tax above snapshotted maximum rejects launch/configuration;
- [ ] ordinary buy matches the frozen source-derived calculation;
- [ ] ordinary sell matches the frozen source-derived calculation;
- [ ] buy fee/tax are calculated from quote input and separately reported;
- [ ] sell fee/tax are calculated from gross quote output and separately reported;
- [ ] zero recipient/input failures;
- [ ] `minTokensOut` and `minQuoteOut` failures;
- [ ] tracked reserves move exactly while raw donations do not rewrite them;
- [ ] ready-to-graduate state closes sells.

Capture RED caused by missing `BreadBondingCurve.sol` only.

---

## Task 5 — Implement ordinary Buy/Sell with canonical USDC and reach GREEN

**Files**

- Create: `contracts/src/core/BreadBondingCurve.sol`

### Constructor/snapshot

- [ ] Extend `BreadTrackedCurveState` and `ReentrancyGuard`.
- [ ] Inject creator recipient, factory authority, `BreadFeePolicy`, `BreadFeeEscrow`, phantom quote, creator tax and graduation threshold.
- [ ] Read `currentFeePolicy()` exactly once and copy launch economics into immutable/snapshotted curve fields.
- [ ] Validate creator tax against the snapshotted maximum and combined fee ceiling.

### Initialization/recipient rights

- [ ] `initialize(token)` restricted to injected factory.
- [ ] `setCreatorFeeRecipient(next)` restricted to injected factory; affects future sweep destination only.

### Buy

- [ ] ERC20-only exact receipt; no `payable`, no native branch.
- [ ] Reject graduated/uninitialized/zero recipient/zero quote.
- [ ] Compute fee/tax then zero-fee constant-product output from net quote.
- [ ] Accrue fee/tax separately.
- [ ] Update tracked quote/tokens exactly.
- [ ] SafeTransfer launch tokens to recipient.
- [ ] Emit separated fee/tax event.

### Sell

- [ ] Reject graduated **or** ready-to-graduate state.
- [ ] Transfer token input in before payout.
- [ ] Price gross quote output from pre-trade tracked reserves.
- [ ] Deduct base fee and creator tax from gross quote output.
- [ ] Enforce min quote output.
- [ ] Accrue fee/tax separately.
- [ ] Update tracked quote/tokens exactly and SafeTransfer USDC output.

### GREEN gate

- [ ] Deterministic source-derived Buy/Sell vectors pass.
- [ ] Six-decimal accounting passes without normalization.
- [ ] Donation-resistance regressions pass against concrete trading.
- [ ] Reentrancy/callback ordering tests pass.
- [ ] Existing Day-2 tests remain green.

---

## Task 6 — Add partial final-buy clamp/refund and exact price-bound slippage

**Files**

- Modify: `contracts/src/core/BreadBondingCurve.sol`
- Extend: `contracts/test/BreadBondingCurveTrading.t.sol`

### RED first

Add tests that fail against the ordinary-buy-only implementation:

- [ ] crossing buy clamps to exact `sellableTokens()` rather than reverting;
- [ ] reserved floor is never crossed;
- [ ] actual spent quote is recomputed from token-side `getAmountIn`;
- [ ] fee/tax are recomputed from actual spent, not offered quote;
- [ ] `quoteIn - spent` is refunded exactly;
- [ ] `CurveBuyRefunded` emits exact refund;
- [ ] unclamped path reduces to `tokensOut >= minTokensOut`;
- [ ] clamped path uses the frozen Pons cross-multiplied price bound;
- [ ] a too-strict price bound reverts the entire trade and refund/accounting state remains untouched.

### Implement

- [ ] Port the frozen Pons clamp/reprice/gross-up sequence using existing `BreadBondingCurveMath.getAmountIn` and exact `Math.mulDiv(..., Rounding.Ceil)` semantics.
- [ ] Preserve the price-bound slippage equation from the frozen source.
- [ ] Update tracked quote by `spent`, never by offered/received quote.
- [ ] Refund exact excess USDC after state/token transfer, with whole-call rollback on failure.

### GREEN gate

- [ ] Deterministic crossing vectors pass.
- [ ] Bounded fuzz proves no crossing buy spends more than input or sends reserve below `reservedTokens`.
- [ ] Refund + fee + tax + net curve input reconcile to exact original quote input.

---

## Task 7 — Capture fee-sweep/claim RED and wire the canonical money path

**Files**

- Extend: `contracts/test/BreadBondingCurveTrading.t.sol`
- Create: `contracts/test/BreadTradingFeeEscrowIntegration.t.sol`
- Modify: `contracts/src/core/BreadBondingCurve.sol`

### RED first

- [ ] After Buy/Sell, base fee and creator tax exist in the tracked pending buckets and remain excluded from tradeable quote reserve.
- [ ] Unauthorized sweep reverts.
- [ ] Creator or live `feeSweepOperator` can sweep.
- [ ] Protocol allocation is floor(base fee * snapshotted share / 10_000).
- [ ] Creator gets base-fee remainder plus creator tax.
- [ ] Buckets/state are zeroed before FeeEscrow callbacks.
- [ ] FeeEscrow receives exact USDC custody and exact protocol/creator credits.
- [ ] A reverting FeeEscrow credit reverts the entire sweep and restores curve state.
- [ ] Protocol and creator can independently claim exact credited amounts.
- [ ] Changing creator recipient after a prior sweep cannot redirect already-credited claims.

### Implement

- [ ] Add no-buyback `sweepFees()` from the frozen Day-3 design.
- [ ] Use current live `feePolicy.feeSweepOperator()` only for operational authorization; economics remain snapshotted.
- [ ] Zero fee/tax buckets and reduce tracked quote before external credit calls.
- [ ] Approve exact USDC amount to FeeEscrow; avoid open-ended allowance where unnecessary.
- [ ] Emit `FeesSwept(protocolAmount, creatorAmount, creatorTaxAmount)`.

### Integrated GREEN gate

- [ ] launch fixture -> buy -> sell -> sweep -> protocol claim -> creator claim passes.
- [ ] Exact USDC conservation/fee accounting passes.
- [ ] Escrow solvency remains true through claims.
- [ ] Direct escrow donation remains surplus only.

---

## Task 8 — Stateful financial invariants and adversarial sequences

**Files**

- Create: `contracts/test/BreadTradingInvariant.t.sol`
- Create: `contracts/test/BreadFeeEscrowInvariant.t.sol` if not already separated.

### Required invariant families

- [ ] `INV-001` / `INV-003`: USDC input/output/fees/refunds reconcile exactly under successful operations.
- [ ] `INV-004`: no recipient claims more than credited.
- [ ] `INV-005`: outstanding claims never exceed escrow-controlled USDC.
- [ ] `INV-020` / `INV-021`: buy/sell minimum-output bounds cannot be violated.
- [ ] `INV-022`: final crossing buy never charges more than actual partial fill and refunds excess.
- [ ] `INV-024`: ready/graduated closure prevents disallowed curve paths.
- [ ] `INV-025`: repeated tiny trades cannot extract net quote value through rounding.
- [ ] `INV-026`: direct USDC/token donation cannot manipulate tracked reserve state.
- [ ] `INV-030`: creator tax is fixed per launch and bounded.
- [ ] `INV-031`: creator tax remains separate from base-fee split.
- [ ] `INV-032`: base-fee allocations sum exactly to charged base fee.

Random handler actions should include bounded buy, sell, sweep, partial claim, full claim, quote donation, launch-token donation, future FeePolicy update, and creator-recipient update through injected factory authority.

All successful operations must preserve concrete tracked-reserve and escrow solvency assertions.

---

## Task 9 — Repository-wide integration review and exact-head CI

**Files**

- Update: `docs/evidence/day3-trading-fees-escrow.md`
- Update: `docs/current-build-state.yaml`
- Update source-integrity inventories/validators.

### Review checklist

- [ ] No native quote branch entered production.
- [ ] No buyback/vesting state or execution entered production.
- [ ] No graduation transfer/DEX/hook/router code entered production.
- [ ] No Launch+Buy code entered production.
- [ ] No anti-snipe state/formula/exemption code entered production.
- [ ] No guessed live fee percentage or Arc mainnet constant entered production.
- [ ] FeeEscrow has no admin claim-withdraw/rescue capability.
- [ ] FeePolicy updates cannot rewrite existing curve snapshots.
- [ ] Creator recipient update cannot redirect already-credited claims.
- [ ] Indexer-facing events reflect canonical accounting state.
- [ ] Every newly vendored dependency matches its recorded frozen Git blob SHA.

### Final verification

- [ ] Run full Foundry suite.
- [ ] Run Node/bootstrap/source-integrity validation.
- [ ] Run dependency/build/clean-workspace checks.
- [ ] Run PostgreSQL/Redis health lanes if still part of repository-required CI.
- [ ] Perform integrated diff review against exact candidate head.
- [ ] Push exact candidate head and require every mandated CI job green.
- [ ] Record exact workflow run IDs and commit SHA in evidence/handoff.

### PASS rule

Only after the exact integrated candidate head is green may the lane receive:

```text
DAY_3_TRADING_FEES_ESCROW_INTEGRATED_PASS
```

The PASS does not clear `BREAD_SNIPE_DECAY_FORMULA`, `CURRENT_PONS_FACTORY_SOURCE_PARITY`, `LIVE_RUNTIME_CONFIG`, `PONS_AUDIT_FINDINGS` or `ARC_MAINNET_VALUES`, and does not authorize Day-4 implementation without its own gate.
