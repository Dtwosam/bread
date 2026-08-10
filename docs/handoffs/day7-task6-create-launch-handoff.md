# Day 7 Task 6 — Create, Review, Launch and Launch+Buy — Durable Handoff

Date: 2026-08-10

## Verdict

`DAY7_TASK6_CREATE_REVIEW_LAUNCH_INTEGRATED_PASS_DURABLE`

This PR #75 candidate records the durable Task-6 verdict. It becomes authoritative only after this exact docs-only head passes its gates, is guarded-merged, and the resulting `main` plus `docs/current-build-state.yaml` are freshly read back.

## Accepted implementation baseline

- Pre-Task-6 durable baseline: `5b0eeada40fadef245a6c4f876e65584309856c4`
- Implementation PR: `#74`
- Final audited implementation head: `c2f7a66685ca3ae0965019596ef279fddaae40af`
- Guarded squash merge on `main`: `855dca0a84a11da5b8e16845705226f7777c4986`
- Implementation title: `feat(day7): integrate Create and launch lifecycle (#74)`

Fresh repository history after merge showed `855dca0a84a11da5b8e16845705226f7777c4986` as the current `main` commit before this handoff branch was created.

## Source contract consumed

Task 6 consumes the frozen Day-7 product/UI contract and the already-accepted Day-4/Day-5/Day-6/Task-5 protocol/runtime boundaries.

Controlling Task-6 rules preserved:

- Review is a screen/state inside `/create`; `/create/review` is not a route.
- Creator-editable fields are image, name, ticker, description, optional website/X/Telegram, creator tax, buyback choice and initial buy.
- Phantom reserve, tick spacing and other protocol-only parameters are not creator controls.
- Review displays actual prepared supply, quote, creator tax, buyback state, initial buy, launch fee, graduation target, creator revenue wallet and permanent-liquidity-lock behavior.
- Final action is exactly `Launch` or `Launch & Buy` from the prepared operation.
- User-signed writes go directly through the wallet/provider; the Bread API remains read-only.
- Chain state is the authority for launch/economics preparation and final confirmation.
- Submitted transactions remain recoverable across reload/replacement/temporary receipt transport loss; temporary connectivity loss is not treated as onchain failure.
- No production economics, Arc mainnet values, canonical DEX addresses or unsupported buyback/vesting behavior are guessed.

## What Task 6 integrated

### `/create` product flow

- Added the canonical `/create` page.
- Added the source-defined creator form and responsive 720px desktop form boundary.
- Added an in-route Review state with a 640px desktop review boundary and single-column mobile behavior.
- Added success state with confirmed token contract identity, `View token`, `Share on X`, `Copy link` and creator economics summary.
- Buyback is visible but disabled/unavailable because the accepted Bread stack does not yet contain a canonical buyback/vesting money path.
- Current unresolved Arc-testnet core deployment values keep Review/Launch fail-closed while form editing and browse behavior remain available.

### Canonical launch review and preparation

`packages/protocol-sdk/src/launch-review.ts` now:

- reads the current Factory launch configuration directly from chain;
- reads `previewLaunchEconomics` and binds the current economics digest;
- reads the current FeePolicy snapshot boundary;
- validates current launch enablement, supply, phantom quote, graduation threshold, launch fee, adapter/config hash, config version, protocol fee recipient, trade fee, protocol fee share and maximum creator tax;
- rejects creator tax above the canonical current maximum;
- prepares Launch with exact launch-fee USDC allowance;
- prepares Launch & Buy with exact `launchFeeUsdc + initialBuyQuoteIn` allowance;
- reuses the accepted Buy review estimator for initial-buy consequences with the same-call opening-tax exemption fixed to zero;
- keeps final chain simulation authoritative immediately before signature.

`prepareLaunch` / `prepareLaunchAndBuy` were extended additively; accepted prior consumers remain compatible.

### Shared transaction lifecycle

Task 6 extends, rather than duplicates, the Task-5 transaction lifecycle:

- transaction actions now include `LAUNCH` and `LAUNCH_AND_BUY`;
- launch records use a `launchIntentId` before a token address exists;
- global trade recovery remains scoped to BUY/SELL;
- Create recovery explicitly owns LAUNCH/LAUNCH_AND_BUY records;
- unresolved records preserve duplicate-action lockout and canonical replacement/UNKNOWN behavior.

Launch execution ordering is:

1. validate wallet identity and Arc chain;
2. reread current canonical launch/economics state before any allowance action;
3. stop and return the updated review if approved economics changed;
4. satisfy the exact prepared USDC allowance through the existing direct-wallet allowance owner;
5. reread canonical launch/economics state again;
6. stop and return the updated review if state changed after allowance;
7. simulate the exact prepared Factory call immediately before signature;
8. request the launch signature and send directly through the wallet/provider;
9. persist the transaction hash immediately;
10. wait for confirmation with replacement handling;
11. preserve `UNKNOWN` on temporary receipt transport loss rather than claiming failure;
12. decode the canonical Factory `LaunchCreated` event and use its token address for success/recovery navigation.

No independent launch transaction state machine, financial ledger or server write authority was introduced.

### Browser/runtime integration

- Reuses the one existing Wagmi/Trade runtime and wallet provider.
- Adds optional canonical `ProtocolContext` resolution from checked-in network/deployment manifests only.
- Does not synthesize unresolved deployment identity or addresses.
- Adds a four-line `packages/protocol-sdk/src/abi/generated.js` runtime-resolution bridge for NodeNext-authored `.js` imports and Next/Turbopack browser resolution. ABI data remains single-source in generated TypeScript; no ABI body is duplicated in the bridge.

## Important integration repair during review

