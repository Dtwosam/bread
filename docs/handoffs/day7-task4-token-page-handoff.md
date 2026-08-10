# Bread Day 7 Task 4 — Token Page Durable Handoff

Status: `TOKEN_PAGE_INTEGRATED_PASS_DURABLE`

This document becomes the controlling durable Task-4 handoff only after this docs-only handoff PR is exact-head green, guarded-merged to `main`, and actual `main` is freshly reverified.

## Verified predecessor

- Task-3 durable handoff / Task-4 start baseline: `c973c454435c946b3586990c2cc49542a20a38af`
- Day 6 remains durably closed.
- Day-7 Tasks 1-3 remain accepted and are not reopened.

## Task-4 implementation identity

- Implementation PR: #65
- Implementation branch: `agent/day7-task4-token-page`
- Final exact implementation head: `8e06a54157e248340deb0669a22967e4fcfce1bc`
- Guarded squash merge: `4ee0dc4654f5404133910b3e15ca1d6e29727ebb`
- Durable handoff branch: `docs/day7-task4-token-page-handoff`

## RED -> GREEN history

### RED 1 — canonical Token consumer contract

- Head: `6c6c6480e296eb0ceb594dcb183452420020750b`
- Dedicated runner: `31346842137`
- Runner setup/install succeeded and Vitest executed.
- The already-accepted malformed-address vs valid non-Bread distinction passed.
- The intended missing contracts failed: Token detail graduation projection, shared Token detail/trade/holder DTO authority, and `/token/[address]` route.

### GREEN 1 — canonical owning-layer projection

Task 4 extended existing accepted owners rather than patching around them in the page:

- `packages/types` now owns shared `IndexedCurveStateSummary`, `IndexedTokenDetail`, `IndexedTokenTrade`, `IndexedTokenHolder`, and `IndexedTokenHolders` DTOs.
- `GET /v1/tokens/:address` now additively exposes already-indexed graduation progress plus existing phase/pool/adapter/lock evidence.
- The route still uses the already-existing launch-state + token-metrics loads; no additional DB/RPC read fanout was introduced.
- The frozen `/token/[address]` route was established.
- Integrated contract GREEN head: `04b69ec0f2f5157b46ed463e553d1d002abc3b04`.
- Root CI `31347055929` PASS with validation, tests, typecheck, production build, clean-tree check, Foundry and PostgreSQL/Redis integration.

### RED 2 — frozen Token-page behavior

- Head: `5183889adeec4e56e5297f3e62dfd43c135c0ac3`
- Dedicated runner: `31347142975`
- Existing consumer-contract tests stayed green.
- Seven new failures corresponded only to absent source-defined Token components/behavior: primary indexed page state, exact identity, lazy Trades/Holders, truthful chart fallback, graduation presentation, and responsive composition.

### RED 3 — source/design continuity repair

The source/design audit caught two gaps before merge: the 04C tablet trade-sheet composition and source-defined Info facts that had no canonical projected value.

- Head: `26939302d4b9944a9816f66be44f23755e54446f`
- Dedicated runner: `31347563493`
- Eleven prior assertions remained PASS.
- Exactly the tablet composition and explicit Info placeholders failed.

The final GREEN adds the tablet-only presentation sheet with disabled transaction controls and explicit unavailable Info facts. It does not start the Task-5 transaction lane early.

## Accepted Token-page behavior

The canonical `/token/:address` page now:

- uses one canonical indexed primary read through the Task-2 browser client and `breadQueryKeys.token`;
- keeps malformed addresses distinct from valid-looking addresses that are not Bread launches;
- renders server-owned `FreshnessMeta` through `FreshnessBanner`;
- keeps exact/full token contract identity visible and uses canonical creator identity when projected;
- renders accepted indexed price ratio, accepted 24h quote volume, creator-tax basis points, and graduation evidence;
- leaves unsupported market cap, 24h price change, primary holder count, description, social links and buyback as explicit `—` rather than inventing values;
- exposes canonical indexed graduation progress/state, phase, adapter, pool and permanent-lock evidence without browser-side protocol recomputation;
- code-splits chart and secondary tab surfaces;
- renders an explicit `Historical chart unavailable` region because the accepted public API currently exposes no canonical historical price-series endpoint for this page;
- does not synthesize candles, price history or change values from unrelated metrics;
- reads Trades and Holders only through accepted `/v1` routes and canonical query keys, with active-tab query enablement;
- displays server freshness on secondary indexed responses;
- uses source-defined desktop 360px sticky trade slot, tablet trade-sheet trigger, mobile content order, long-identity wrapping, 44px tab/row targets and persistent mobile Buy/Sell bar;
- keeps desktop/tablet/mobile Buy/Sell controls disabled because wallet/provider transaction execution belongs to Task 5.

