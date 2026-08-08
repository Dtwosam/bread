# Bread Day 5 Graduation Coordinator Design

Date: 2026-08-08
Status: DESIGN FREEZE CANDIDATE — no production Solidity authorized by this document alone
Baseline: `a40cc987a0201119f2ae21eff5a508d5e5cf8fd8`
Project Source pack: `v1.5-day5-preflight-consolidated` (ratified in the active build conversation)
Day-4 closeout milestone: `7533b9f243e1c53106188aa662919f6166448f2e`

## 1. Purpose and controlling constraints

Day 5 adds the graduation/liquidity-lock layer to the already accepted Bread lifecycle. It does not create a second protocol or accounting subsystem.

The controlling lifecycle is:

`Factory / BreadBondingCurve -> graduation readiness -> GraduationCoordinator -> snapshotted IGraduationAdapter -> verified canonical DEX -> permanent locker -> canonical events`

The design is constrained by the ratified Project Sources and must satisfy:

- `INV-050`: at most one canonical graduated pool/state outcome per launch.
- `INV-051`: exact snapshotted adapter and graduation parameters are used.
- `INV-052`: no ordinary sweep before seedability/adapter/dependency validation.
- `INV-053`: failed automatic graduation cannot revert the successful threshold-crossing buy.
- `INV-054`: retry cannot double-spend swept assets or duplicate liquidity.
- `INV-055`: successful graduation accounts for all reserved launch tokens and USDC apart from explicitly modeled dust.
- `INV-056`: permanent liquidity has no ordinary withdrawal/arbitrary-call/admin escape path.
- Guardian may only increase restriction and may set `graduationPaused=true`; it cannot unpause, move funds, alter economics, or substitute adapters/dependencies.
- Protocol Admin alone may clear `graduationPaused` and may use documented delayed stuck-graduation recovery under exact state/time preconditions.
- Existing launch adapter identity and parameters are immutable snapshots. Future stack changes affect new launches only.
- Arc mainnet DEX addresses and Bread production economics/admin addresses remain release/deployment gates and must not be guessed.
- Local/testnet work may use controlled implementations of official DEX interfaces; fixtures never become canonical deployment claims.

The frozen Pons V2 repository at `ponsdotdev/ponsfamily@d5491e20be56051a68abf47136f6890c3ce3ff7d` is a reference for behavior and implementation patterns, not an authority over Bread economics, admin powers, custody, or current-live parity.

## 2. Selected architecture

Bread uses a hardened two-stage graduation state machine owned by a single `GraduationCoordinator`.

Per launch, the coordinator records exactly one phase:

```text
NOT_GRADUATED
      |
      | permissionless stage 1: validate + sweep
      v
    SWEPT
      |
      | permissionless stage 2: adapter create/seed/lock
      v
 POOL_CREATED

    SWEPT
      |
      | delayed Protocol Admin stuck-graduation recovery
      v
   RESCUED
```

`POOL_CREATED` and `RESCUED` are terminal. There is no durable `IN_PROGRESS` phase. A transaction-local reentrancy guard protects execution while EVM revert semantics restore the prior durable phase on failure.

This design preserves the useful Pons two-stage/retryable behavior while deriving the state placement from Bread's own invariants:

- Stage 1 contains no DEX external effect. It validates the exact snapshotted destination and seedability before transferring tracked curve reserves.
- Stage 2 may make external DEX calls, but it starts only from the exact recorded `SWEPT` balances. A reverting adapter call leaves the launch in `SWEPT` with the same recorded assets, so another caller can retry safely.
- No caller may select an adapter, DEX, pool parameters, recipient, or economic terms at graduation time.

## 3. Graduation readiness and curve handoff

The exact readiness condition remains the existing Bread curve condition:

`readyToGraduate() == !graduated && sellableTokens() == 0`

This preserves the accepted token-side hard-stop semantics. It is equivalent to reaching the snapshotted graduation point but cannot be overshot by a large final buy.

