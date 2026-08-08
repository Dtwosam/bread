# Day 4 — Factory, Launch+Buy, Snipe & Emergency Design

Status: **APPROVED DESIGN BUNDLE — SELF-REVIEWED; USER SPEC REVIEW + PROJECT-SOURCE PROMOTION REQUIRED BEFORE IMPLEMENTATION PLAN**

Date: 2026-08-08

## Decision

Build Day 4 as one continuously integrated launch-control lane over the accepted Day-3 baseline. The lane consists of:

1. a Bread-owned Factory/Deployer boundary that creates the already-integrated `BreadBondingCurve` + `BreadLaunchToken` pair and freezes launch economics;
2. a Bread-owned atomic Launch+Buy lifecycle using canonical 6-decimal ERC20 USDC and the same trading semantics already proven on Day 3;
3. a Bread-owned buy-only opening-protection mechanism using an exact quadratic 99% -> 0 over 5-second decay formula and one-use Launch+Buy exemption only; and
4. a restriction-only EmergencyController with Guardian monotonic restriction authority and Protocol Admin-only restriction reduction/unpause.

This design starts from the accepted Day-3 durable closeout baseline `a67f42cae2b69c5c8ec4b07f0c2f2695ac4ea8a3` and current repository handoff head `c6fcb53c854e45843b60720e3be859a49965bad2`.

No Day-5 graduation execution, DEX seeding, permanent locker, buyback/vesting or Arc-mainnet address activation is implemented in this lane.

## Project Source ratification disposition

The uploaded Project Source v1.3 pack is ratified and remains controlling for the already-integrated Day-1 through Day-3 baseline. However, this Day-4 design freezes new exact fork details that v1.3 intentionally left gated:

- the exact Bread snipe decay formula;
- the one-use Launch+Buy-only exemption model;
- exact opening-tax proceeds routing;
- canonical-USDC launch-fee routing;
- the exact EmergencyController restriction state machine.

Under the permanent Project Source Ratification Gate, this repository design is **evidence/approved design, not yet controlling Project Source**. Therefore:

```text
PROJECT_SOURCE_PACK = v1.3-post-research
PROJECT_SOURCE_RATIFICATION_FOR_EXISTING_BASELINE = RATIFIED
DAY4_PROJECT_SOURCE_AMENDMENT = APPROVED_PENDING_PROMOTION
PROJECT_SOURCE_RATIFICATION_FOR_DAY4_PRODUCTION = NOT_RATIFIED
CANDIDATE_CODE_STATUS = NO_DAY4_PRODUCTION_CODE_AUTHORIZED
```

After the user reviews this committed spec, the affected consolidated Project Sources must be regenerated/replaced, uploaded by the user, read back in the active chat, and reconciled against GitHub/current-build-state. Only then may a Day-4 implementation plan authorize production Solidity work.

## Controlling v1.3 requirements being specialized

Ratified Project Source v1.3 requires Day 4 to:

- implement Factory/Deployer and economics hash/snapshot;
- implement Bread-owned atomic Launch+Buy with canonical USDC, slippage, final partial-fill/refund, rollback and no stranded custody;
- freeze `BREAD_SNIPE_DECAY_FORMULA` and exact launch-time exemptions before anti-snipe production implementation;
- implement Bread-owned descending buy-only opening protection and prove INV-040 through INV-044;
- implement restriction-only EmergencyController;
- wire multisig-compatible ownership/events;
- finish with atomic Launch+Buy PASS, snipe exactness/monotonicity PASS, and proof that Guardian cannot move funds, change economics or unpause.

The ratified financial model also requires:

- INV-040: opening buy tax is bounded and non-negative;
- INV-041: tax is non-increasing and reaches exact terminal value at/after expiry;
- INV-042: sell behavior is unaffected by buy-only protection;
- INV-043: exemptions are exact and non-self-assignable;
- INV-044: tax proceeds use the verified fee-accounting path and cannot disappear;
- INV-060: Guardian only increases restriction and cannot move funds/change economics;
- INV-061: only Protocol Admin removes emergency restrictions;
- INV-062: future configuration cannot rewrite existing launch snapshots;
- INV-063: no single EOA has production admin authority after deployment handoff.