## Shared interfaces Task 5 inherits

Task 5 must consume, not duplicate:

- `IndexedTokenDetail`, `IndexedTokenTrade`, `IndexedTokenHolders` and related shared API DTOs from `packages/types`;
- `createBreadApiClient`, `BreadApiRequestError`, and canonical Task-2 query keys;
- server-owned `FreshnessMeta` / `FreshnessBanner` behavior;
- the canonical Token-page composition in `apps/web/components/token/token-client.tsx`;
- the existing desktop `.bread-token-trade-slot`, tablet `.bread-token-tablet-trade-trigger` / `.bread-token-tablet-trade-sheet`, and mobile `.bread-token-mobile-actions` presentation slots;
- the accepted disabled-state boundary: Task 4 contains no wallet signing, transaction preparation, simulation, submission, recovery or `/v1` mutation logic.

Task 5 should replace the non-authoritative trade placeholders with the accepted prepared-transaction/wallet lifecycle rather than creating a second Token page or financial-math authority.

## Exact-head implementation proof

Exact implementation head: `8e06a54157e248340deb0669a22967e4fcfce1bc`

All real-step PASS:

- root CI `31347693829`
- Day-7 Task 1 `31347693843`
- Day-7 Task 2 `31347693836`
- Day-7 Task 3 Explore/Search `31347693820`
- Day-7 Task 3 shared API types `31347693849`
- Day-7 Task 4 Token page `31347693845`
- retained Day-6 Task 5 `31347693858`
- retained Day-6 Task 6 `31347693838`
- retained Day-6 Task 7 `31347693846`
- retained Day-6 Task 8 `31347693851`
- retained Day-6 Task 9 `31347693828`
- retained Day-6 Task 10 `31347693830`

Root job-step inspection confirmed repository/build-state validation, bootstrap tests, full Day-6 regression suite, shared-type compile, source/format checks, TypeScript typecheck, production workspace build, clean-tree verification, Foundry build/tests + ABI drift check, and PostgreSQL/Redis integration.

## Source/design continuity review

`DAY7_TASK4_TOKEN_PAGE_SOURCE_DESIGN_CONTINUITY_REVIEW_PASS`

Verified on the final implementation head:

- frozen route remains `/token/:address`;
- no `/search` route and no `/create/review` route was added;
- primary rendering remains indexed/API-first and does not wait on chart/holder analytics;
- no viem/wagmi/raw-RPC primary Token read path;
- no duplicate token-detail query authority;
- token API changes are additive and reuse the existing state/metrics reads;
- shared API type changes are additive and consumed by the web page;
- no fabricated historical chart, USD price, market cap, price change, holder percentage, supply, fee value or other unsupported finance;
- no centralized trade server, server signing/relaying, private-key custody or user-transaction execution was introduced;
- no production economics, Arc mainnet value, ABI/address authority or financial formula changed;
- all five production/release blockers remain unchanged.

## Next safe action

After this docs-only handoff is exact-head green, guarded-merged, and actual `main` is reverified, begin **Day 7 Task 5 — Trade preparation, wallet lifecycle and transaction recovery** from that exact durable baseline.

Task 5 starts with RED state-machine and trade-surface tests against the accepted protocol SDK transaction builders/simulation/error decoding and the canonical Token-page trade slots. User writes remain direct wallet/provider -> Arc. No `/v1` mutation route, server signing, relay, private-key custody, UI-derived financial authority or guessed production value may be introduced.

The separate route-correction authority remains active for later Create work: Search remains an overlay and Review remains state inside `/create`; do not reintroduce `/search` or `/create/review` from stale planning text.