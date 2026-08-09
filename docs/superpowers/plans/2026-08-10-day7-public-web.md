# Day 7 Public Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Bread’s frozen 04A–04D public web as a real consumer of the accepted Day-6 SDK/API/indexer stack, with responsive/mobile transaction UX, truthful degraded states, direct wallet writes, recovery, accessibility and primary Playwright journeys.

**Architecture:** Keep `apps/web` as the Next.js public product, `packages/ui` as the framework-light reusable UI/design-system layer, `packages/protocol-sdk` as the only source for ABI/address/transaction construction, and the Day-6 `/v1` API as the primary read surface. Read data is fetched through one deduplicated client/query boundary carrying `FreshnessMeta`; transaction preparation uses canonical SDK builders and selective chain simulation immediately before signing. The browser never becomes a second financial authority and never routes user trades through a Bread server.

**Tech Stack:** Next.js 16.2.12, React 19.2.8, TypeScript 7.0.2, wagmi 3.7.1, viem 2.55.8, TanStack Query 5.101.4, Vitest 4.1.10, Playwright, CSS custom properties, `@bread/ui`, `@bread/protocol-sdk`, `@bread/types`.

## Global Constraints

- Baseline: `9c9012db9f2fe607edc6e668a2fa19d34f925e87` (`DAY6_DURABLE_CLOSEOUT = PASS`).
- 04A–04D are frozen product/UI authority. No new routes, flows, transaction semantics, economics, wallet authority, visual language or post-beta social features.
- Dark-first/dark-only beta. Use exact 04B semantic colors, spacing, radii, breakpoints, typography hierarchy and restrained motion.
- Desktop shell: 64px sticky header, 32px gutters, max width 1440px. Tablet: 24px gutters. Mobile: 56px top bar + 64px bottom nav + safe area, 16px gutters.
- Public reads use Day-6 indexed API/cache. No per-card RPC fanout and no raw-RPC primary UX.
- Secondary token tabs fetch lazily; repeated client reads are deduplicated through TanStack Query.
- User writes go directly through wallet/provider to Arc using `@bread/protocol-sdk`; Bread API remains read-only.
- Transaction lifecycle: idle -> validating input -> preparing transaction -> awaiting wallet signature -> submitted (persist tx hash) -> confirming -> confirmed, with rejected/reverted/replaced/timed-out-or-unknown recovery states.
- Before signing, show expected/minimum output, base fee, creator tax, opening tax when active, price impact and slippage from canonical quote/preparation data. UI math is never protocol authority.
- Every major screen covers loading, ready, empty and error. Transaction screens additionally cover disconnected, wrong-network, preparing, awaiting-signature, submitted, confirming, confirmed and failed states.
- 04D accessibility/performance requirements are implementation gates: WCAG 2.2 AA target, keyboard access, visible focus, live transaction announcements, reduced motion, truthful delayed-data state, small initial bundle and progressive/lazy secondary analytics.
- Existing release/mainnet blockers remain active. No production economics/admin/Arc-mainnet/DEX values may be guessed.

---

### Task 1: Design tokens, reusable UI foundation and global application shell

**Files:**
- Modify: `packages/ui/package.json`
- Modify: `packages/ui/tsconfig.json`
- Replace: `packages/ui/src/index.ts`
- Create: `packages/ui/src/theme.ts`
- Create: `packages/ui/src/theme.css`
- Create: `packages/ui/src/button.tsx`
- Create: `packages/ui/src/card.tsx`
- Create: `packages/ui/src/navigation.tsx`
- Create: `packages/ui/src/states.tsx`
- Modify: `apps/web/package.json`
- Modify: `apps/web/app/layout.tsx`
- Create: `apps/web/app/globals.css`
- Replace: `apps/web/app/page.tsx`
- Create: `tests/day7/ui-foundation.test.tsx`
- Modify: `package.json`

**Interfaces:**
- Consumes: frozen 04B color/typography/spacing/radius/breakpoint/motion values and 04A/04C global navigation.
- Produces: `breadTheme`, `Button`, `Card`, `Navigation`, `MobileNavigation`, `Skeleton`, `EmptyState`, `ErrorState`, reusable CSS variables and the responsive Bread shell consumed by every later page.

- [ ] **Step 1: Write the failing foundation test**

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { breadTheme, Button, Navigation, MobileNavigation } from '../../packages/ui/src/index';