## Source / reference disposition

### Canonical Bread baseline

Day 4 consumes rather than replaces:

- `contracts/src/core/BreadBondingCurve.sol`;
- `contracts/src/core/BreadTrackedCurveState.sol`;
- `contracts/src/BreadLaunchToken.sol`;
- `contracts/src/fees/BreadFeePolicy.sol`;
- `contracts/src/fees/BreadFeeEscrow.sol`;
- their existing interfaces, tracked-reserve accounting, fee/tax split, final-fill refund and claim semantics.

No duplicate fee ledger, creator-tax ledger, claim ledger or trading accounting authority may be introduced.

### Frozen Pons references

Reference repository: `ponsdotdev/ponsfamily`

Frozen commit: `d5491e20be56051a68abf47136f6890c3ce3ff7d`

Useful reference surfaces:

- `contractsV2/src/v2/PonsV2LaunchFactory.sol` — economics digest/pin, launch snapshot pattern, owner-managed future launch configuration;
- `contractsV2/src/v2/PonsV2LaunchDeployer.sol` — factory-only deployer split and metadata caps;
- existing Day-3 Pons curve reference for trading semantics.

Bread does not claim exact current-live Pons factory parity from this reference.

The frozen V2 deployer uses ordinary `new` deployment. Day 4 therefore does **not** invent CREATE2/deterministic deployment. That remains outside this design unless later source reconciliation explicitly authorizes it.

### Anti-snipe technical reference

Reference repository: `clanker-devco/v4-contracts`

Frozen commit: `b004c2edda29fa282a16d5d1441a26484f70b37f`

Reference file: `src/mev-modules/ClankerMevDescendingFees.sol`

The reference is technical evidence only for a descending time-based fee shape. Bread does not import Clanker percentages, duration, delay guard, hook plumbing or fee economics.

## Component 1 — BreadLaunchFactory

### Purpose

Own the canonical Bread launch lifecycle and immutable per-launch provenance without becoming a second fee/trading authority.

Proposed file:

- `contracts/src/factory/BreadLaunchFactory.sol`

The Factory is the privileged factory address injected into each `BreadBondingCurve` and `BreadLaunchToken`.

### Immutable stack dependencies

The Factory stack must bind, at minimum:

- canonical ERC20 USDC;
- `BreadFeePolicy`;
- `BreadFeeEscrow`;
- the Day-4 launch deployer;
- EmergencyController;
- stack/version identifier;
- the fixed Bread opening-protection configuration described below.

No Arc mainnet addresses are hardcoded in Day 4. Tests and deployment fixtures inject explicit addresses.

### Launch configuration

Day 4 uses a narrowly scoped future-launch configuration rather than a foreign super-factory configuration model.

The launch configuration contains the exact terms necessary to instantiate the existing curve/token pair, including:

- fixed launch token supply;
- `phantomQuote` in canonical six-decimal USDC base units;
- `graduationThreshold` in canonical six-decimal USDC base units;
- explicit `launchFeeUsdc` in canonical six-decimal USDC base units;
- enabled/disabled state for future launches only;
- stack version/config identity required for the economics digest.

No production launch-fee value is guessed in code. Tests/deployment fixtures supply explicit values. `LIVE_RUNTIME_CONFIG` continues to gate the value selected for a real deployment.

If `launchFeeUsdc` is non-zero, it is 100% protocol revenue. The Factory must collect the exact USDC amount and create an exact FeeEscrow credit to the launch-snapshotted `protocolFeeRecipient`; it may not retain the launch fee in Factory custody, send it to an arbitrary treasury, or mix it with trading reserve accounting. A failure to custody/credit the launch fee reverts the entire launch intent.

Existing launches keep constructor/snapshot values and are never rewritten by later future-launch changes.

### Economics digest

Before deployment the Factory exposes a preview of the economics digest for the launch terms a creator is about to accept.

