# Bread UI/UX v2.2 Source-Backed Lane Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every remaining Bread UI/UX v2.2 software requirement that is already authorized by the ratified Project Sources and canonical repository interfaces, while leaving genuinely undefined semantics explicit rather than inventing them.

**Architecture:** Preserve the existing Day-6 indexed read/API authority and Day-7 web composition. Make only source-conformance presentation/test/integration changes in `apps/web`, reuse canonical indexed timestamps and existing safe token-initial fallbacks, and keep unresolved market-cap, Search Recent/Trending, lifecycle-threshold, sort, and media-storage semantics out of production code until authority exists.

**Tech Stack:** Next.js 16, React 19, TypeScript, TanStack Query, Vitest, Playwright, `@bread/ui`, Bread indexed API/types/repositories.

## Global Constraints

- Authority order is the ratified Bread Project Sources, then canonical repository interfaces; competitor behavior is not implementation authority.
- Do not touch `/tmp/bread-synthra-fork-proof`.
- Do not merge/close PR #94, create an RC tag, start Day 10, or waive `PHYSICAL_DEVICE_EXTERNAL_EXECUTION_REQUIRED`.
- Do not change protocol economics, custody/admin authority, canonical USDC, DEX semantics, transaction construction, or financial ledgers.
- Canonical creator identity is the launch deployer/onchain creator, never `creator_fee_recipient`.
- No per-card/result raw-RPC fanout.
- Unknown required display data renders `—`; do not fabricate zero or infer lifecycle/market data from unrelated fields.
- Every production slice follows source/interfaces -> RED -> intended failure -> minimum GREEN -> focused/adjacent regression -> type/build/static -> coherent commit -> exact-head workflow evidence.

---

### Task 1: Explore/Search source-conformance presentation closure

