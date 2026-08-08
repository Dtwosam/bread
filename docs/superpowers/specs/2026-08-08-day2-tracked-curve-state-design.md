# Day 2 Lane 2 — Tracked Curve State Design

Status: APPROVED

## Decision

Use an **abstract tracked-reserve core** rather than a concrete half-built bonding curve or a broad Pons curve port.

The production unit is `BreadTrackedCurveState`, an abstract Solidity contract that preserves the source-verified reserve/allocation/graduation state semantics needed by Bread Day 2 while intentionally omitting all trading, fee-distribution, sweep, snipe, Launch+Buy, graduation-transfer and DEX behavior.

This lane begins from durable `main` merge `aca14483ef5d8bee707a39e7ea628569d22d1828` and extends the already integrated Day-2 Lane-1 math/token baseline.

## Frozen source basis

- Pons repository: `ponsdotdev/ponsfamily`
- frozen reference commit: `d5491e20be56051a68abf47136f6890c3ce3ff7d`
- source file: `contractsV2/src/v2/PonsV2BondingCurve.sol`
- frozen Git blob SHA: `a5d84b3c355a1661e1bf61a4dd4e29591fbf6074`

The Lane-2 parity claim is deliberately narrower than a full-contract port. Bread is extracting only these verified behaviors from the frozen source:

1. tracked quote reserve bookkeeping is authoritative rather than the contract's raw quote-token balance;
2. tracked launch-token reserve bookkeeping is authoritative rather than the contract's raw token balance;
3. pending quote fee and creator-tax buckets are excluded from the tradeable quote reserve;
4. `reservedTokens` is calculated as `floor(supply * phantomQuote / (phantomQuote + graduationThreshold))` with full-precision `Math.mulDiv`;
5. launch initialization rejects an allocation that rounds to zero or consumes the entire supply;
6. `sellableTokens()` is `max(trackedTokens - reservedTokens, 0)`;
7. `getReserves()`, `quoteReserve()`, `realQuoteReserve()` and `tokenReserve()` read the tracked state, not raw balances;
8. `readyToGraduate()` becomes true when the sellable allocation is exhausted and remains false after the graduated flag is set.

## Bread-specific boundary

Bread V1 is ERC-20 quote only. The tracked-state constructor therefore accepts a non-zero ERC-20 `pairToken` address and does **not** implement the frozen Pons native-asset zero-address sentinel.

The contract does not scale quote values between 6 and 18 decimals. Quote accounting is performed directly in the quote token's base units. Day-2 tests use a six-decimal USDC-like token and express `phantomQuote` and `graduationThreshold` in six-decimal base units. The canonical Arc mainnet USDC address remains unresolved and is not hardcoded.

## Production interface

`BreadTrackedCurveState` is abstract and non-deployable by itself.

State/getter surface:

```solidity
address public token;
address public immutable pairToken;
uint256 public immutable phantomQuote;
uint256 public immutable graduationThreshold;
uint256 public quoteFeeBalance;
uint256 public creatorTaxBalance;
uint256 public trackedQuote;
uint256 public trackedTokens;
uint256 public reservedTokens;
bool public graduated;
```

Constructor:

```solidity
constructor(address pairToken_, uint256 phantomQuote_, uint256 graduationThreshold_)
```

Internal initialization:

```solidity
function _initializeTrackedCurve(address token_) internal;
```

Read functions:

```solidity
function sellableTokens() public view returns (uint256);
function getReserves() public view returns (uint256 quoteReserve_, uint256 tokenReserve_);
function quoteReserve() external view returns (uint256 quoteReserve_);
function realQuoteReserve() public view returns (uint256);
function tokenReserve() external view returns (uint256 tokenReserve_);
function readyToGraduate() public view returns (bool);
```

Errors retained for this bounded surface:

```solidity
error ZeroAddress();
error AlreadyInitialized();
error InvalidLaunchEconomics();
```

No external production mutation function is added in Day 2. A test-only harness may expose internal state transitions required to prove invariants.

## OpenZeppelin dependency freeze

The allocation formula must reuse the exact frozen Pons OpenZeppelin `Math.mulDiv` implementation instead of adding a Bread-written full-precision arithmetic implementation.

Additional exact files required from the same frozen Pons tree:

- `contractsV2/lib/openzeppelin-contracts/contracts/utils/math/Math.sol` — blob `e7288595b6539e986aef1a7a524884d86fc2d643`
- `contractsV2/lib/openzeppelin-contracts/contracts/utils/Panic.sol` — blob `e168824d34b3f0ba0be33317fb34b9e74fc148b6`
- `contractsV2/lib/openzeppelin-contracts/contracts/utils/math/SafeCast.sol` — blob `ccb979f61c9577e6338276cff49625d5a2191eb3`

They are added to the existing frozen dependency inventory and the executable Git-blob integrity gate. Bread still makes no package-level OpenZeppelin version claim.

## Required Day-2 proofs

### Allocation / graduation

Tests must prove:

- the exact reserved allocation formula against an independent bounded arithmetic reference;
- initialization records the actual launch-token balance received by the curve;
- zero/whole-supply reserved allocations revert as invalid launch economics;
- sellable supply is exactly the tracked amount above the reserved floor;
- graduation readiness is controlled by the tracked token reserve, not raw token balance;
- once `graduated == true`, `readyToGraduate()` is false.

### Six-decimal quote accounting

A test-only USDC-like ERC-20 uses 6 decimals. Test fixtures must use values such as `1_000_000` for one quote token and must demonstrate that the production state core stores and combines those units directly without 18-decimal conversion.

### Donation resistance

Tests must physically transfer quote tokens and launch tokens to the harness without changing tracked state and prove:

- quote-token donations do not change `quoteReserve()` or `realQuoteReserve()`;
- launch-token donations do not change `tokenReserve()` or `sellableTokens()`;
- quote donations cannot trigger graduation;
- token donations cannot delay a launch that is already ready to graduate.

This is the Day-2 proof surface for the donation-resistance invariants. Stateful Buy/Sell donation tests are deferred until those functions exist.

### Tiny-trade rounding

A test-only invariant/characterization suite uses `BreadBondingCurveMath` with six-decimal quote reserves and bounded tiny quote inputs. It simulates valid quote→token→quote round trips with zero fee and asserts that integer rounding never increases the trader's quote balance. A repeated bounded loop must also end with quote value less than or equal to the starting value.

This is a rounding-only Day-2 proof. Actual fee/tax tiny-trade invariants are rerun against the stateful trading implementation once the fee semantics are authorized.

## Explicit exclusions

This lane MUST NOT implement or infer:

- `buy()` or `sell()`;
- quote receipt or payout functions;
- FeeEscrow credit/claim semantics;
- fee splitting, fee sweep, rescue, or buyback execution;
- snipe tax or exemptions;
- Launch+Buy;
- automatic graduation calls;
- graduation reserve transfer or DEX seeding;
- native ETH quote support;
- factory authorization beyond what a later concrete curve requires;
- current-live Pons parity;
- Arc mainnet addresses.

All existing 7A blockers remain active.

## Completion rule

Lane 2 can PASS only after:

1. tests are written before production implementation and a specific RED is captured;
2. the abstract state core reaches GREEN;
3. the exact three additional OpenZeppelin blobs are vendored and enforced by CI;
4. allocation, six-decimal accounting, donation-resistance and tiny-trade proofs pass;
5. the complete repository regression suite remains green;
6. diff review finds no blocked-feature leakage or accidental deployable trading surface;
7. evidence and `docs/current-build-state.yaml` are updated;
8. the exact candidate head passes all required CI jobs before merge.