The digest binds every protocol-controlled or stack-controlled term that could change the economic meaning of the launch between preview and submission:

```text
canonical USDC
launch supply
phantomQuote
graduationThreshold
current FeePolicy.protocolFeeRecipient
current FeePolicy.tradeFeeBps
current FeePolicy.protocolFeeShareBps
current FeePolicy.maxCreatorTaxBps
launchFeeUsdc
stack version/config identity
opening protection start tax = 9900 bps
opening protection duration = 5 seconds
opening protection formula/version identifier
opening-protection proceeds routing identifier
```

The creator-selected `creatorTaxBps` is included in the launch intent itself and must be validated against the current snapshotted maximum; it may also be included in an intent hash/event, but a protocol-side change cannot silently rewrite it.

A non-zero `expectedEconomics` supplied by the caller must equal the digest calculated inside the launch transaction or the entire launch reverts.

The digest is a protection against a configuration race. It is not an oracle and does not introduce mutable per-launch economics after creation.

### Launch record

For each successful launch, record one canonical launch record containing at minimum:

- token;
- curve;
- original deployer;
- creator fee recipient at launch;
- creator tax bps;
- economics digest;
- launch timestamp;
- stack/config version.

The record is provenance/indexing state, not a parallel money ledger.

### Factory ownership

Factory admin authority is multisig-compatible. Production handoff target remains the configured Protocol Admin Safe, not an ordinary EOA.

The Emergency Guardian is not Factory owner and gets no setter capable of changing economics or recipients.

## Component 2 — BreadLaunchDeployer

### Purpose

Keep Factory bytecode focused and give deployment one narrow factory-only boundary.

Proposed file:

- `contracts/src/factory/BreadLaunchDeployer.sol`

Required properties:

- immutable `factory` address;
- only that Factory may call `deployLaunch`;
- deploy exactly one `BreadBondingCurve` and `BreadLaunchToken` pair per call;
- both deployed contracts receive the real Factory address, never the deployer helper as privileged authority;
- token full supply mints to its curve under the existing Day-2/Day-3 token behavior;
- curve initialization remains a Factory call so its existing factory-only initialization gate is preserved.

### Metadata caps

Preserve the useful frozen Pons deployer pattern of bounded metadata writes:

- name <= 64 bytes;
- symbol <= 16 bytes;
- logo <= 512 bytes;
- description <= 2048 bytes;
- each social field <= 256 bytes.

Empty name/symbol rejection belongs at the Factory launch-intent validation boundary.

### No deterministic-deployment claim

No CREATE2 salt, predicted-address API or deterministic-address promise is introduced in this Day-4 implementation. Exact deterministic deployment remains source/config gated.

## Component 3 — Atomic Launch+Buy

### Purpose

Allow a user to create a launch and execute the initial canonical Bread buy as one all-or-nothing ERC20-USDC intent.

The initial buy is part of Factory launch orchestration; it is not a separate router with separate economics.

### Proposed launch surfaces

The design may expose two public launch methods for clarity:

```solidity
function launchToken(LaunchParams calldata params) external returns (address token, address curve);

function launchTokenAndBuy(
    LaunchParams calldata params,
    uint256 quoteIn,
    uint256 minTokensOut,
    address recipient
) external returns (address token, address curve, uint256 tokensOut);
```

Implementation naming may vary if the implementation plan finds a cleaner interface, but the semantics below are frozen.

### Canonical USDC custody flow

For a launch-only intent:

1. validate launch/economics/emergency permissions;
2. if `launchFeeUsdc != 0`, custody exactly that amount from the caller;
3. deploy and initialize the launch pair;
4. credit the exact launch fee through FeeEscrow to the snapshotted protocol recipient;
5. finish with no launch-fee USDC stranded in the Factory.

For `launchTokenAndBuy`:

1. validate launch/economics/permissions before taking user USDC where possible;
2. custody exactly `launchFeeUsdc + quoteIn` canonical USDC from the caller, using exact balance-delta checks;
3. deploy and initialize the curve/token pair;
4. route/credit the launch-fee portion exactly as above;
5. temporarily approve exactly the `quoteIn` buy portion to the curve;
6. call the canonical curve buy path on behalf of the launch intent;
7. deliver purchased launch tokens directly to `recipient`;
8. forward any final-fill quote refund back to the original launch+buy caller;
9. clear temporary USDC approval where the chosen SafeERC20 flow leaves one;
10. require no temporary Factory custody attributable to the intent after successful completion;
11. emit one launch record plus a Launch+Buy orchestration event.

Any failure at launch-fee credit, deployment, initialization, economics-pin validation, USDC transfer, approval, buy, slippage, token transfer or refund reverts the **entire** transaction. A failed initial buy must not leave a successfully created launch or paid launch fee behind.

### Reuse of canonical Buy semantics

Launch+Buy must not reimplement bonding-curve pricing in the Factory.

The existing `BreadBondingCurve` remains the pricing/tracked-reserve authority. Day 4 may add the minimum narrowly-scoped factory-aware entrypoint/internal plumbing needed for:

- one-use opening-tax exemption;
- returning exact `tokensOut` and exact quote refund to the Factory orchestration layer;
- preserving the Day-3 final-clamp, reprice, slippage and refund rules.

The Factory must not copy `BreadBondingCurveMath` calculations merely to simulate the buy and then maintain a second accounting path.

### Final partial fill

If the initial buy or an ordinary buy crosses the reserved floor, it follows the Day-3 final-buy structure:

- clamp tokens out to sellable allocation;
- derive required net curve input from the token side with `BreadBondingCurveMath.getAmountIn(..., feeBps=0)`;
- gross up under the exact coded rule below;
- charge only `spent` under that rule;
- refund all `received - spent` quote;
- preserve the reserved floor.

## Component 4 — Bread opening protection

### Architecture decision

`BREAD_SNIPE_DECAY_FORMULA` is frozen by this approved design as a Bread-owned **quadratic remaining-time** opening tax.

Constants:

```text
STARTING_SNIPE_TAX_BPS = 9900
SNIPE_DURATION_SECONDS = 5
TERMINAL_SNIPE_TAX_BPS = 0
BASIS_POINTS = 10000
```

For a non-exempt buy at elapsed time `t` seconds:

```text
if t >= 5:
    snipeTaxBps = 0
else:
    remaining = 5 - t
    snipeTaxBps = floor(9900 * remaining * remaining / 25)
```

Exact integer-second values are therefore:

| elapsed | tax bps |
| ---: | ---: |
| 0 | 9900 |
| 1 | 6336 |
| 2 | 3564 |
| 3 | 1584 |
| 4 | 396 |
| >=5 | 0 |

The formula is Bread fork policy. It is not represented as exact Pons parity.

### Launch timestamp

Each curve/launch stores one immutable or one-shot launch timestamp fixed by the Factory during launch initialization.

Required properties:

- cannot be set by an arbitrary user;
- cannot be reset after launch;
- Factory/Admin/Guardian cannot restart the window;
- all opening-tax calculations use that canonical timestamp;
- timestamp behavior is explicitly fuzzed at `0,1,2,3,4,5,6` seconds and boundary timestamps.

### Buy-only behavior

Opening protection affects buys only.

Sells continue using the Day-3 canonical sell calculation with no opening tax, satisfying INV-042.

### Exact exemption model

There is **no permanent exempt-address mapping** and no creator/launcher wallet exemption.

The only exemption is the one initial buy executed as part of the same atomic `launchTokenAndBuy` transaction.

Required authorization shape:

- only the canonical Factory launch orchestration may invoke the exempt buy path;
- the exemption exists for that one launch-time buy call only;
- there is no reusable exemption bit/address grant after the call;
- recipient identity does not create future exemption;
- deployer identity does not create future exemption;
- creator-fee-recipient identity does not create future exemption;
- users cannot pass a boolean or arbitrary exemption address to public curve buy.