Once the curve is graduation-ready:

- new buys remain closed because no sellable tokens remain;
- sells remain closed while `readyToGraduate()` is true, preserving deterministic graduation reserves;
- direct token or USDC donations do not affect readiness because tracked reserves, not raw balances, are authoritative.

`BreadBondingCurve` gains one narrow graduation handoff surface callable only by the canonical coordinator snapshotted/wired for its stack. The function:

1. requires the curve to be ready;
2. sets the curve's `graduated` closure flag before any external fee/asset transfer from the curve;
3. settles existing pending curve fees through the already canonical Bread fee/escrow path without creating a new graduation fee ledger;
4. zeroes the tracked graduation reserves before transferring them;
5. transfers only tracked graduation USDC and tracked launch tokens, never unsolicited raw-balance donations;
6. returns nominal amounts while the coordinator independently measures actual balance deltas.

The curve handoff is intentionally not an arbitrary-recipient sweep. The only permitted recipient is the canonical `GraduationCoordinator` for that stack.

## 4. Automatic trigger and permissionless retry

The final threshold-crossing `buy` performs a best-effort call to the coordinator after the successful trade state and user token/refund transfers have been established.

The automatic call attempts Stage 1 only. It is wrapped so a graduation failure cannot revert the already successful crossing buy, satisfying `INV-053`.

Any address may subsequently call the coordinator to:

- perform Stage 1 if the launch is still `NOT_GRADUATED` and the curve is ready;
- perform Stage 2 if the launch is `SWEPT`.

Permissionless callers provide no graduation configuration. Their only meaningful input is launch identity. All money-path values are read from immutable/snapshotted Bread state.

`graduationPaused` blocks both ordinary Stage 1 and Stage 2 before financial state mutation. Pause is a restriction gate only; it is not a graduation phase or custody record.

## 5. Per-launch graduation snapshot

The Factory remains the canonical launch registry and is extended so each launch permanently binds to the graduation destination selected by the stack active at launch time.

The launch snapshot includes, directly or through an immutable config hash:

- canonical `GraduationCoordinator` for the stack;
- `IGraduationAdapter` identity;
- adapter family/version identifier;
- canonical quote asset, which is Bread V1 USDC;
- adapter-specific pool parameters required to deterministically reconstruct the destination, such as V4 fee/tick spacing/hook identity or V3 fee tier where applicable;
- immutable dependency/config digest sufficient to reject an adapter whose PoolManager/PositionManager/router/factory/Permit2/locker wiring differs from the launch snapshot;
- the existing economics digest extended only where necessary so a launch cannot be created against one graduation destination and later receive another.

A later Factory configuration may select another adapter only for future launches. There is no migration function that rewrites an existing launch's graduation snapshot.

## 6. `IGraduationAdapter` boundary

`IGraduationAdapter` is DEX-neutral and intentionally narrow. It owns DEX-specific validation and execution, not Bread lifecycle authority.

The interface must support the coordinator's needs without allowing caller discretion:

- identify/validate its immutable dependency set;
- validate a candidate TOKEN/USDC seed before Stage 1 can sweep;
- deterministically derive the target pool identity and opening-price inputs from launch snapshot + swept amounts;
- execute Stage 2 using exactly the coordinator-provided launch assets;
- return a canonical result containing pool identity, locked position identity where the DEX exposes one, and actual token/USDC consumption/residue needed for reconciliation;
- expose enough read-only identity information for manifests, deployment verification, and wrong-dependency tests.

The adapter cannot:

- replace the launch's snapshot;
- change Bread fee policy or creator-tax accounting;
- choose an arbitrary recipient for principal liquidity;
- act as the emergency authority;
- maintain a competing graduation phase ledger.

## 7. V4 path

V4 is the preferred production path only when an official Arc deployment is independently verified and compatibility tests pass. Until then, the implementation and tests use official Uniswap interfaces plus controlled fixtures, with no canonical Arc V4 address claim.