**Files:**
- Modify: `tests/day7/explore-search.test.ts`
- Modify: `apps/web/components/explore/model.ts`
- Modify: `apps/web/components/explore/explore-client.tsx`
- Modify: `apps/web/components/token-card.tsx`
- Modify: `apps/web/components/search-surface.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Consumes: `IndexedFeedItem.launchTimestamp`, response `FreshnessMeta.indexedThroughBlockTimestamp`, accepted Search `ageSeconds`/`holderCount`/`lifecycleState`, canonical deployer attribution.
- Produces: source-required TokenCard image/name-ticker-age/creator hierarchy and Search token rows that visibly include image, market cap, holders, age and lifecycle without inventing unavailable values.

- [ ] Add RED assertions proving TokenCard has a reserved 48px desktop / 52px mobile image fallback, indexed-head age display, and Search rows include an image fallback plus explicit Market cap/Age/Holders/Lifecycle fields with `—` fallbacks.
- [ ] Run `pnpm exec vitest run tests/day7/explore-search.test.ts tests/day7/search-freshness.test.ts` and confirm the new assertions fail only because those source-required presentation fields are absent.
- [ ] Extend `IndexedFeedCardFields` with `launchTimestamp`; add a pure indexed-age formatter using launch timestamp and `indexedThroughBlockTimestamp`, clamping negative/skewed age to zero and never reading browser wall clock.
- [ ] Pass the latest response `indexedThroughBlockTimestamp` into each `TokenCard`; render the existing safe initial-letter fallback in the source-defined image slot and put age beside ticker/identity.
- [ ] Render Search token rows with the same no-network initial fallback and explicit `Market cap —`, `Age <value-or-—>`, `Holders <value-or-—>`, and `Lifecycle <canonical-label-or-—>` while preserving exact-contract grouping, creator attribution, keyboard navigation, focus containment, and no raw RPC.
- [ ] Apply source-defined TokenCard image dimensions and retain existing typography/progress/reduced-motion rules. Do not add remote metadata-image fetching.
- [ ] Re-run focused tests, then the `day7-task3-explore-search` workflow on the exact code-bearing head.

---

### Task 2: Secondary-route/global-state verification ownership

**Files:**
- Modify: `.github/workflows/day7-task9-production-gates.yml`
- Test: `tests/day7/secondary-routes-v2.test.ts`

**Interfaces:**
- Consumes: already implemented `/activity`, `/stats`, `/docs`, legal, profile compatibility, 404 and error states.
- Produces: required secondary-route source-conformance test executed by an existing release-relevant workflow rather than remaining orphaned.

- [ ] Add `tests/day7/secondary-routes-v2.test.ts` to the fixed Vitest command in `day7-task9-production-gates.yml`.
- [ ] Run/observe the production-gates workflow on the exact head and repair only genuine source-backed regressions.
- [ ] Keep Activity/Stats/legal limited-source states truthful; do not invent aggregate projections or legal copy.

---

### Task 3: Token-page source-conformance audit and minimum fixes

**Files:**
- Modify only if a failing source-backed assertion requires it: `tests/day7/token-page-behavior.test.tsx`
- Modify only if required: `apps/web/components/token/token-identity.tsx`
- Modify only if required: `apps/web/components/token/token-stats.tsx`
- Modify only if required: `apps/web/components/token/token-chart.tsx`
- Modify only if required: `apps/web/app/globals.css`

**Interfaces:**
- Consumes: `IndexedTokenDetail`, canonical creator/deployer, token `launchTimestamp`, accepted market/holder/progress projections.
- Produces: Token page labels/hierarchy that match v2.2 where current data authority exists.

- [ ] Re-read the exact Token Detail source section against current components before adding any assertion.
- [ ] Add a RED only for unambiguous mismatches that do not require new financial or lifecycle semantics.
- [ ] Implement the minimum presentation fix; retain `—` for absent market cap/movement and retain truthful historical-chart unavailable state until a canonical time-series projection exists.
- [ ] Run `day7-task4-token-page`, `day7-task5-trade-lifecycle`, `day7-task8-wallet-network`, and affected production/security gates on the exact head.

---

### Task 4: Re-verify Create, Portfolio and Creator on the continuously integrated head

**Files:**
- No production modification unless an exact-head regression demonstrates one.
- Existing focused tests: `tests/day7/create-review.test.tsx`, `tests/day7/create-runtime.test.tsx`, `tests/day7/portfolio-creator.test.tsx`.

**Interfaces:**
- Consumes: staged Create/Review/Success, canonical economics reread, deployer attribution, indexed portfolio/creator values, FeeEscrow claim flow.
- Produces: exact-head evidence that later Lane-3/global changes did not regress those completed implementations.

- [ ] Run `day7-task6-create-launch` and `day7-task7-portfolio-creator` on the final code-bearing head.
- [ ] If a code regression appears, write/retain the focused failing test and make the smallest source-backed repair.
- [ ] Do not invent an image upload/storage provider, locked-buyback projection, per-launch outstanding claim allocation, PnL, watchlist data, or unavailable market metrics.

---

### Task 5: Unified exact-head software verification and blocker classification

**Files:**
- Modify code/tests only for demonstrated regressions.
- Update PR #94 body at the meaningful software-lane boundary; do not regenerate CURRENT-BUILD-STATE for small slices.

**Interfaces:**
- Consumes: final continuously integrated UI head.
- Produces: exact-head software verdict and a precise split between software-complete requirements, source/interface gaps, and external Day-9 release blockers.

- [ ] Confirm the exact branch/PR head SHA.
- [ ] Verify root `ci`, Explore/Search, Token page, Trade lifecycle, Create, Portfolio/Creator, wallet/network, production gates, frontend security, indexed/read/API affected workflows, primary Playwright, cross-browser/release matrix, rebuild/reconcile/recovery, and 10k hot-launch/capacity on that exact head.
- [ ] Inspect jobs/logs for every failed code gate and repair code failures only; distinguish provider/quota/external failures from product regressions.
- [ ] Keep the following blocked unless existing authority is discovered during execution: market-cap derivation/filter/sort/Search values; user-facing sort default/direction semantics; full New/Active/Almost-Baked lifecycle boundary semantics; Search Recent persistence/retention/removal behavior; Search Trending semantics; production token-image upload/storage/proxy contract; reliable global Activity/Stats aggregates; approved legal copy.
- [ ] Update PR #94 status text with exact accepted work and remaining blockers. Keep it draft/unmerged unless controlling release protocol explicitly permits otherwise.
- [ ] Do not declare Day 9 complete while physical/current-device evidence or other controlling release gates remain open.

## Plan Self-Review

- **Spec coverage:** The plan closes source-defined Explore/Search presentation gaps that can be implemented without inventing semantics, wires the orphan secondary-route test into release verification, audits Token presentation, re-verifies Create/Portfolio/Creator, and finishes with one exact-head integrated sweep.
- **Placeholder scan:** No implementation task contains TBD/TODO or delegates an undefined design decision to the implementer.
- **Type consistency:** Explore age uses existing `launchTimestamp` + `FreshnessMeta.indexedThroughBlockTimestamp`; Search keeps existing `ageSeconds`, `holderCount`, and canonical lifecycle projection; no new financial field/type is invented.
- **Scope:** Explicit source gaps remain blockers rather than becoming new formulas, persistence policies, ranking algorithms, lifecycle classifiers, storage providers, or legal claims.