A launch with no initial buy creates no exemption state. Ordinary subsequent buys are taxed according to elapsed time.

### Tax order

For an ordinary buy before a final clamp:

```text
spent = received
baseFee = floor(spent * tradeFeeBps / 10000)
creatorTax = floor(spent * creatorTaxBps / 10000)
quoteAfterStandardCharges = spent - baseFee - creatorTax
snipeTax = floor(quoteAfterStandardCharges * snipeTaxBps / 10000)
netCurveInput = quoteAfterStandardCharges - snipeTax
```

Tokens out are priced from `netCurveInput` using the existing Bread constant-product math.

The exempt atomic Launch+Buy uses `snipeTaxBps = 0`; base fee and creator tax remain fully active.

### Exact final-fill gross-up rule

If the initially quoted output exceeds the remaining sellable allocation:

```text
netRequired = BreadBondingCurveMath.getAmountIn(
    available,
    quoteReserve,
    tokenReserve,
    0
)

quoteAfterStandardRequired = ceil(
    netRequired * 10000 / (10000 - snipeTaxBps)
)

grossRequired = ceil(
    quoteAfterStandardRequired * 10000 /
    (10000 - tradeFeeBps - creatorTaxBps)
)

spent = min(grossRequired, received)
```

Both ceilings must use overflow-safe full-precision multiplication/division such as the already-vendored OpenZeppelin `Math.mulDiv(..., Math.Rounding.Ceil)`.

Then recompute from exact `spent` using the ordinary floor rules:

```text
baseFee = floor(spent * tradeFeeBps / 10000)
creatorTax = floor(spent * creatorTaxBps / 10000)
quoteAfterStandardCharges = spent - baseFee - creatorTax
snipeTax = floor(quoteAfterStandardCharges * snipeTaxBps / 10000)
netCurveInput = quoteAfterStandardCharges - snipeTax
```

Required postcondition for the clamped fill:

```text
netCurveInput >= netRequired
```

and the buyer receives exactly `available` launch tokens with refund `received - spent`.

This deliberately preserves the Day-3 source-derived **ceiling gross-up** convention. When `snipeTaxBps == 0`, the first gross-up is identity and the rule reduces to the existing Day-3 combined base-fee/creator-tax ceiling gross-up. It does not introduce a new minimal-input search or silently rewrite already-accepted Day-3 rounding semantics.

Tests must prove six-decimal boundaries, overflow safety, no underfunded clamped output, exact refund and no rounding-extraction sequence.

### Snipe-tax proceeds

Snipe tax is USDC fee revenue and reuses the existing Day-3 base-fee allocation path.

Accounting decision:

```text
quoteFeeBalance += baseFee + snipeTax
creatorTaxBalance += creatorTax
```

At `sweepFees`, the existing snapshotted `protocolFeeShareBps` splits `quoteFeeBalance` exactly as it already splits base fee. Creator tax remains entirely separate and entirely creator-side.

This preserves one canonical FeeEscrow/fee-sweep system and satisfies INV-044 without a new snipe treasury or claim ledger.

Events must expose the opening-tax amount distinctly enough for SDK/indexer reconstruction even though accounting settles through the existing fee bucket.

## Component 5 — EmergencyController

### Purpose

Provide a narrow emergency restriction state machine without custody or economic authority.

Proposed file:

- `contracts/src/security/BreadEmergencyController.sol`

### Roles

- `protocolAdmin` — multisig-compatible Protocol Admin authority;
- `guardian` — dedicated restriction-only Emergency Guardian.

Production deployment/handoff target is an initial 2-of-3 Safe for Protocol Admin. The contract must not rely on a single ordinary EOA as the durable production admin.

### Trading/launch restriction mode

Use an ordered restriction enum:

```text
NORMAL
NO_NEW_LAUNCHES
BUY_PAUSED
TRADING_PAUSED
```

Interpretation:

- `NORMAL`: launches, buys and sells allowed subject to ordinary protocol state;
- `NO_NEW_LAUNCHES`: existing launch trading continues, new launches blocked;
- `BUY_PAUSED`: new launches blocked and buys blocked; sells remain available;
- `TRADING_PAUSED`: launches, buys and sells blocked.