The V4 lane adapts the useful Pons guard/executor/hook separation:

### 7.1 V4 graduation guard

A stateless guard validates before Stage 1 sweep that the intended seed can be represented and minted. At minimum it validates:

- nonzero token and USDC seed amounts;
- canonical token ordering;
- valid fee/tick-spacing combination for the selected official interface;
- amount-width constraints imposed by downstream V4 settlement;
- derived sqrt price within core bounds;
- nonzero full-range liquidity;
- per-tick liquidity limits;
- exact immutable dependency identity expected by the launch snapshot.

The guard is a preflight; it cannot move assets.

### 7.2 V4 executor

The executor receives only the exact Stage-2 amounts for one launch attempt. It performs the required approval/Permit2/PositionManager flow and does not retain ordinary balances between successful transactions.

Liquidity is minted directly to the permanent locker. No Protocol Admin, Guardian, creator, coordinator, or adapter EOA receives the position first.

### 7.3 V4 hook and fee path

Where a V4 hook is part of the verified adapter configuration, post-graduation fee behavior remains separate from principal custody. Bread does not add a generic locker withdrawal/fee-collection escape hatch.

Bread-owned `FeePolicy` and `FeeEscrow` remain the canonical fee-accounting authorities. Numerical production hook fees or splits are not inferred from Pons source defaults; test-only values may be used for Day-5 verification and must be marked non-production.

## 8. V3 fallback

A V3 adapter is implemented behind the same `IGraduationAdapter` boundary but remains inactive in network manifests unless verified Arc environment evidence requires it and compatibility/security tests pass.

The V3 implementation must preserve the same Bread invariants:

- immutable per-launch adapter/config snapshot;
- seedability validation before Stage 1 sweep;
- deterministic TOKEN/USDC pool identity;
- full accounting of consumed/residual assets;
- position ownership directly in a permanent locker;
- retry safety and exactly one terminal pool outcome.

Day 5 does not invent a production V3 post-graduation fee-distribution policy. Any DEX-native fee right that is separable from principal must not imply a principal withdrawal capability. Because the V3 adapter is inactive pending verified need, activation requires a later verified manifest decision and, if fee routing would change Bread economics, a controlling source amendment before activation.

## 9. Price preservation and surplus launch tokens

Bread preserves the Pons-derived graduation-allocation relationship rather than placing the entire reserved token balance into the DEX blindly.

For swept graduation balances:

```text
virtualQuote = sweptUsdc + phantomQuote
poolTokenAmount = floor(sweptTokens * sweptUsdc / virtualQuote)
excessTokenAmount = sweptTokens - poolTokenAmount
```

`poolTokenAmount` is paired with the swept USDC for the DEX seed. `excessTokenAmount` is permanently locked as launch-token supply and cannot later enter circulation through an admin rescue.

This removes the virtual quote reserve while preserving the terminal curve price implied by the accepted constant-product/graduation math.

Zero-valued or otherwise unseedable outcomes are rejected by preflight before ordinary Stage 1 sweep.

## 10. Stage 1: validate and sweep

`GraduationCoordinator.sweep(token)` is permissionless and `nonReentrant` at the coordinator level.

Before any irreversible ordinary sweep it requires:

1. launch exists in the Factory;
2. launch phase is `NOT_GRADUATED`;
3. `graduationPaused == false`;
4. launch curve identity matches the Factory record;
5. curve is `readyToGraduate()`;
6. quote asset is the snapshotted canonical USDC;
7. adapter is exactly the snapshotted adapter;
8. adapter dependency identity/config hash matches the launch snapshot;
9. token ordering/destination derivation is valid;
10. the adapter's preflight accepts the price-preserving USDC/token seed.

