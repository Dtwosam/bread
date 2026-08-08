# Day 3 — Trading, Fees & Escrow Design

Status: **APPROVED BY SOURCE PACK v1.3 — IMPLEMENTATION DESIGN ONLY**

## Decision

Build Day 3 as one continuously integrated money-path lane consisting of:

1. a concrete ERC20-USDC-only Bread bonding curve that extends the already-integrated `BreadTrackedCurveState`;
2. a Bread-owned `BreadFeePolicy` whose current configuration is snapshotted by each launch/curve;
3. a Bread-owned `BreadFeeEscrow` claim ledger adapted from the minimal Clanker locker pattern; and
4. integrated Buy/Sell -> fee accrual -> fee sweep -> escrow claim proofs.

The lane begins from durable Source Pack v1.3 handoff `60a0dc052b73fe7e829ae59fa3ba2b26d6d37a41`, which descends from accepted Day-2 `main` baseline `5d13689f1ebc54f609c0fcf61ea43287b207e61a`.

This design intentionally excludes buyback/vesting, graduation transfer, Launch+Buy and anti-snipe production code.

## Frozen source and architecture basis

### Bread baseline

- `contracts/src/libraries/BreadBondingCurveMath.sol`
- `contracts/src/core/BreadTrackedCurveState.sol`
- `contracts/src/BreadLaunchToken.sol`
- Source Pack v1.3: `docs/source-reconciliation/bread-source-pack-v1.3.md`

### Frozen Pons trading reference

- repository: `ponsdotdev/ponsfamily`
- commit: `d5491e20be56051a68abf47136f6890c3ce3ff7d`
- file: `contractsV2/src/v2/PonsV2BondingCurve.sol`
- blob: `a5d84b3c355a1661e1bf61a4dd4e29591fbf6074`

The Day-3 trading port preserves the verified ERC20-relevant behavior from that source:

- fees and creator tax are always charged on the quote leg;
- buy fee/tax are calculated from actual spent quote;
- sell fee/tax are calculated from gross quote output;
- a final crossing buy clamps to `sellableTokens()` instead of reverting;
- the clamped buy is repriced from the token side with `getAmountIn` and grossed up with ceiling rounding;
- final-buy excess quote is refunded;
- partial-final-buy slippage is enforced as a price bound rather than an impossible full-quantity bound;
- a ready-to-graduate curve is closed to sells even if graduation execution has not yet happened;
- tracked reserves, not raw balances, remain authoritative.

Bread removes the Pons native-quote branch: `pairToken` is always the canonical Bread USDC ERC20.

### External FeeEscrow reference

- `clanker-devco/v4-contracts`
- commit: `b004c2edda29fa282a16d5d1441a26484f70b37f`
- `src/ClankerFeeLocker.sol`

Only the minimal pattern is adapted: authorized funding path, recipient ledger, balance-delta custody verification, state-before-transfer claim, SafeERC20 and reentrancy protection.

## Component 1 — BreadFeeEscrow

### Purpose

Hold canonical USDC that has already been allocated as protocol/creator revenue and expose a pull-claim ledger without deriving entitlement from raw token balance.

### Production surface

Proposed files:

- `contracts/src/interfaces/IBreadFeeEscrow.sol`
- `contracts/src/fees/BreadFeeEscrow.sol`

Required state:

```solidity
IERC20 public immutable usdc;
mapping(address recipient => uint256 amount) public balanceOf;
mapping(address creditor => bool allowed) public authorizedCreditor;
uint256 public totalOutstanding;
```

Admin authority is the Protocol Admin owner. It may authorize/revoke canonical Bread credit callers for future credits, but cannot alter recipient balances or withdraw claim backing.

Required external surface:

```solidity
function setAuthorizedCreditor(address creditor, bool allowed) external;
function credit(address recipient, uint256 amount) external;
function claim() external returns (uint256 amount);
function claim(uint256 amount) external returns (uint256 claimed);
function surplus() external view returns (uint256);
```

`credit` must:

1. require authorized caller;
2. reject zero recipient and zero amount;
3. measure USDC balance before/after `transferFrom`;
4. require exact canonical amount received;
5. increment recipient balance and `totalOutstanding` only after custody is verified;
6. emit deterministic accounting state.

