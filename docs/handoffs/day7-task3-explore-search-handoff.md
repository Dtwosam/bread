# Bread Day 7 Task 3 — Explore + Search Durable Handoff

Status: `EXPLORE_SEARCH_INTEGRATED_PASS_DURABLE`

This document becomes the controlling durable Task-3 handoff when this docs-only handoff PR is exact-head green, guarded-merged to `main`, and actual `main` is reverified.

## Verified predecessor

- Task-2 durable handoff / Task-3 start baseline: `41a5218da254590521c9c724b4e2e88fb2c85b19`
- Day 6 remains durably closed. Day-7 Tasks 1-2 remain accepted and are not reopened.

## Continuity reconciliation performed before closeout

The rollover continuation expected Task 3 to have already merged at `6dd574deab3aa67d760e5f10b7f739678bef0533` with a durable handoff at `f5b422cc1dba11fcf09427a71b08b6e95bb66803`. Fresh GitHub verification proved those commits were not present: actual `main` was still the Task-2 handoff `41a5218da254590521c9c724b4e2e88fb2c85b19`, PR #63 was still draft/open, PR #64 did not exist, and `docs/current-build-state.yaml` remained v1.38 with Task 3 active.

The continuation therefore failed closed, inspected the unfinished PR and real Actions failures, repaired the actual Task-3 branch, re-ran the retained exact-head matrix, and only then guarded-merged PR #63.

## Task-3 implementation

- Implementation PR: #63
- Implementation branch: `agent/day7-task3-explore-search`
- Final exact implementation head: `96e4e567fe1726d547ab5d623a0fbb00ee8bf658`
- Guarded squash merge: `3e8563c445781f9e629b2b55dc23bae0ec034c11`
- Durable handoff branch: `docs/day7-task3-explore-search-handoff`

Implemented against the accepted Task-2 browser read boundary and 04A-04D source hierarchy:

- root `/` and `/explore` render the real indexed Explore surface;
- Explore views remain `New`, `Trending`, `Near Graduation`, and `Graduated` using the frozen query-param model;
- `New` consumes real `/v1/feed` cursor pagination through the canonical Task-2 client/query keys;
- unsupported deterministic feed views remain explicit `FEED_VIEW_NOT_READY` instead of fabricated ranking data;
- the existing batched feed metric load now exposes canonical indexed graduation progress without per-card token-detail requests;
- `packages/types` owns shared `IndexedPriceSummary`, `IndexedTradeMetricsSummary`, `IndexedGraduationProgressSummary`, `IndexedFeedItem`, and `IndexedSearchResult` DTOs;
- TokenCard renders only accepted indexed financial fields: exact indexed price ratio, accepted 24h quote volume, indexed graduation progress, and explicit `—` for unavailable 24h change;
- Search remains a desktop overlay / full-height mobile surface, never a `/search` route;
- exact contract-address search activates immediately, ordinary text waits for two characters, malformed address-like input fails locally, and search results preserve contract identity for disambiguation;
- Explore and Search both surface server-owned `FreshnessMeta` through the shared `FreshnessBanner`;
- no viem/wagmi/raw-RPC primary read path, second query-key authority, browser-side financial formula, transaction authority, or per-card request fanout was introduced.

## Meaningful RED / recovery evidence

Task 3 had genuine runner-proven missing behavior before final GREEN:

1. Shared API DTO continuity failed in real runner execution because `tests/day7/explore-shared-types.test.ts` required canonical shared DTOs that had not actually been added to `packages/types`.
2. Root CI reached the production Next build and failed because Explore used BigInt literal syntax incompatible with the web compiler target. Validation, bootstrap tests, the complete Day-6 suite, formatting and root typecheck had already passed before that build failure. The repair changed only the literal syntax to `BigInt(...)` constructors.
3. `tests/day7/search-freshness.test.ts` existed but was not wired into the dedicated Task-3 workflow; the final implementation both satisfies the Search freshness contract and executes that test in the Task-3 proof workflow.

No setup/configuration-only failure or zero-step/skipped-only run was accepted as proof.

## Final exact-head implementation proof

Exact head: `96e4e567fe1726d547ab5d623a0fbb00ee8bf658`

- root CI `31346160670` — PASS
- Day-7 Task 1 `31346160665` — PASS
- Day-7 Task 2 `31346160660` — PASS
- Day-7 Task 3 Explore/Search `31346160672` — PASS
- Day-7 Task 3 shared API types `31346160669` — PASS
- retained Day-6 Task 5 `31346160662` — PASS
- retained Day-6 Task 6 `31346160701` — PASS
- retained Day-6 Task 7 `31346160666` — PASS
- retained Day-6 Task 8 `31346160661` — PASS
- retained Day-6 Task 9 `31346160675` — PASS
- retained Day-6 Task 10 `31346160667` — PASS

Real job-step inspection confirmed the dedicated Task-3 workflows performed checkout, toolchain setup, frozen-lockfile install and their actual Vitest suites. Root CI performed repository validation, bootstrap regressions, the full Day-6 suite, strict shared types, formatting/source checks, TypeScript typecheck, production workspace build, clean-tree verification, Foundry build/tests, ABI drift check and PostgreSQL/Redis integration.

## Source/design continuity review

`DAY7_TASK3_SOURCE_DESIGN_CONTINUITY_REVIEW_PASS`

Verified on the exact implementation head:

- no `/search` route;
- no `/create/review` route;
- `packages/db/src/repositories/read.ts` changes by exactly one additive `graduationProgressBps` normalization line;
- shared API DTO authority is additive and consumed by web code rather than duplicated privately;
- no viem/wagmi/raw-RPC primary web reads;
- no per-card token-detail fetch fanout;
- unsupported feed views remain `FEED_VIEW_NOT_READY`;
- graduation progress uses the existing batched indexed metrics lookup;
- 24h price change remains explicitly unavailable;
- Search and Explore display server-owned freshness/degraded state;
- production build leaves tracked workspace clean;
- no protocol/economic semantics, ABI/address authority, production/mainnet values or user-transaction authority changed.

## Canonical interfaces Task 4 inherits

Task 4 must consume, not duplicate:

- shared API contracts from `packages/types/src/api.ts` and `packages/types/src/index.ts`;
- `createBreadApiClient` / `BreadApiRequestError` from `apps/web/lib/api/client.ts`;
- `breadQueryKeys` from `apps/web/lib/api/queries.ts`;
- shared QueryClient ownership from `apps/web/components/providers.tsx`;
- `FreshnessBanner` from `apps/web/components/freshness-banner.tsx`;
- canonical `serializeGraduationProgress` from `apps/api/src/routes/token.ts`;
- accepted Task-3 source-truth formatting semantics from `apps/web/components/explore/model.ts` and `apps/web/components/token-card.tsx`.

## Next safe action

After this docs-only handoff is exact-head green, guarded-merged and actual `main` is freshly verified, begin **Day 7 Task 4 — Token page** from that exact durable baseline.

The first Task-4 RED must establish the real missing `/token/:address` consumer contract against accepted Day-6/Task-3 APIs and shared types. It must distinguish malformed addresses from valid-looking non-Bread tokens, use `GET /v1/tokens/:address` as the primary server-owned indexed read, render server freshness, consume canonical graduation state/progress, and keep trades/holders/chart secondary/lazy. If a legitimate projection or DTO is missing, extend its canonical owner additively rather than creating private web truth. No chart history, USD price, market cap, price change, holder percentage, supply value, fee value or other financial datum may be fabricated.

Do not begin Trade/Create/Portfolio/Creator implementation ahead of this Token-page lane.