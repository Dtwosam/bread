# Bread Day 7 Task 2 — Indexed Read Boundary Durable Handoff

Status: `DAY7_TASK2_INDEXED_READ_BOUNDARY_INTEGRATED_PASS_DURABLE`

This document becomes the controlling durable Task-2 handoff when PR #62 is exact-head green and merged to `main`.

## Verified predecessor

- Task-1 durable handoff / Task-2 start baseline: `9e3699fc02973b599207328058992310b8e0bb86`
- Day 6 remains durably closed. Task 1 remains accepted and is not reopened.

## Task-2 implementation

- Implementation PR: #61
- Final exact implementation head: `9203af8c9f7f9cafd4a8027b91120af483ea62de`
- Guarded squash merge: `847f940ee6a451cf76fa15e43955d6a5fa40b19e`
- Durable handoff PR: #62
- Implementation branch: `agent/day7-task2-indexed-read-boundary`

Implemented from the accepted Day-6 API/type contract and Day-7 04D/06I constraints:

- canonical browser `/v1` GET client preserving `IndexedResponse<T>`, `FreshnessMeta` and page metadata;
- bounded feed/search/pagination validation before network work;
- canonical `ApiError` decoding into typed `BreadApiRequestError`;
- deterministic primitive TanStack Query keys for shared-request deduplication;
- one shared QueryClient with non-zero stale time, no automatic polling storm, no 4xx retry and at most one transient retry;
- explicit FRESH/LAGGING/REBUILDING/DEGRADED presentation using server-owned freshness status directly;
- public shell QueryClientProvider integration;
- explicit test guard forbidding viem/wagmi/raw-RPC primary reads in the indexed browser boundary.

## Meaningful RED evidence

- `31342822850`: install PASS; focused suite failed only because the canonical browser read modules did not exist.
- `31342948823`: all six already-implemented read-client tests remained PASS; only the new provider/freshness suite failed because those modules did not exist.

No syntax/config/setup failure was accepted as RED.

## Final exact-head implementation proof

Exact head: `9203af8c9f7f9cafd4a8027b91120af483ea62de`

- root CI `31343018880` — PASS
- Day-7 Task 1 `31343018867` — PASS
- Day-7 Task 2 `31343018874` — PASS
- retained Day-6 Task 5 `31343018887` — PASS
- retained Day-6 Task 6 `31343018864` — PASS
- retained Day-6 Task 7 `31343018888` — PASS
- retained Day-6 Task 8 `31343018873` — PASS
- retained Day-6 Task 9 `31343018885` — PASS
- retained Day-6 Task 10 `31343018862` — PASS

Root CI included repository validation, explicit Day-6 closeout validation, bootstrap regressions, full tests, the full Day-6 suite, strict shared types, source-integrity/format checks, TypeScript typecheck, production workspace build, clean-tree verification, Foundry compile/tests, generated ABI drift check, PostgreSQL/Redis health and Day-6 PostgreSQL integration.

## Source/design review

`DAY7_TASK2_SOURCE_DESIGN_REVIEW = PASS`

- no duplicate financial/protocol/domain payload authority;
- no API write methods, signing, transaction relay or custody;
- no raw-RPC primary UX or fallback;
- no frontend freshness thresholds competing with server `FreshnessStatus`;
- no fabricated Trending/Graduating/Graduated rows where Day-6 feed projection is unavailable;
- no Explore/Search page implementation before the read boundary;
- no new route, protocol semantic, economics value, production address or mainnet assumption.

## Canonical interfaces produced

Later Day-7 lanes consume:

- `createBreadApiClient` / `BreadApiRequestError` in `apps/web/lib/api/client.ts`;
- `breadQueryKeys` in `apps/web/lib/api/queries.ts`;
- `createBreadQueryClient` / `Providers` in `apps/web/components/providers.tsx`;
- `FreshnessBanner` / `freshnessPresentation` in `apps/web/components/freshness-banner.tsx`.

These are consumers of the accepted Day-6 read contract, not a new financial authority.

## Next safe action

Once PR #62 is present on `main`, begin **Day 7 Task 3 — Explore and Search** from the freshly verified latest `main` descendant.

Task 3 must use the real Task-2 indexed read boundary. Its first RED must prove the frozen Explore/Search behavior against actual Day-6 response shapes: New feed rendering, explicit not-ready handling for unsupported deterministic feed views, exact-address search from one character, text search only from two characters, visible contract identity for ambiguous/duplicate names, cursor preservation and zero per-card RPC.

Do not begin Token/Trade/Create work before the dependent Explore/Search lane is integrated according to the Day-7 plan.