The coordinator then measures its token and USDC balances before and after the curve handoff and records what it actually received. Nominal/actual mismatch that violates Bread's exact-transfer assumptions reverts the Stage-1 transaction.

Only after the exact balances are known does the coordinator persist:

- `sweptUsdc`;
- `sweptTokens`;
- `sweptAt`;
- `phase = SWEPT`.

A Stage-1 revert restores the curve and coordinator to the pre-attempt state. The crossing buy remains successful because its best-effort external call catches the revert.

## 11. Stage 2: create, seed, and permanently lock

`GraduationCoordinator.createPool(token)` is permissionless and `nonReentrant`.

It requires:

- phase is exactly `SWEPT`;
- `graduationPaused == false`;
- current adapter/dependency identity still matches the immutable launch snapshot;
- the recorded swept amounts still reconcile with coordinator custody;
- the adapter preflight still accepts the deterministic seed.

The coordinator computes the price-preserving pool token amount and permanent excess-token amount.

To make replay structurally safe, the coordinator uses checks-effects-interactions inside one reverting transaction:

- it moves the launch's Stage-2 accounting to a transaction-local consumed state before the adapter external call;
- it gives the adapter only the exact amounts recorded for that launch;
- adapter execution must either produce the expected canonical pool/position/lock result or revert;
- any revert restores the durable `SWEPT` phase and balances;
- only after successful adapter return and lock verification does the coordinator persist terminal `POOL_CREATED` state and clear swept custody fields.

A repeated Stage-2 call after terminal success fails before asset movement. This, together with immutable pool identity and locker one-time registration, provides defense in depth for `INV-050` and `INV-054`.

The implementation must not catch an adapter revert and then commit partial success state. If a DEX-specific interaction can create externally persistent progress without reverting atomically, the adapter must detect that progress on retry and prove idempotence before it can satisfy the interface; otherwise that adapter is not compatible with Bread.

## 12. Permanent locker

The Day-5 locker is non-upgradeable and its principal-liquidity promise is enforced by absence of capability, not only by an event or boolean.

For a position-based DEX, the position is minted directly to the locker and registered once per launch after verifying actual ownership.

The locker exposes no function that can:

- decrease or withdraw promised principal liquidity;
- transfer the locked position to an admin/creator/recipient;
- change a recipient in a way that recovers control of principal;
- execute arbitrary external calls;
- approve an operator capable of removing principal;
- upgrade into an unlock path.

The locker may separately account for permanently locked excess launch-token supply. That supply has no ordinary withdrawal path.

Fee rights, where supported by the selected DEX adapter, are explicitly distinct from principal withdrawal. The generic locker does not gain an arbitrary-call mechanism merely to collect fees.

## 13. Dust and residue

Dust is explicit and cannot become a hidden custody or claim ledger.

After a successful adapter execution:

- launch-token residue that is not part of the canonical position is transferred/registered as permanently locked token supply;
- residual USDC attributable to the launch is reconciled explicitly and credited through the existing Bread `FeeEscrow` to the launch's snapshotted protocol fee recipient;
- no residual amount is silently left in the coordinator as unowned pooled custody;
- adapter/executor contracts are expected to end a successful call with no ordinary launch-attributable balance other than a residue that is explicitly reported and resolved in the same transaction.

This rule introduces no new percentage or fee split. Production fee percentages remain governed by `BREAD_PRODUCTION_ECONOMICS_CONFIG` and existing Bread fee snapshots.

Donation resistance is preserved by using tracked curve reserves for Stage 1 and launch-attributed deltas for coordinator/adapter reconciliation rather than folding arbitrary raw balances into the seed.

## 14. Failure and retry semantics

The following are ordinary retryable failures and leave financial state unchanged for the failed stage:

- adapter/executor revert;
- DEX initialization/mint revert;
- wrong dependency identity;
- wrong PoolManager/PositionManager/router/Permit2/locker wiring;
- wrong token ordering;
- invalid price/tick/liquidity derivation;
- exact-transfer mismatch;
- `graduationPaused` becoming active before an attempt.