An independent `graduationPaused` flag is reserved for Day-5 graduation integration.

### Guardian authority

Guardian may only:

- move the ordered mode toward a numerically/more restrictive state;
- set `graduationPaused` from false to true.

Guardian may not:

- reduce restrictions;
- unpause any mode;
- move USDC or launch tokens;
- change FeePolicy;
- change launch fee, creator tax or fee recipients;
- redirect FeeEscrow claims;
- alter launch configuration/economics digest inputs;
- change Factory/deployer dependencies;
- call arbitrary downstream contracts;
- change or reset opening protection timestamps/formula/exemptions.

### Protocol Admin authority

Protocol Admin may increase or reduce restrictions and may unpause `graduationPaused`.

Protocol Admin emergency-control methods still may not transfer user/creator funds or rewrite existing launch economics. Economic/configuration changes, where permitted for future launches, remain on their owning components and are separately evented/snapshotted.

### Ownership transfer

Use a multisig-compatible two-step admin-transfer mechanism or equivalent explicit accept flow so a mistyped successor cannot instantly take control.

The implementation plan must preserve the Source Pack rule that production admin authority is handed to the approved Safe and no single EOA remains the durable production authority.

## Integration points into BreadBondingCurve

Day 4 should extend `BreadBondingCurve` minimally rather than replace its Day-3 money path.

Required new behavior is limited to:

- immutable/one-shot launch timestamp used for opening protection;
- EmergencyController checks for buy/sell permission;
- ordinary-buy opening-tax calculation/routing;
- factory-only one-use launch+buy exemption path;
- events/readers needed to expose the applied opening tax and opening-protection state.

The following Day-3 behavior must remain unchanged except where the opening tax explicitly changes net buy input:

- tracked reserves are canonical;
- direct donations do not affect pricing state;
- creator tax remains a separate bucket;
- standard fee split remains snapshotted;
- sell fee/tax calculation remains unchanged;
- final-buy reserved-floor clamp/refund remains canonical;
- FeeEscrow credit/claim authority remains canonical;
- creator-recipient rotation affects only future fee sweeps;
- ready-to-graduate closure remains intact.

## Launch permission and emergency ordering

Before creating a new launch, the Factory must require EmergencyController launch permission.

Before ordinary/exempt buys, the curve must require buy permission.

Before sells, the curve must require sell permission.

Emergency checks do not mutate economic state.

If a mode changes while a user transaction is pending, the transaction evaluates the current on-chain mode at execution and reverts if the action is no longer permitted. No backend/UI cache is authoritative.

## Events / provenance

Day-4 events must be sufficient for later SDK/indexer work to reconstruct canonical launch and emergency state without guessing from raw transfers.

At minimum design for deterministic events covering:

- launch created: token, curve, deployer, creator recipient, creator tax, launch fee, economics digest, launch timestamp, version/config id;
- launch-fee credit: token/curve or launch identity, protocol recipient and exact USDC amount, reconciled with canonical FeeEscrow credit;
- atomic Launch+Buy result: caller, token/curve, recipient, offered quote, actual spent quote, refund, tokens out;
- opening protection applied: buyer/caller, applied tax bps, tax amount, exempt/non-exempt reason code;
- future launch configuration/economics updates;
- restriction mode changes with caller/role, previous mode and next mode;
- graduation pause changes;
- admin/guardian transfer/update where such role rotation exists.

Events are observability/provenance, not substitute accounting state.

## Required proofs

### Factory / economics snapshot

- only authorized Factory path initializes a curve/token pair;
- launch records correspond to deployed pair addresses and cannot be overwritten;
- metadata caps reject overlong values;
- current FeePolicy is snapshotted by each curve exactly once;
- later FeePolicy/future Factory configuration changes do not rewrite an existing launch;
- stale/wrong `expectedEconomics` reverts before a launch becomes durable;
- digest changes when any bound economic term changes and remains stable when unrelated operational state changes;
- launch fee is exact canonical USDC, goes only through the ratified protocol FeeEscrow recipient path, and leaves no Factory-held balance;
- no CREATE2/deterministic address promise exists in the public Day-4 API.