An intermediate Task-6 branch revision had unintentionally modified `packages/protocol-sdk/src/events.ts` and changed accepted Day-6 event semantics. The retained Day-6 shared-contract regression exposed this drift.

The response was not to weaken the old tests. `events.ts` was restored byte-for-byte to the durable pre-Task-6 blob:

- canonical blob: `4955a44dd9b2f35d856a0694079081050719ec47`

The file therefore disappeared from the final PR #74 diff. Task 6 changes no accepted Day-6 event role, canonical-event, ignored-event, decoding or stack-mismatch semantics.

## Exact-head implementation evidence

Final audited implementation head: `c2f7a66685ca3ae0965019596ef279fddaae40af`

### Root CI

- Root CI: `31384216045` — PASS
- repository/source validation: PASS
- bootstrap tests: PASS
- full Day-6 suite: PASS
- shared-contract TypeScript check: PASS
- repository typecheck: PASS
- production Next build: PASS
- tracked-workspace clean-after-build check: PASS
- Foundry compile/generated-ABI check/tests: PASS
- PostgreSQL/Redis infrastructure integration: PASS

### Day-7 Task 6

- Dedicated Task-6 workflow: `31384216024` — PASS
- Task-6 Create/Launch suite: **28 / 28 PASS**
- Retained Day-7 Tasks 2–4 consumer suite inside the same Task-6 workflow: **31 / 31 PASS**

Retained Day-7 consumers proved on the same head:

- indexed read client/provider;
- Explore feed/search/freshness/shared DTO continuity;
- Token page contract and behavior.

### Other exact-head retained workflows

- Day-7 Task 1: `31384216160` — PASS
- Day-7 Task 5: `31384216033` — PASS
- Day-6 Task 5: `31384216059` — PASS
- Day-6 Task 6: `31384215935` — PASS
- Day-6 Task 7: `31384216028` — PASS
- Day-6 Task 8: `31384215976` — PASS
- Day-6 Task 9: `31384216003` — PASS
- Day-6 Task 10: `31384215977` — PASS

## Source / security audit verdict

PASS for the Task-6 scope.

Verified before merge:

- chain remains launch/economics authority;
- indexed/API reads do not authorize launch writes;
- no `/v1` financial mutation route was added;
- no server signing, relaying or custody authority was added;
- the existing wallet provider remains the only user-signing owner;
- no parallel pricing, fee, creator-tax, reserve, launch-economics or transaction-lifecycle authority was created;
- `expectedEconomics` is derived from the current canonical digest and the approved review is reread before allowance and again before simulation/signing;
- exact USDC allowance is used for Launch and Launch & Buy;
- transaction hash is persisted before confirmation waiting;
- replacement, onchain revert and transport-unknown states remain distinct;
- unresolved transactions remain duplicate-action locked;
- reload recovery uses the persisted shared transaction store;
- success token identity comes from canonical `LaunchCreated`, not predicted deployment order;
- current unresolved Arc-testnet deployment identity fails closed rather than borrowing fixtures;
- the ABI bridge contains no ABI data and does not change the accepted Day-6 event contract;
- no mainnet, DEX, production economics or unsupported buyback values were invented.

## External / release blockers — unchanged

The following remain active with their existing typed scope and are not bypassed by Task 6:

- `CURRENT_PONS_FACTORY_SOURCE_PARITY`
- `PONS_V2_RUNTIME_REFERENCE`
- `BREAD_PRODUCTION_ECONOMICS_CONFIG`
- `PONS_AUDIT_FINDINGS`
- `ARC_MAINNET_VALUES`

Task 6 does not claim exact-current Pons parity, finalized Bread production economics, completed Pons audits, Arc mainnet publication or canonical Arc DEX deployment.

## Next safe lane after durable merge

**Day 7 Task 7 — Portfolio, Creator dashboard and USDC claims.**

The committed Day-7 plan freezes the Task-7 interface:

- consume `/v1/portfolio/:address`;
- consume `/v1/creators/:address`;
- consume accepted `prepareClaim`;
- reuse the shared Task-5 transaction controller/lifecycle;
- produce wallet holdings/activity, creator revenue/claims and post-confirmation indexed refresh;
- disconnected screens request connection instead of inventing balances;
- PnL/average entry appear only when the API provides trustworthy cost basis;
- claim review shows exact claimable USDC and recipient before signature;
- claim is a direct wallet write;
- after confirmation, invalidate/refetch indexed creator data.

Task 7 must begin with a real RED source/consumer test from the durable Task-6 handoff merge, not from the Task-6 feature branch.

## Do not do

- Do not start Task 7 until this handoff is exact-head green, guarded-merged and actual `main` is freshly verified.
- Do not reopen accepted Day-6 or Day-7 Tasks 1–6 absent a demonstrated regression, genuine source conflict or newly ratified source change.
- Do not invent `/search` or `/create/review` routes.
- Do not activate current live Launch/Launch & Buy with guessed Factory/core deployment values.
- Do not infer creator claimable balances, portfolio values, PnL or cost basis when indexed/onchain evidence does not support them.
- Do not route claims/trades/launches through a centralized Bread transaction server.
- Do not create a second ABI/address/config, query-key, transaction-state, financial-math or claim-ledger authority.
- Do not infer production economics/authority values, Arc mainnet values or canonical Arc DEX addresses.

## Durability condition

This handoff is complete only when:

1. `docs/current-build-state.yaml` advances additively from v1.42 to v1.43 without dropping accepted history;
2. the docs-only handoff head passes the required exact-head repository/retained gates;
3. the handoff PR is guarded-merged with expected-head protection;
4. actual merged `main`, this handoff and v1.43 are freshly read back;
5. only then may Task 7 branch from that durable `main`.