# UI/UX v2.2 Remaining Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining source-authorized UI/UX v2.2 implementation gaps on PR #94 without inventing protocol, ranking, storage-provider, or financial semantics.

**Architecture:** Keep protocol/indexer state authoritative. Compute and expose derived market data centrally through existing indexed projections; make Search Recent browser-local only; source Trending Search from the canonical Trending feed; keep lifecycle display sourced from canonical indexed/protocol state and accepted feed classifications; make token media image-only through a provider-neutral backend boundary that validates, normalizes, resizes/caches, and stores only sanitized display metadata. Activity and Stats remain read-only indexed projections and may expose only fields the canonical database can derive reliably.

**Tech Stack:** TypeScript, Next.js, React, Fastify API, Drizzle/PostgreSQL, Bread indexer, Vitest, Playwright, GitHub Actions.

## Global Constraints

- Project Sources and canonical repository interfaces outrank implementation preference.
- Creator means canonical onchain deployer identity, never fee-recipient wallet.
- Trending is indexer-derived and never secretly paid; Trending Search must reuse canonical Trending feed membership rather than user-query frequency.
- Recent Search is device-local only: last 8 selected search targets, unique/newest-first, removable/clearable, no wallet/account sync.
- Token media is image-only; no video support.
- Token images/metadata are untrusted; no arbitrary HTML, javascript/data URL injection, or direct trust of arbitrary external media.
- Market-cap arithmetic is centralized and exact/fixed-point; no JavaScript floating-point money math.
- Frontend must not invent lifecycle thresholds. Protocol/indexer graduation state is authoritative; accepted New/Almost-Baked feed classification supplies those discovery labels.
- Do not change Solidity, protocol economics, custody, admin authority, canonical USDC identity, DEX semantics, transaction construction, or financial ledgers.
- Do not touch `/tmp/bread-synthra-fork-proof`.
- Do not merge/close PR #94, create an RC tag, begin Day 10, fabricate physical-device evidence, or claim Day-9 PASS.

---

### Task 1: Reconcile stale Playwright expectations

**Files:**
- Modify: `apps/web/e2e/specs/create-launch.spec.ts`
- Modify: `apps/web/e2e/specs/search-holder.spec.ts`
- Modify: `apps/web/e2e/specs/search-lifecycle.spec.ts`
- Test: the same Playwright specs plus `.github/workflows/day7-task10-playwright-closeout.yml`

**Interfaces:**
- Consumes: current staged Create flow (`Token -> Economics -> Review -> Success`) and current Search result presentation.
- Produces: browser tests that assert the ratified behavior rather than stale pre-stepper/pre-label copy.

- [ ] **Step 1: Confirm root cause from current failing run**

Verify the failing selectors are stale expectations: Create waits for `Creator tax` while still on Token; Search expects old unlabeled holder/lifecycle text.

- [ ] **Step 2: Change only the tests first and run targeted browser RED/GREEN appropriately**

Update Create helper to advance from Token to Economics before filling economic inputs. Update Search assertions to target the current explicit field presentation without weakening identity/lifecycle guarantees.

- [ ] **Step 3: Run targeted Playwright specs**

Run the three affected specs on desktop and mobile Chromium. Expected: PASS with no product-code changes.

- [ ] **Step 4: Commit**

`git commit -m "test(ui): reconcile browser closeout with v2.2 flows"`

---

### Task 2: Canonical market-cap projection and Explore sort/filter

**Files:**
- Modify only the existing owning indexer/repository/API/type files discovered from current branch.
- Test: focused indexer/repository/API/Explore tests discovered from current branch.

**Interfaces:**
- Consumes: canonical indexed current price representation and immutable/fixed token supply already projected by launch/token state.
- Produces: one canonical indexed `marketCap` value used by API, Explore, Search, Token, Creator, filter, and sort consumers.

- [ ] **Step 1: Trace existing price and supply units**

Identify the exact integer/fixed-point units used by `token_metrics.price`, price numerator/denominator, token decimals/supply, and API monetary strings. Do not infer units from UI formatting.

- [ ] **Step 2: Write failing projection tests**