Stage 1 failure leaves the launch `NOT_GRADUATED` and the successful crossing buy intact.

Stage 2 failure leaves the launch `SWEPT` with the exact recorded custody and allows another permissionless retry.

No retry may change adapter/config, amount, recipient, DEX destination, or pool identity.

## 15. Delayed stuck-graduation recovery

Bread preserves a delayed Protocol Admin recovery path for a launch that is already `SWEPT` but cannot complete Stage 2 because a snapshotted dependency/asset has become permanently incompatible.

The recovery path is not an ordinary admin withdrawal and is unavailable for a successfully locked launch.

It requires:

- phase exactly `SWEPT`;
- `graduationPaused == true`;
- Protocol Admin multisig authority;
- the frozen recovery delay to have elapsed from `sweptAt`;
- explicit recipient and full event disclosure;
- transition to terminal `RESCUED` before transfer, with transaction revert restoring the prior state on transfer failure.

Bread adopts the frozen Pons reference's seven-day stuck-graduation delay as the Day-5 recovery constant. This is a Bread design choice derived from the frozen reference, not a claim about current-live Pons runtime configuration.

Guardian cannot execute recovery. Recovery cannot rewrite launch economics, select a replacement adapter, or remove liquidity from a `POOL_CREATED` launch.

## 16. Emergency integration

`GraduationCoordinator` consumes the existing Day-4 `IBreadEmergencyController.graduationPaused()` state.

There is no coordinator-owned pause role or adapter-owned emergency state.

- Guardian may set graduation pause from false to true through the existing controller.
- Guardian cannot clear the pause.
- Protocol Admin may clear it through the existing controller.
- A paused graduation attempt reverts before changing phase/custody.
- Pausing does not alter Factory launch records, swept balances, adapter snapshots, or fee claims.

## 17. Canonical events

Day 5 emits deterministic events sufficient for Day-6 SDK/indexer/API/UI reconstruction without treating the indexer as authority.

Required event semantics:

- `GraduationReady(token, curve, adapter)` — readiness observed/automatic attempt boundary; informational only, no funds implied.
- `GraduationSwept(token, adapter, usdcAmount, tokenAmount, sweptAt)` — Stage 1 committed.
- `GraduationAutoAttemptFailed(token, reasonHash)` — best-effort automatic Stage-1 call failed while the user trade remained successful; event data must not expose unbounded revert payloads.
- `GraduationCompleted(token, adapter, poolId, positionId, usdcUsed, tokenUsed, tokenLocked, usdcDust)` — terminal successful state.
- `GraduationRescued(token, recipient, usdcAmount, tokenAmount)` — terminal delayed recovery.
- `GraduationTokenResidueLocked(token, amount)` — explicit permanent token residue/surplus accounting.
- `GraduationUsdcDustCredited(token, recipient, amount)` — explicit USDC dust reconciliation.

Exact Solidity event types are finalized in the implementation plan, but these meanings are frozen.

## 18. Deployment and manifest design

Day 5 extends the existing uniform deployment/configuration system rather than hard-coding chain addresses in Solidity/business logic.

The network manifest supplies verified environment values such as:

- chain ID;
- canonical USDC;
- DEX core/periphery dependencies;
- Permit2 where required;
- RPC/explorer/integration domains.

The protocol manifest records at minimum:

- stack version/source commit;
- Factory/Deployer/router;
- FeePolicy/FeeEscrow/vault;
- EmergencyController;
- GraduationCoordinator;
- active adapter(s) and immutable dependency/config digests;
- permanent locker;
- Protocol Admin and Guardian ownership state.

An adapter may be marked active for a network only after authoritative deployment evidence and compatibility tests. Arc mainnet V4/V3 values remain intentionally absent until officially published and verified.

