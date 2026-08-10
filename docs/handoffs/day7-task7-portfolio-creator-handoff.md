# Day 7 Task 7 — Portfolio, Creator Dashboard and USDC Claims — Durable Handoff

Date: 2026-08-10

## Verdict

`DAY7_TASK7_PORTFOLIO_CREATOR_CLAIMS_INTEGRATED_PASS_DURABLE`

This docs-only candidate records the durable Task-7 verdict. It becomes authoritative only after this exact handoff head passes the required repository/retained gates, is guarded-merged, and the resulting `main` plus `docs/current-build-state.yaml` are freshly read back.

## Accepted implementation baseline

- Pre-Task-7 durable baseline: `1a34247c5677cd8667752f2f54ad9ff82b2d453b`
- Implementation PR: `#76`
- Final audited implementation head: `8e8ce7e35b081d4a0ae2d6b85ee35c30454629bc`
- Guarded squash merge on `main`: `927718ed0b7579948a69562c78197bebecbc9c21`
- Implementation title: `feat(day7): add portfolio creator and claim flows (#76)`

Fresh repository history after merge showed `927718ed0b7579948a69562c78197bebecbc9c21` as current `main` before this handoff branch was created.

## Source contract consumed

Task 7 consumed the frozen Day-7 Portfolio/Creator/claim contract from 04A–04D and the accepted Day-6 API/SDK plus Task-5 transaction lifecycle.

Controlling rules preserved:

- `/portfolio` and `/creator` are wallet-aware public routes.
- Portfolio reads use the accepted indexed `/v1/portfolio/:address` boundary; chain/RPC is not the normal holdings-rendering fanout path.
- Creator reads use the accepted indexed `/v1/creators/:address` boundary.
- Chain remains financial authority. Indexed Creator `indexedClaimable` is a projection and is not the amount authority for a signed claim.
- Before a Claim signature, Bread rereads canonical FeeEscrow `balanceOf(recipient)` and prepares through the accepted `prepareClaim` builder.
- Claims are direct wallet/provider writes. Bread does not add a financial mutation API, transaction relay, server signer or user-signing-material custody.
- PnL and average entry are absent while the accepted API lacks complete reliable cost-basis evidence.
- Fields not canonically exposed by the accepted Creator projection remain explicitly unavailable instead of being guessed or filled through per-row RPC fanout.
- Desktop Portfolio uses table-density presentation; mobile uses stacked holdings without a primary horizontal-scroll dependency.
- Confirmed Claim execution/recovery invalidates and refetches indexed Creator data.

## What Task 7 integrated

### Portfolio

- Added `/portfolio` with disconnected, wrong-network, loading, error, empty and ready states.
- Uses the accepted shared API client/query key for bounded indexed holdings.
- Renders token identity, canonical token-page navigation, launch-token balance, indexed current value, movement availability and indexed activity.
- The current-value display consumes the API-provided rational projection rather than recomputing curve finance in UI code.
- Wallet value is shown only when every indexed holding in the loaded result has an available current value; otherwise the total remains unavailable rather than presenting a misleading partial sum.
- Movement remains `—` because the accepted API does not provide a trustworthy movement field.
- PnL and average entry remain absent because no complete reliable cost basis exists.
- Desktop uses a dense holdings table; tablet reduces secondary columns; mobile transforms the same holdings into single-column stacked cards.

### Creator dashboard

- Added `/creator` with disconnected, wrong-network, loading, error and ready states.
- Displays indexed total earned, indexed claimable projection and per-launch earned revenue.
- Active-launch count, locked buyback tokens, per-launch market cap and per-launch state remain `—` because the accepted Creator API does not currently expose those fields authoritatively.
- No per-launch RPC fanout or guessed analytics were introduced to fill those gaps.

### Claim review, execution and recovery

Claim review:

1. reads FeeEscrow `balanceOf(recipient)` through the generated canonical FeeEscrow ABI;
2. rejects invalid negative/non-bigint read results;
3. prepares no transaction when claimable is zero;
4. otherwise prepares through canonical `prepareClaim`.