Add tests proving market cap equals canonical current indexed price multiplied by canonical fixed total supply using integer/rational arithmetic and existing unit conventions, including a non-integer-price case that would fail with floating-point math.

- [ ] **Step 3: Run RED**

Expected: tests fail because canonical market-cap projection is absent/unpopulated.

- [ ] **Step 4: Implement minimal central projection**

Populate `token_metrics.market_cap` from the existing authoritative price/supply values in the owning projection path. Reuse that field everywhere; do not recompute it independently in React.

- [ ] **Step 5: Add failing Explore sort/filter API tests**

Cover market-cap min/max and sort-by-market-cap using the canonical indexed field and deterministic existing cursor/tie-break patterns.

- [ ] **Step 6: Implement minimal repository/API/UI wiring**

Expose the already-projected field through current types and Explore query controls. Preserve Trending as a feed, not a sort formula.

- [ ] **Step 7: Run focused + adjacent GREEN**

Run indexer projection, API types/routes, Explore/Search, Token/Creator regressions, typecheck and build.

- [ ] **Step 8: Commit**

`git commit -m "feat(indexer): project canonical token market cap"`

---

### Task 3: Canonical lifecycle classification wiring

**Files:**
- Modify only existing lifecycle/feed projection, API type/route, Explore/Search display/filter files identified from current branch.
- Test: lifecycle, Almost-Baked feed, graduation, Explore/Search tests.

**Interfaces:**
- Consumes: actual indexed graduation state plus accepted New and Almost-Baked feed classification.
- Produces: source-defined discovery/display labels without a frontend percentage or age threshold.

- [ ] **Step 1: Write failing precedence/classification tests**

Prove protocol terminal/in-progress states outrank discovery labels; Almost Baked outranks New when both feed predicates can overlap; otherwise New outranks ordinary Active. `Graduation pending` remains distinct where the detailed display surface supports it.

- [ ] **Step 2: Run RED**

Expected: fail only where current Explore/Search classification is incomplete or ambiguous.

- [ ] **Step 3: Implement minimal canonical mapper**

Use indexed graduation state first, accepted Almost-Baked membership second, accepted New membership third, and Active fallback. No numeric lifecycle threshold is introduced.

- [ ] **Step 4: Wire lifecycle filter/search result labels**

Expose New / Active / Almost Baked / Processing / Graduated filter behavior from canonical state; preserve detailed `Graduating` / `Graduation pending` / `Graduated` presentation where required by v2.2.

- [ ] **Step 5: Run focused + adjacent GREEN and commit**

`git commit -m "feat(ui): consume canonical lifecycle classification"`

---

### Task 4: Recent Search and Trending Search

**Files:**
- Modify: current Search overlay/component and its focused tests.
- Reuse: canonical `/v1/feed` Trending query path.
- Test: Search unit/browser specs.

**Interfaces:**
- Consumes: selected Search token/creator targets and canonical Trending feed results.
- Produces: browser-local recent history and activity-derived trending suggestions.

- [ ] **Step 1: Write failing Recent Search tests**

Assert last 8 selected targets, normalized identity dedupe, newest-first ordering, removal, clear-all, malformed-storage recovery, and no wallet/account keying.

- [ ] **Step 2: Run RED**

Expected: fail because Recent Search persistence is absent.

- [ ] **Step 3: Implement minimal browser-local history helper**

Use one versioned local-storage key, bounded to 8 entries. Store only the display/route identity necessary to render and revisit the selected target. Do not send recent history to the API.

- [ ] **Step 4: Write failing Trending Search tests**

Assert Search Trending suggestions are fetched from/reuse the canonical Trending feed and never ranked from typed query telemetry or paid placement.

- [ ] **Step 5: Implement minimal Trending Search wiring**

Reuse the existing feed client/query and display a bounded set of canonical Trending token suggestions when appropriate in Search.

- [ ] **Step 6: Run focused + browser GREEN and commit**

`git commit -m "feat(search): add local recents and indexed trending suggestions"`

---

### Task 5: Image-only token media boundary

**Files:**
- Modify only current Create metadata form/API/indexer-metadata/media helpers discovered from the branch.
- Add a provider-neutral backend media interface only if no such interface already exists.
- Test: Create, metadata security, image failure-injection, CSP/security tests.