it('freezes the controlling 04B semantic token values', () => {
  expect(breadTheme.colors).toMatchObject({
    bgPrimary: '#0A0B0D',
    surface1: '#13161B',
    borderSubtle: '#242A33',
    textPrimary: '#F5F7FA',
    accent: '#4C8DFF',
    positive: '#32D583',
    negative: '#F97066',
    warning: '#FDB022',
  });
  expect(breadTheme.layout.maxWidth).toBe(1440);
  expect(breadTheme.layout.desktopTradePanel).toBe(360);
  expect(breadTheme.breakpoints.mobileMax).toBe(767);
});

it('renders source-defined public navigation and accessible button state', () => {
  const desktop = renderToStaticMarkup(<Navigation />);
  const mobile = renderToStaticMarkup(<MobileNavigation />);
  expect(desktop).toContain('Explore');
  expect(desktop).toContain('Graduating');
  expect(desktop).toContain('Portfolio');
  expect(desktop).toContain('Create');
  expect(mobile).toContain('Explore');
  expect(mobile).toContain('Trending');
  expect(mobile).toContain('Create');
  expect(mobile).toContain('Portfolio');
  expect(renderToStaticMarkup(<Button loading>Confirm</Button>)).toContain('Confirming');
});
```

- [ ] **Step 2: Run the focused test and verify intended RED**

Run: `pnpm exec vitest run tests/day7/ui-foundation.test.tsx`

Expected: FAIL because `breadTheme` and the Day-7 UI components are absent and `UI_STATUS` still reports `design-system-not-started`.

- [ ] **Step 3: Implement the exact 04B token registry, CSS variables and first reusable primitives**

`breadTheme` must expose the source-defined semantic colors, spacing scale `0,4,8,12,16,20,24,32,40,48,64`, radii `4,6,8,12,16,9999`, breakpoint boundaries, typography sizes/line-heights, motion durations and layout dimensions. `theme.css` must map those values into stable `--bread-*` variables, implement visible focus, reduced-motion handling, tabular financial numerals, touch-target minimums and no decorative shadows/gradients.

`Button` variants: `primary | buy | sell | secondary | small`; preserve width when loading, set `aria-busy`, and render `Confirming...` when loading with no explicit loading label. `Navigation` destinations: Explore, Graduating, Portfolio, Create. `MobileNavigation`: Explore, Trending, Create, Portfolio.

- [ ] **Step 4: Wire the global Next shell**

Use `next/font/google` `Inter` and `Geist_Mono` only as build-time self-hosted font inputs; expose them as CSS variables with no runtime Google Fonts request. Import `@bread/ui/theme.css` plus `apps/web/app/globals.css`. Root shell must implement the 64px desktop header, 56px mobile top bar, 64px mobile bottom nav, max-width 1440px, safe-area padding and source-defined responsive gutters. Replace `Bread bootstrap` with the first Explore shell heading/state without fabricating token data.

- [ ] **Step 5: Run focused GREEN and adjacent build gates**

Run:
- `pnpm exec vitest run tests/day7/ui-foundation.test.tsx`
- `pnpm --filter @bread/ui build`
- `pnpm --filter @bread/web build`
- `pnpm typecheck`

Expected: all PASS.

- [ ] **Step 6: Commit the coherent Task-1 implementation**

Commit message: `feat(day7): add public web design foundation`

---

### Task 2: Indexed read client, query provider, freshness and degraded-state boundary

**Files:**
- Create: `apps/web/lib/api/types.ts`
- Create: `apps/web/lib/api/client.ts`
- Create: `apps/web/lib/api/queries.ts`
- Create: `apps/web/components/providers.tsx`
- Create: `apps/web/components/freshness-banner.tsx`
- Modify: `apps/web/app/layout.tsx`
- Create: `tests/day7/read-client.test.ts`

**Interfaces:**
- Consumes: Day-6 `/v1/feed`, `/v1/search`, `/v1/tokens/:address`, `/trades`, `/holders`, `/portfolio/:address`, `/creators/:address`, `/status`; `IndexedResponse<T>`, `FreshnessMeta`, `ApiError` from `@bread/types`.
- Produces: one `breadApi` fetcher, stable query keys and status classification `FRESH | LAGGING | REBUILDING | DEGRADED` used by all pages.

- [ ] Write failing tests proving relative/same-origin API reads, bounded query serialization, typed error decoding, freshness propagation and no RPC client import in read-query modules.
- [ ] Run `pnpm exec vitest run tests/day7/read-client.test.ts` and verify RED is missing client behavior rather than configuration failure.
- [ ] Implement `BreadApiClient` with `getFeed`, `search`, `getToken`, `getTrades`, `getHolders`, `getPortfolio`, `getCreator`, `getStatus`; carry server `meta` unchanged and throw typed `BreadApiRequestError` for `ApiError` payloads.
- [ ] Configure one `QueryClient` with bounded retry (`1` for ordinary transient GET failures, `0` for 4xx), shared query keys and no automatic polling storm. Feed/token stale times must be short but non-zero; secondary tabs are disabled until selected.
- [ ] Implement `FreshnessBanner` that labels lagging/rebuilding/degraded indexed data without inventing balances/prices and never blocks browse-only navigation.
- [ ] Run focused tests, `pnpm typecheck`, `pnpm --filter @bread/web build`, then commit `feat(day7): add indexed web read boundary`.

---

### Task 3: Explore and Search from real Day-6 API data

**Files:**
- Create: `apps/web/components/token-card.tsx`
- Create: `apps/web/components/search-surface.tsx`
- Create: `apps/web/app/explore/page.tsx`
- Modify: `apps/web/app/page.tsx`
- Create: `tests/day7/explore-search.test.tsx`

**Interfaces:**
- Consumes: `breadApi.getFeed`, `breadApi.search`, `FreshnessBanner`, Task-1 UI primitives.
- Produces: public Explore and Search behavior used by first-visitor E2E.

- [ ] RED: exact contract-address search can start immediately; text search starts at two characters; duplicate-name results visibly include contract identity; Explore tab selection serializes to URL query parameter; unsupported deterministic feed views render an explicit not-ready/degraded state instead of fake rows.
- [ ] Implement vertical responsive token grid with 280px minimum desktop card width, one contextual badge maximum, progress in accent rather than green, and no per-card RPC calls.
- [ ] Implement desktop command-style search and mobile full-height search surface with keyboard-safe layout.
- [ ] Preserve cursor pagination and deduplicate repeated feed/search reads via Task-2 query keys.
- [ ] Run focused tests/build/typecheck and commit `feat(day7): add explore and search`.

---

### Task 4: Token page, progressive secondary tabs and graduation visibility

**Files:**
- Create: `apps/web/app/token/[address]/page.tsx`
- Create: `apps/web/components/token/token-identity.tsx`
- Create: `apps/web/components/token/token-stats.tsx`
- Create: `apps/web/components/token/token-chart.tsx`
- Create: `apps/web/components/token/graduation-module.tsx`
- Create: `apps/web/components/token/token-tabs.tsx`
- Create: `tests/day7/token-page.test.tsx`

**Interfaces:**
- Consumes: token detail + trades + holders APIs; snapshotted adapter/graduation fields from accepted projection; Task-1 components.
- Produces: canonical token context consumed by Trade.

- [ ] RED: malformed address vs valid-looking non-launch address are distinct; primary token state loads before secondary tabs; Trades/Holders fetch only on activation; unknown values render em dash; contract identity is always visible.
- [ ] Implement desktop chart/left context + 360px sticky trade slot; tablet trade sheet trigger; mobile identity -> market state -> chart -> graduation -> tabs with persistent Buy/Sell bar.
- [ ] Code-split chart and secondary tabs. Provide textual critical-value alternative to chart.
- [ ] Graduation module must transform across Active/Processing/Pending/Graduated and display snapshotted adapter/pool/permanent-lock evidence without calling graduation a safety guarantee.
- [ ] Run focused tests/build/typecheck and commit `feat(day7): add token read experience`.

---

### Task 5: Trade preparation, wallet lifecycle and transaction recovery

**Files:**
- Create: `apps/web/lib/transactions/state.ts`
- Create: `apps/web/lib/transactions/storage.ts`
- Create: `apps/web/lib/transactions/controller.ts`
- Create: `apps/web/components/trade/trade-panel.tsx`
- Create: `apps/web/components/trade/trade-sheet.tsx`
- Create: `apps/web/components/transaction-status.tsx`
- Create: `tests/day7/transaction-state.test.ts`
- Create: `tests/day7/trade-surface.test.tsx`

**Interfaces:**
- Consumes: `prepareBuy`, `prepareSell`, `simulatePreparedTransaction`, `decodeBreadError`, canonical protocol context, wallet provider.
- Produces: persisted transaction record `{ chainId, hash, action, tokenAddress, submittedAt, status }` and the trade UX state machine.

- [ ] RED state-machine tests for legal transitions, duplicate-action lockout, tx-hash persistence immediately after submission, reload recovery, network-loss unknown state and confirmed reconciliation trigger.
- [ ] RED trade tests for expected/minimum output, base fee, creator tax, opening tax, price impact, slippage, high-opening-tax warning and Buy/Sell presets.
- [ ] Implement direct wallet/provider writes only. No `/v1` mutation request may exist in transaction code.
- [ ] Revalidate/simulate transaction-critical state immediately before wallet signature; never use UI-derived finance math as authority.
- [ ] Implement desktop panel and mobile max-90dvh sheet with safe areas, numeric input mode, reachable primary action with software keyboard, visible focus and live-region status.
- [ ] Run focused + prior Day-7 tests/build/typecheck and commit `feat(day7): add trade transaction lifecycle`.

---

### Task 6: Create, Review, Launch and Launch+Buy

**Files:**
- Create: `apps/web/app/create/page.tsx`
- Create: `apps/web/app/create/review/page.tsx`
- Create: `apps/web/components/create/token-form.tsx`
- Create: `apps/web/components/create/launch-review.tsx`
- Create: `tests/day7/create-review.test.tsx`

**Interfaces:**
- Consumes: `prepareLaunch`, `prepareLaunchAndBuy`, canonical prepared economics/config hash, Task-5 transaction controller.
- Produces: validated source-defined launch intent and success navigation to `/token/:address`.

- [ ] RED source-scope tests: only image/name/ticker/description/links/creator tax/buyback/initial buy are user-editable; phantom reserve/tick spacing/protocol-only values are absent.
- [ ] RED review tests: actual prepared supply, quote, creator tax, buyback, initial buy, launch fee, graduation target, creator wallet and permanent lock behavior are visible; final action is exactly `Launch` or `Launch & Buy`.
- [ ] Implement ~720px desktop form, 640px review region, mobile single column and full transaction recovery/double-submit protection through Task 5.
- [ ] Implement success state with token identity/contract, View token, Share on X, Copy link and creator economics summary; no forced confetti/long celebration.
- [ ] Run focused + prior tests/build/typecheck and commit `feat(day7): add create and launch flows`.

---

### Task 7: Portfolio, Creator dashboard and USDC claims

**Files:**
- Create: `apps/web/app/portfolio/page.tsx`
- Create: `apps/web/app/creator/page.tsx`
- Create: `apps/web/components/portfolio/position.tsx`
- Create: `apps/web/components/creator/claim-panel.tsx`
- Create: `tests/day7/portfolio-creator.test.tsx`

**Interfaces:**
- Consumes: `/v1/portfolio/:address`, `/v1/creators/:address`, `prepareClaim`, Task-5 transaction controller.
- Produces: wallet holdings/activity, creator revenue/claims and post-confirmation indexed refresh.

- [ ] RED: disconnected portfolio/creator screens request connection rather than invent balances; PnL/average entry render only when API provides trustworthy cost basis; claim review shows exact claimable USDC and recipient.
- [ ] Implement desktop table/mobile stacked holdings, token-page navigation from holdings, creator totals/active launches/claimable USDC/locked buyback when available.
- [ ] Claim uses direct wallet write through `prepareClaim`; after confirmation invalidate/refetch indexed creator data.
- [ ] Run focused + prior tests/build/typecheck and commit `feat(day7): add portfolio and creator flows`.

---

### Task 8: Wallet/network integration and recovery convergence

**Files:**
- Create: `apps/web/components/wallet/wallet-provider.tsx`
- Create: `apps/web/components/wallet/wallet-button.tsx`
- Create: `apps/web/components/wallet/network-switcher.tsx`
- Modify: `apps/web/components/providers.tsx`
- Create: `tests/day7/wallet-network.test.tsx`

**Interfaces:**
- Consumes: validated network manifest/protocol context, wagmi/viem, Task-5 transaction controller.
- Produces: disconnected/browse, connected, wrong-network and switch-to-Arc states for all transaction surfaces.

- [ ] RED: browse remains available disconnected/wrong-network; transaction CTA changes to `Switch to Arc`; no wallet is labeled first-class merely because connector code exists.
- [ ] Configure supported injected/WalletConnect-compatible connector boundary without embedding secrets; chain/address configuration comes only from canonical config manifest.
- [ ] Lazy-load wallet-specific integration so it does not dominate the initial route bundle.
- [ ] Run focused + prior tests/build/typecheck and commit `feat(day7): add wallet and network boundary`.

---

### Task 9: Responsive, accessibility, performance and frontend-security convergence

**Files:**
- Modify: Task-1 through Task-8 components as required by measured failures.
- Create: `tests/day7/a11y-performance-contract.test.ts`
- Create: `apps/web/lib/security/metadata.ts`

**Interfaces:**
- Consumes: all Day-7 UI and 04D release gates.
- Produces: release-gate evidence for keyboard/focus/reduced-motion, metadata sanitization, lazy loading and truthful degradation.

- [ ] RED contract tests for no arbitrary HTML rendering, external URL normalization blocking `javascript:`/`data:`, safe link rel, reduced-motion CSS, visible focus, label/error associations, no color-only Buy/Sell state and no admin/operator package import in public web.
- [ ] Run production bundle/build analysis; charts/wallet/secondary analytics must be code-split and the initial shell must not import admin/operator code.
- [ ] Add CSP/header configuration appropriate to current wallet/media needs without exposing secrets.
- [ ] Verify no read component imports `viem`/wallet public-client RPC for primary rendering except transaction-safety modules.
- [ ] Run full Day-7 unit/component/type/build regressions and commit `fix(day7): converge web production gates`.

---

### Task 10: Playwright primary journeys and Day-7 integrated closeout

**Files:**
- Modify: `apps/web/package.json`
- Create: `playwright.config.ts`
- Create: `tests/e2e/day7-public-web.spec.ts`
- Create: `docs/evidence/day7-public-web-closeout.md`
- Modify: `docs/current-build-state.yaml`

**Interfaces:**
- Consumes: complete Day-7 integrated web + accepted Day-6 API/SDK fixtures.
- Produces: `PRIMARY_DESKTOP_MOBILE_E2E`, `NO_RAW_RPC_PRIMARY_UX`, `MOBILE_KEYBOARD_TRADE_FLOW` evidence.

- [ ] Add Playwright dependency/config and deterministic test API/wallet fixtures that preserve canonical Day-6 shapes rather than inventing financial semantics.
- [ ] Cover source-defined critical journeys: disconnected Explore/token browse; wallet/network switch; Buy; Sell; Create -> Review -> Launch; Launch & Buy; Claim; graduation pending/retry/graduated visibility; duplicate-name contract-safe search; reload after submitted transaction; indexer degraded state; mobile keyboard trade flow.
- [ ] Run desktop Chromium and mobile viewport journeys, then WebKit/Firefox where the test environment supports them. Fail any primary journey that silently substitutes raw RPC for normal indexed reads.
- [ ] Run `pnpm validate`, `pnpm test`, `pnpm test:day6`, all Day-7 tests, `pnpm typecheck`, `pnpm build`, Foundry/ABI checks and the repository’s retained Day-6 integration gates required by current continuity policy.
- [ ] Record exact-head CI/workflow evidence and source/design/security review in `docs/evidence/day7-public-web-closeout.md`.
- [ ] Advance `docs/current-build-state.yaml` only after exact-head green evidence. Required final verdicts: `PRIMARY_DESKTOP_MOBILE_E2E = PASS`, `NO_RAW_RPC_PRIMARY_UX = PASS`, `MOBILE_KEYBOARD_TRADE_FLOW = PASS`.
- [ ] Guarded-merge only the exact audited head, then create a fresh post-merge durable handoff before Day 8.

## Plan Self-Review

- **Spec coverage:** 04A routes/jobs, 04B tokens/components, 04C responsive page composition, 04D performance/accessibility/transaction recovery/security, Day-6 canonical read/write interfaces, 06I client dedupe/no-per-card-RPC and Day-7 E2E gates are each owned by a task above.
- **Scope:** No comments, referrals, DMs, rich notifications, custom social profiles, native mobile app, economics change, admin UI or mainnet-value invention is included.
- **Type consistency:** All reads preserve `IndexedResponse<T>`/`FreshnessMeta`; all writes flow through `PreparedBreadTransaction` builders and wallet/provider; no alternate frontend financial transaction type is introduced.
- **Continuity:** Every task starts from the prior integrated Task head, runs affected prior Day-7 regressions and leaves a consumer-ready interface for the next task.