Deployment scripts must cover deploy, wire, verify, ownership handoff, manifest emission, smoke launch/trade/graduation/lock, and reconciliation. Testnet and mainnet use the same script and manifest schemas.

## 19. Security and verification plan

Implementation begins with RED tests and must cover more than the happy path.

### Unit tests

Cover every public/external coordinator, adapter, locker, and new curve/factory branch, including phase errors, pause state, wrong caller, wrong dependency, exact-transfer failure, terminal replay, and recovery preconditions.

### Fuzz tests

Cover:

- six-decimal USDC boundaries;
- 0/1/near-maximum valid seed amounts;
- graduation price/allocation rounding;
- token ordering;
- dust/residue accounting;
- final-buy boundaries around readiness.

### Stateful invariants

Randomize launches, buys, final fills, donations, pause/unpause, auto-graduation failure, manual sweep, Stage-2 retries, and recovery. Continuously assert `INV-050` through `INV-056` plus USDC/token conservation.

### Adversarial integration tests

Required scenarios include:

- adapter/executor revert at every meaningful external stage followed by successful retry;
- simulated partial/existing DEX progress cannot cause duplicate pool/liquidity on retry;
- wrong adapter/PoolManager/PositionManager/router/Permit2/locker/quote asset/token ordering rejects before ordinary sweep where applicable;
- direct curve/coordinator/adapter donations do not manipulate readiness or seed value;
- Guardian pause blocks progression without financial mutation;
- future Factory/stack config changes cannot move an old launch to a new adapter;
- locker has no principal withdrawal, transfer, arbitrary-call, approval, upgrade, or admin-rescue escape path;
- delayed rescue fails before the exact delay/state/pause requirements and cannot execute after `POOL_CREATED`.

### Release gate

Day 5 cannot close unless:

- `FULL_LAUNCH_TRADE_GRADUATE_LOCK_PASS`;
- `INV-050` through `INV-056` pass;
- `RETRY_CANNOT_DUPLICATE_LIQUIDITY` passes;
- exact-head repository CI/security jobs pass;
- no guessed canonical Arc DEX activation exists in manifests;
- any relevant newly published Pons audit finding has been mapped to Bread;
- Bread independent review remains scheduled/required before unrestricted public-funds mainnet release.

## 20. Current release blockers that this design does not erase

The following remain intentionally open and are not implementation blockers for local/testnet Day-5 engineering unless their exact values are required:

- `CURRENT_PONS_FACTORY_SOURCE_PARITY = OPEN_REFERENCE_GAP_NON_BLOCKING_FOR_BREAD; exact-current parity claims only`.
- `PONS_V2_RUNTIME_REFERENCE = READ_SURFACE_VERIFIED_NUMERIC_STATE_PENDING; reference/parity evidence only`.
- `BREAD_PRODUCTION_ECONOMICS_CONFIG = OPEN_PUBLIC_MAINNET_RELEASE_GATE; no production values guessed`.
- `PONS_AUDIT_FINDINGS = NO_PUBLIC_PONS_AUDIT_REPORTS_PUBLISHED_AS_OF_2026-08-08; continuing watch; Bread independent review required`.
- `ARC_MAINNET_VALUES = WAITING_FOR_OFFICIAL_PUBLICATION; mainnet deployment only; not Day-5 testnet blocker`.

This design must not convert any of those gates into guessed constants, addresses, or parity claims.

## 21. Implementation boundary

This document freezes Day-5 architecture only. Production implementation must follow the project workflow:

1. written-design review gate;
2. detailed Day-5 implementation plan and self-review;
3. RED tests first;
4. minimal implementation to GREEN;
5. focused unit/fuzz/invariant/adversarial integration tests;
6. static/manual security review;
7. exact-head full repository CI;
8. guarded PR merge;
9. fresh merged-main Day-5 closeout evidence.

No Day-6 SDK/indexer/API/UI feature work is part of this implementation slice beyond freezing the event contract those consumers will later use.