### Launch+Buy

- launch-only succeeds without temporary USDC custody remaining after success;
- atomic launch+buy succeeds and uses canonical curve pricing/state;
- launch+buy with zero/invalid input rejects;
- short-transfer/adversarial quote token cannot create underfunded launch/buy state in fixtures;
- launch-fee credit failure rolls back the whole launch;
- slippage failure rolls back token/curve deployment, launch-fee credit and all USDC movement;
- initialization failure rolls back all deployment/custody;
- final partial fill uses the exact sequential ceiling gross-up, charges exact coded `spent`, refunds all excess and preserves reserved floor;
- refund transfer failure reverts whole launch+buy;
- Factory has no residual per-intent USDC after success;
- temporary allowance does not create a reusable drain path;
- no second pricing or fee ledger exists in Factory.

### Opening protection / INV-040–044

Prove every integer timestamp in and around the protection window:

- exact sequence `9900, 6336, 3564, 1584, 396, 0` bps at elapsed `0..5`;
- all values are `0 <= tax <= 9900`;
- tax never increases as time advances;
- all timestamps at/after expiry return exactly zero;
- launch timestamp cannot reset;
- ordinary buy is taxed, sell is not;
- only same-transaction Factory Launch+Buy can use the exemption;
- no reusable exemption state remains after the atomic call;
- launcher/creator/recipient receives no continuing exemption;
- opening-tax USDC exactly joins `quoteFeeBalance` and later reconciles through the existing protocol/creator split and FeeEscrow path;
- six-decimal USDC boundary/fuzz cases do not overcharge beyond the explicit coded ceiling-gross-up rule, underflow or create rounding-extraction loops;
- final partial fill with opening tax satisfies `netCurveInput >= netRequired`, refunds `received - spent`, and reconciles `spent = netCurveInput + base fee + creator tax + snipe tax` exactly.

### Emergency / INV-060–063

- Guardian can move NORMAL -> NO_NEW_LAUNCHES -> BUY_PAUSED -> TRADING_PAUSED;
- Guardian can skip directly to a more restrictive mode;
- Guardian cannot move in the opposite direction;
- Guardian cannot unpause graduation;
- Protocol Admin can reduce restrictions/unpause;
- unauthorized callers cannot change restrictions;
- no EmergencyController function moves USDC/token funds;
- no EmergencyController function changes FeePolicy, launch fee, creator tax, recipients, economics hash, launch timestamp or exemption state;
- future config changes leave existing launch snapshots unchanged;
- production ownership handoff fixtures prove the intended multisig-compatible control path and no durable single-EOA admin configuration is accepted as release-ready.

### Stateful integration

Run bounded random sequences including:

- launch;
- atomic launch+buy;
- ordinary buys across opening-protection timestamps;
- sells during the opening window;
- future FeePolicy/config changes;
- fee sweeps/claims;
- Guardian restriction increases;
- Admin restriction decreases;
- direct token/USDC donations.

Preserve all previously applicable Day-3 invariants plus INV-040–044 and INV-060–063.

## Security / failure boundaries

- Factory, Deployer and EmergencyController are non-custodial except for tightly bounded transient Launch/Launch+Buy USDC custody inside one reverting transaction.
- Launch-fee revenue is not left as raw Factory balance; it becomes an exact FeeEscrow credit to the snapshotted protocol recipient.
- No rescue path may consume FeeEscrow backing or creator/user claims.
- No arbitrary-call admin surface is introduced.
- No unbounded permanent allowance from Factory to curve or FeeEscrow is allowed.
- Reentrancy protection must cover Factory launch orchestration and any curve path that adds new external-transfer ordering.
- External reference code is evidence, not authority; all new/reconstructed money-path behavior is re-proven under Bread USDC and permission semantics.
- Static/manual review and later independent review requirements remain active; Day-4 PASS is not equivalent to unrestricted public-money launch approval.