**Interfaces:**
- Consumes: creator-selected image file.
- Produces: sanitized canonical image reference/variants suitable for card/detail rendering; no video.

- [ ] **Step 1: Trace existing metadata and deployment/storage capabilities**

Reuse an existing object-storage/media service if present. If no configured persistent object-storage implementation exists, implement the provider-neutral interface and local/test adapter only; keep public production enablement gated on configured persistent storage rather than inventing a vendor credential contract.

- [ ] **Step 2: Write failing validation/security tests**

Cover image-only MIME/content acceptance, rejection of video and non-image payloads, bounded size/dimensions using the project’s existing configured limits if any, dangerous URL/data/javascript rejection, malformed image bytes, and fallback behavior.

- [ ] **Step 3: Run RED**

Expected: fail for absent image-upload boundary or unsafe current path.

- [ ] **Step 4: Implement minimal image-only backend boundary**

Decode/validate image content, normalize/resize card/detail variants, generate a sanitized stored reference, persist display metadata separately from finance state, and preserve fixed layout dimensions. Do not accept arbitrary HTML or video.

- [ ] **Step 5: Wire Create and token/search/card rendering**

Create uploads an image before launch metadata submission; consumers render only sanitized media references with placeholder fallback.

- [ ] **Step 6: Run security/performance/Create GREEN and commit**

`git commit -m "feat(media): add image-only token media pipeline"`

---

### Task 6: Indexed Activity and Stats projections

**Files:**
- Modify current API route/repository/type files and `apps/web/app/activity/page.tsx`, `apps/web/app/stats/page.tsx`.
- Test: focused secondary-route/API/indexer tests.

**Interfaces:**
- Consumes: append-only launches, trades, graduation events/state and canonical indexed quote amounts.
- Produces: read-only Activity rows and reliable aggregate Stats only.

- [ ] **Step 1: Write failing API/repository tests**

Activity must return newest canonical launches, trades, and graduation transitions with stable event identity and deterministic ordering. Stats must return only aggregates directly derivable from canonical indexed tables: launch count, trade count, graduation count, and quote volume over explicitly supported periods.

- [ ] **Step 2: Run RED**

Expected: fail because global Activity/Stats projections are absent.

- [ ] **Step 3: Implement bounded read models**

Use cursor/bounded queries and exact integer quote-volume aggregation. Do not add users, TVL, PnL, active-trader counts, success rates, or inferred metrics.

- [ ] **Step 4: Wire web routes with degraded/empty states**

Use existing ActivityRow/panel primitives where present. Clearly label the actual aggregation period.

- [ ] **Step 5: Run focused + adjacent GREEN and commit**

`git commit -m "feat(api): add indexed activity and stats reads"`

---

### Task 7: Integrated lane closure and exact-head verification

**Files:**
- Update: `docs/current-build-state.yaml` only at the meaningful lane/final-software boundary required by 06H.
- Update PR #94 body with exact evidence; keep draft/open/unmerged.

**Interfaces:**
- Consumes: Tasks 1-6.
- Produces: unified software-candidate evidence with unresolved external/legal gates stated truthfully.

- [ ] **Step 1: Run focused suites**

Run Explore/Search, Token, Create, Portfolio/Creator, secondary routes, frontend security, production gates, recovery and relevant API/indexer suites.

- [ ] **Step 2: Run full root CI/build/type/lint and browser closeout**

Require exact-head success. Inspect any failure by root cause before modifying code.

- [ ] **Step 3: Run source-diff/self-review**

Confirm no floating-point money math, no private lifecycle thresholds, no query-frequency Trending, no video, no arbitrary external-media trust, no creator/fee-recipient regression, and no protocol/economic changes.

- [ ] **Step 4: Synchronize meaningful continuity state**

Record completed software lanes and exact-head CI evidence while retaining `PHYSICAL_DEVICE_EXTERNAL_EXECUTION_REQUIRED`, legal-copy/operator-detail dependencies, mainnet/economics/audit gates, PR draft state, and Day-9 incomplete verdict.

- [ ] **Step 5: Update PR #94 and stop before release-only external gates**

Do not merge, close, tag RC, or claim Day-9 PASS.