`claim` must:

1. debit recipient balance and `totalOutstanding` before external token transfer;
2. send only to `msg.sender`;
3. revert the whole transaction on transfer failure, preserving the pre-call claim through EVM rollback;
4. never expose a caller-chosen alternate recipient.

No rescue/withdraw function exists in Day 3.

Required events:

```solidity
event AuthorizedCreditorUpdated(address indexed creditor, bool allowed);
event FeeCredited(
    address indexed creditor,
    address indexed recipient,
    uint256 amount,
    uint256 recipientBalance,
    uint256 totalOutstanding
);
event FeeClaimed(
    address indexed recipient,
    uint256 amount,
    uint256 remainingBalance,
    uint256 totalOutstanding
);
```

Hard invariant:

```text
USDC.balanceOf(escrow) >= totalOutstanding
```

Direct USDC donations may increase `surplus()` but never a recipient balance.

## Component 2 — BreadFeePolicy

### Purpose

Own only the protocol-wide fee configuration that can change for future launches. Existing curves snapshot economics and are not rewritten by later policy changes.

Proposed files:

- `contracts/src/interfaces/IBreadFeePolicy.sol`
- `contracts/src/fees/BreadFeePolicy.sol`

Proposed snapshot:

```solidity
struct BreadFeePolicySnapshot {
    address protocolFeeRecipient;
    uint16 tradeFeeBps;
    uint16 protocolFeeShareBps;
    uint16 maxCreatorTaxBps;
}
```

Operational role exposed separately and read live:

```solidity
function feeSweepOperator() external view returns (address);
```

Current configuration is constructor-supplied and owner-updatable for **future** snapshots. Source Pack v1.3 forbids guessed defaults: deployment/tests supply explicit values.

Required validation:

- non-zero protocol fee recipient;
- non-zero owner;
- `tradeFeeBps < 10_000`;
- `protocolFeeShareBps <= 10_000`;
- `maxCreatorTaxBps < 10_000`;
- `tradeFeeBps + maxCreatorTaxBps <= 2_000`, preserving the frozen Pons 20% combined-trade-fee safety ceiling without claiming that the ceiling is the live configured fee.

Required external surface:

```solidity
function currentFeePolicy() external view returns (BreadFeePolicySnapshot memory);
function setCurrentFeePolicy(BreadFeePolicySnapshot calldata next) external;
function setFeeSweepOperator(address next) external;
```

Required events:

```solidity
event FeePolicyUpdated(BreadFeePolicySnapshot previousPolicy, BreadFeePolicySnapshot nextPolicy);
event FeeSweepOperatorUpdated(address indexed previousOperator, address indexed nextOperator);
```

The Emergency Guardian gets no setter in this component.

## Component 3 — BreadBondingCurve trading layer

### Shape

Create `contracts/src/core/BreadBondingCurve.sol` as the concrete Day-3 trading contract extending `BreadTrackedCurveState` and OpenZeppelin `ReentrancyGuard`.

Constructor inputs must include:

- canonical `pairToken` USDC;
- creator/current creator-fee recipient;
- factory authority address (implemented later, but injectable now so initialization/recipient rights are not redesigned on Day 4);
- `IBreadFeePolicy`;
- `IBreadFeeEscrow`;
- `phantomQuote`;
- creator-selected `creatorTaxBps`;
- `graduationThreshold`.

At construction the curve reads `currentFeePolicy()` and snapshots:

- `protocolFeeRecipient`;
- `tradeFeeBps`;
- `protocolFeeShareBps`;
- the creator-tax bound used to validate the launch.

The curve stores immutable/snapshotted economics; later FeePolicy changes affect future curves only. `feeSweepOperator()` remains a live operational role and may rotate without rewriting economics.

### Initialization

`initialize(address token_)` is restricted to the injected factory authority and delegates to `_initializeTrackedCurve(token_)`.

No Day-3 factory implementation is added. Tests use the controlling test address as the injected factory.

### Creator-fee recipient

Day 3 preserves the verified future-fee-recipient right with:

```solidity
function setCreatorFeeRecipient(address next) external onlyFactory;
```

This changes only the recipient of **future fee sweeps**. It must not move or rewrite any amount already credited in FeeEscrow.

### Buy

Required production signature:

```solidity
function buy(uint256 quoteIn, uint256 minTokensOut, address recipient)
    external
    nonReentrant
    returns (uint256 tokensOut);
```

Bread-specific ERC20-only receipt:

- no `payable`;
- `pairToken.safeTransferFrom(msg.sender, address(this), quoteIn)`;
- measure balance delta and require exact `quoteIn` for canonical-USDC semantics;
- no native zero-address sentinel.

Trading behavior follows the frozen Pons source:

1. reject graduated/uninitialized/zero recipient/zero amount;
2. snapshot tracked reserves;
3. calculate base fee and creator tax from input;
4. price net input through `BreadBondingCurveMath.getAmountOut(..., feeBps=0)`;
5. if output crosses the reserved floor, clamp to `sellableTokens()`;
6. use `getAmountIn` plus ceiling gross-up to compute actual quote spent for the clamp;
7. recompute fee/tax from actual spent;
8. enforce the source-derived partial-fill price bound;
9. accrue fee/tax buckets;
10. add only `spent` to `trackedQuote` and subtract exact `tokensOut` from `trackedTokens`;
11. transfer tokens to recipient;
12. refund `quoteIn - spent` to buyer;
13. emit buy/refund events.

No auto-graduation call exists in Day 3.

Required events preserve the source-separated accounting:

```solidity
event CurveBuy(
    address indexed buyer,
    address indexed recipient,
    uint256 quoteIn,
    uint256 tokensOut,
    uint256 fee,
    uint256 tax
);
event CurveBuyRefunded(address indexed buyer, uint256 refund);
```

### Sell

Required production signature:

```solidity
function sell(uint256 tokensIn, uint256 minQuoteOut, address recipient)
    external
    nonReentrant
    returns (uint256 quoteOut);
```

Required behavior:

1. reject graduated or `readyToGraduate()` state;
2. reject zero input/recipient;
3. snapshot tracked reserves;
4. transfer exact launch-token input in;
5. calculate gross quote output with zero embedded math fee;
6. calculate base fee and creator tax from gross quote output;
7. return net quote output;
8. enforce `minQuoteOut`;
9. accrue fee/tax buckets;
10. subtract only net quote payout from `trackedQuote` and add tokens to `trackedTokens`;
11. send canonical USDC to recipient;
12. emit separated fee/tax event.

```solidity
event CurveSell(
    address indexed seller,
    address indexed recipient,
    uint256 tokensIn,
    uint256 quoteOut,
    uint256 fee,
    uint256 tax
);
```

## Component 4 — No-buyback fee sweep to FeeEscrow

Day 3 preserves fee accrual first, then an explicit sweep, but **does not implement buyback**.

`_accrueFees(fee, tax)` only updates:

- `quoteFeeBalance += fee`;
- `creatorTaxBalance += tax`.

Proposed sweep:

```solidity
function sweepFees() external nonReentrant;
```

Authorized caller:

- current creator-fee recipient; or
- `feePolicy.feeSweepOperator()`.

Sweep accounting:

```text
pendingBaseFee = quoteFeeBalance
pendingTax = creatorTaxBalance
protocolAmount = floor(pendingBaseFee * protocolFeeShareBps / 10_000)
creatorAmount = pendingBaseFee - protocolAmount + pendingTax
```

Before any FeeEscrow external call:

- clear `quoteFeeBalance`;
- clear `creatorTaxBalance`;
- subtract `protocolAmount + creatorAmount` from `trackedQuote`.

Then approve/credit exact USDC amounts into FeeEscrow for the snapshotted protocol recipient and current creator recipient.

A reverting FeeEscrow call reverts the whole sweep, restoring curve state and custody atomically.

Required event:

```solidity
event FeesSwept(uint256 protocolAmount, uint256 creatorAmount, uint256 creatorTaxAmount);
```

No buyback bucket, internal swap, direct-payment rescue or graduation sweep is implemented in this lane.