## Explicit exclusions

Day 4 MUST NOT implement or infer:

- graduation reserve sweep/DEX seeding;
- `GraduationCoordinator` or concrete DEX adapter execution;
- permanent LP locker;
- buyback execution/vesting;
- native ETH/native-USDC business accounting;
- Permit2/Universal Router merely because references use them;
- CREATE2/deterministic launch-address guarantees;
- guessed Arc mainnet addresses;
- guessed current-live Pons fee/config values;
- a claim that the Bread quadratic opening tax is exact Pons parity;
- permanent creator/deployer exemption from opening protection;
- Guardian unpause/economic/fund authority;
- parallel fee, tax, claim or reserve accounting.

## Day-4 acceptance gate

Day 4 may be closed only when one exact integrated candidate proves:

1. Factory/Deployer launch + economics pinning PASS;
2. atomic Launch+Buy PASS, including rollback/no-stranded-custody and final partial-fill/refund;
3. exact opening-tax formula and monotonicity PASS for all timestamp boundaries and fuzzed timestamps;
4. INV-040 through INV-044 PASS;
5. Guardian restriction-only behavior and Admin-only unpause PASS;
6. INV-060 through INV-063 PASS;
7. all applicable Day-1 through Day-3 regression/invariant suites remain green;
8. repository bootstrap/source-integrity, dependency/build/workspace-clean, Foundry and PostgreSQL/Redis health gates all PASS on the exact head;
9. no unresolved critical/high Day-4 financial/security issue remains in the reviewed scope;
10. `docs/current-build-state.yaml` and Day-4 evidence are updated and exact-head verified before guarded merge.

Day 5 must not begin before the Day-4 integrated closeout is durably merged and verified.

## Blocker disposition after design approval

The architecture/economic decision is approved in this repo design, but the Project Source gate is not yet cleared:

```text
BREAD_SNIPE_DECAY_FORMULA = DECISION_APPROVED_PENDING_PROJECT_SOURCE_RATIFICATION
```

The following broader blockers remain active and are not silently cleared:

- `CURRENT_PONS_FACTORY_SOURCE_PARITY` — no exact current-live factory parity claim;
- `LIVE_RUNTIME_CONFIG` — production launch fee and other deployment values remain unresolved;
- `PONS_AUDIT_FINDINGS` — independent source/audit reconciliation remains outstanding;
- `ARC_MAINNET_VALUES` — do not hardcode until officially published/reconciled.

These blockers do not authorize alternate Day-4 economics. They remain release/integration gates where applicable.

## Self-review result

The committed design has been checked for:

- placeholder/TBD language affecting behavior — none remains;
- internal contradictions — the opening-tax and final-fill rounding order is now explicit and reduces exactly to Day-3 gross-up when opening tax is zero;
- scope drift — Day-5 graduation/DEX/locker and buyback remain excluded;
- duplicated accounting — launch fee and opening tax both route through existing Bread FeeEscrow/fee accounting rather than creating new ledgers;
- unresolved live values — values such as production launch fee remain explicit deployment configuration blocked by `LIVE_RUNTIME_CONFIG`, not guessed defaults;
- source-governance compliance — Day-4 production remains a hard stop until affected Project Sources are replaced/uploaded/read back/ratified.

## Implementation transition rule

Before production Solidity work:

1. obtain explicit user review/approval of this committed spec;
2. generate the affected consolidated Project Source replacements carrying these exact Day-4 decisions;
3. have the user replace/upload those Project Sources;
4. read them back and reconcile against this spec and `docs/current-build-state.yaml`;
5. explicitly establish `PROJECT_SOURCE_RATIFICATION_FOR_DAY4_PRODUCTION = RATIFIED`;
6. write the detailed TDD implementation plan;
7. begin implementation from a clean isolated branch/worktree based on the accepted Day-3 handoff baseline;
8. require RED before each production behavior addition/repair and exact-head GREEN before merge.