Execution ordering:

1. validate connected account and target chain;
2. require the connected account to match the reviewed claim recipient;
3. reread canonical FeeEscrow claimable state;
4. block signing and return the updated review when the amount changed;
5. simulate the exact prepared Claim immediately before signature;
6. send directly through the wallet/provider;
7. persist the transaction hash immediately before receipt waiting;
8. enter SUBMITTED/CONFIRMING through the shared transaction state;
9. preserve replacement handling;
10. preserve `UNKNOWN` when receipt transport is lost rather than inventing onchain failure;
11. distinguish mined revert from temporary transport uncertainty;
12. on confirmation, invalidate/refetch the accepted Creator projection.

Reload recovery:

- `CLAIM` is an additive shared transaction action.
- Existing global recovery defaults remain BUY/SELL; Task 7 did not let the global Trade recovery consumer absorb Claim records.
- Claim recovery explicitly loads `actions: ['CLAIM']` and scopes records to the currently connected recipient.
- Stored claim recovery metadata includes `claimRecipient`; it does not become financial authority.
- An unresolved submitted/confirming/replaced/unknown Claim remains duplicate-action locked.

### Shared status copy

Task 7 exposed one cross-surface UX defect during final source review: the shared PREPARING status said “Refreshing current trade state and simulating…”, which was inaccurate for Claim. A dedicated RED proved the drift while ten prior Task-7 assertions stayed green. The shared copy is now action-neutral: “Refreshing current onchain state and simulating…”. Trade behavior and state transitions were not changed.

## TDD evidence

The implementation was built through real missing-behavior RED → GREEN slices. Setup/install/config failures were not counted as RED.

- Initial Portfolio/Creator/Claim-review RED: three intended missing owners; setup/install green.
- Claim lifecycle/recovery RED head: `f8962cf9763b0a79c986f88e7d286aa4fc9c2396`
  - workflow: `31387478144`
  - three prior assertions PASS; four intended missing lifecycle/recovery assertions FAIL.
- Creator Claim UI integration RED head: `328ffbbd1f228db53d0ac82052824590ca7c4329`
  - workflow: `31387978659`
  - seven prior assertions PASS; two intended missing integration assertions FAIL.
- Portfolio value/responsive RED head: `6b06653b77a3e3698fd6cbc770510d0b7d8ce5f5`
  - workflow: `31388694354`
  - nine prior assertions PASS; one intended value/responsive assertion FAIL.
- Action-neutral shared-status RED head: `343eb73fc6b2f7d247b2c3b0011d2cc7dcf19602`
  - workflow: `31392696682`
  - ten prior assertions PASS; one intended stale-copy assertion FAIL.

## Exact-head implementation evidence

Final audited implementation head: `8e8ce7e35b081d4a0ae2d6b85ee35c30454629bc`

### Task 7 dedicated workflow

- Workflow: `31392816103` — PASS
- `tests/day7/claim-execution.test.ts`: 4 / 4 PASS
- `tests/day7/portfolio-creator.test.tsx`: 4 / 4 PASS
- `tests/day7/creator-claim-ui.test.tsx`: 3 / 3 PASS
- Total Task-7 assertions: **11 / 11 PASS**

### Root CI

- Root CI: `31392816136` — PASS
- repository/bootstrap validation: PASS
- full Day-6 suite: PASS
- shared-contract strict TypeScript check: PASS
- source-integrity/formatting: PASS
- root typecheck: PASS
- production build: PASS
- tracked-workspace clean-after-build check: PASS
- Foundry compile/generated-ABI/tests: PASS
- PostgreSQL/Redis infrastructure and Day-6 integration: PASS

### Exact-head retained workflows

- Day-7 Task 1: `31392816088` — PASS
- Day-7 Task 2: `31392816084` — PASS
- Day-7 Task 3 shared API types: `31392816062` — PASS
- Day-7 Task 4: `31392816149` — PASS
- Day-7 Task 5: `31392816139` — PASS
- Day-7 Task 6: `31392816166` — PASS
- Day-6 Task 5: `31392816143` — PASS
- Day-6 Task 6: `31392816104` — PASS
- Day-6 Task 7: `31392816049` — PASS
- Day-6 Task 8: `31392816125` — PASS
- Day-6 Task 9: `31392816150` — PASS
- Day-6 Task 10: `31392816060` — PASS