## Required security/dependency surface

Use exact frozen Pons-tree OpenZeppelin dependencies where needed and extend the executable source-integrity inventory rather than installing an unpinned package dynamically.

At minimum Day 3 expects:

- `SafeERC20.sol` — frozen blob `4d5e45fde83dad355bc5d8d8664ff59c7cc7d8d9` plus its exact transitive source files;
- `ReentrancyGuard.sol` — frozen blob `c156fa1cc9656ba278ca90270707848524bf0d25`;
- `StorageSlot.sol` — frozen blob `aebb10524a2c82aa78ceb8394e5f3c1b0e5abeea`;
- `Ownable.sol` — frozen blob `bd96f6661dcbf7b2d4948823ac0e7bfb4ba31fb1`;
- already-vendored `Math.sol` and ERC20 interfaces.

All additional transitive files must have their exact frozen Git blob SHA recorded before GREEN.

## Required proofs

### FeeEscrow

- unauthorized credit reverts;
- exact credit increases custody, recipient balance and `totalOutstanding` equally;
- direct donations do not create claims;
- full and partial claims reconcile exactly;
- claim state is updated before a reentrant callback can observe an old entitlement;
- failed token transfer reverts and preserves the claim;
- no admin withdrawal surface exists;
- stateful `balance >= totalOutstanding` invariant holds.

### FeePolicy

- invalid percentages/zero recipient reject;
- owner-only future-policy updates;
- operator rotation is owner-only;
- existing curve snapshots are unchanged after later policy updates;
- creator tax above the snapshotted maximum cannot initialize a curve.

### Trading

- deterministic source-derived buy and sell vectors;
- six-decimal USDC accounting with no decimal normalization;
- fee/tax are quote-denominated and separately reported;
- final crossing buy clamps, reprices, refunds exact excess and preserves the reserved floor;
- unclamped slippage reduces to the ordinary minimum-output condition;
- clamped slippage uses the source price-bound rule;
- sell slippage is exact;
- ready-to-graduate state blocks both additional buy inventory and sells;
- direct quote/token donations do not alter tracked pricing/graduation state;
- tiny-trade repeated sequences cannot extract net quote value under rounding.

### Integrated fee/claim path

- launch fixture -> buy -> sell -> sweep -> protocol claim -> creator claim;
- base-fee allocation plus creator tax reconciles exactly to charged amounts;
- FeeEscrow credits equal USDC actually transferred from the curve;
- claims cannot exceed credits;
- after all claims, escrow `totalOutstanding == 0` while any direct donation remains only surplus;
- later creator-recipient change cannot redirect already-credited claims.

### Stateful invariants

Run bounded random sequences of:

- buys;
- sells;
- fee sweeps;
- creator claims;
- protocol claims;
- direct quote donations;
- direct launch-token donations;
- FeePolicy updates that affect only newly deployed curves.

At every successful step prove applicable `INV-001` through `INV-006`, `INV-020` through `INV-026`, `INV-030` through `INV-032`, and escrow solvency.

## Explicit exclusions

Day 3 MUST NOT implement or infer:

- buyback execution or buyback vesting;
- a buyback fee bucket;
- graduation reserve transfer or DEX seeding;
- automatic graduation callback;
- Launch+Buy;
- anti-snipe tax/formula/exemptions;
- native ETH quote handling;
- Arc mainnet addresses;
- guessed live fee percentages;
- current-live Pons factory parity;
- emergency rescue that moves user/creator escrow claims.

## Completion rule

Day-3 implementation can be called `BREAD_PASS` only after:

1. each production-facing behavior is introduced test-first with specific RED evidence;
2. FeeEscrow, FeePolicy and trading reach GREEN separately;
3. the full launch -> buy -> sell -> sweep -> claim path is GREEN;
4. source integrity covers every newly vendored dependency;
5. unit, fuzz and stateful invariants pass;
6. all Day-1/Day-2 regressions remain green;
7. integrated review finds no excluded-feature leakage, alternate accounting ledger or unauthorized admin power;
8. exact candidate head passes the repository's full required CI jobs;
9. durable evidence and `docs/current-build-state.yaml` are updated before merge.