## Source / design / security audit verdict

PASS for the Task-7 scope.

Verified before merge:

- no `/v1` financial mutation route;
- no server transaction signing, relaying or custody;
- no private ABI/address/config authority in Portfolio/Creator/Claim code;
- generated FeeEscrow ABI + canonical ProtocolContext remain transaction construction authority;
- indexed Creator claimable is not used as signer authority;
- Claim amount is freshly reread onchain before simulation/signature;
- stale approved Claim review cannot reach wallet signing;
- Claim hash is persisted before receipt wait;
- onchain revert, replacement and temporary receipt-transport uncertainty remain distinct;
- reload recovery owns only Claim records for the connected recipient;
- existing Trade recovery remains BUY/SELL by default;
- unresolved Claim records remain duplicate-action locked;
- no API/server financial write authority was added;
- no PnL, average entry, movement, Creator active-launch count, buyback, market cap or launch-state value was fabricated;
- no per-card/per-launch primary RPC fanout was added;
- responsive Portfolio and Creator layouts follow the source-defined desktop/tablet/mobile direction;
- all existing release/mainnet blockers remain unchanged.

## External / release blockers — unchanged

The following retain their existing typed scope:

- `CURRENT_PONS_FACTORY_SOURCE_PARITY`
- `PONS_V2_RUNTIME_REFERENCE`
- `BREAD_PRODUCTION_ECONOMICS_CONFIG`
- `PONS_AUDIT_FINDINGS`
- `ARC_MAINNET_VALUES`

Task 7 does not claim exact-current Pons parity, finalized Bread production economics, completed Pons audits, Arc mainnet publication or canonical Arc DEX deployment.

## Next safe lane after durable merge

**Day 7 Task 8 — Wallet/network integration and recovery convergence.**

The committed Day-7 plan freezes Task 8 as follows:

- consume the validated network manifest/protocol context, wagmi/viem and the accepted Task-5 transaction controller;
- produce consistent disconnected/browse, connected, wrong-network and Switch-to-Arc states for all transaction surfaces;
- browsing remains available while disconnected or on the wrong network;
- transaction CTA becomes `Switch to Arc` on wrong network;
- supported injected/WalletConnect-compatible connector boundaries must not embed secrets;
- chain/address configuration comes only from canonical config manifests;
- wallet-specific integration is lazy enough not to dominate the initial route bundle;
- a connector is not called first-class merely because code exists; support must be evidenced.

Task 8 begins with a real RED wallet/network source-conformance test from the durable Task-7 handoff merge, not from PR #76 or this docs branch.

## Do not do

- Do not start Task 8 until this handoff is exact-head green, guarded-merged and actual `main` is freshly verified.
- Do not reopen accepted Day-6 or Day-7 Tasks 1–7 absent a demonstrated regression, genuine source conflict or newly ratified source change.
- Do not add a second wallet provider, transaction state machine, recovery store, query-key system, ABI/address/config authority or financial ledger.
- Do not make indexed/API data authoritative for Claim amounts or other financial signing decisions.
- Do not invent WalletConnect project credentials, wallet support claims, production economics/admin values, Arc mainnet values or canonical Arc DEX addresses.
- Do not route trades, launches or claims through a centralized Bread transaction server.
- Do not add per-card/component RPC fanout or raw-RPC primary UX.
- Do not fabricate unsupported Portfolio/Creator/Token financial fields.

## Durability condition

This handoff is complete only when:

1. `docs/current-build-state.yaml` advances additively from v1.43 to v1.44 without dropping accepted history;
2. the docs-only handoff head passes the required exact-head repository and retained gates;
3. the handoff PR is guarded-merged with expected-head protection;
4. actual merged `main`, this handoff and v1.44 are freshly read back;
5. only then may Task 8 branch from that durable `main`.
