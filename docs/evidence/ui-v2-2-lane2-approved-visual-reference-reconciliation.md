# Bread UI/UX v2.2 — Lane 2 Approved Visual Reference Reconciliation

Status: **PASS**

Date: 2026-08-15

## Accepted exact head

- PR: #94 — `agent/ui-ux-v2-2-implementation`
- Accepted Lane-2 implementation/evidence head: `6c0cee1a27f8c0adcf8b57fd44ff22693db006e3`
- Last production-shell change before the final evidence-only density probe: `83220005d2ae93755ec380abf4566a6929feeeee`
- Base Day-9 candidate: `18952b20a56021350000c0f5d89552380c883be3`
- Lane 3 was not started before this gate.

## Authority used for reconciliation

Reconciliation order:

1. approved visual reference — frozen visual target where compatible;
2. ratified Bread UI/UX v2.2 written specification — controlling when a concept/reference conflicts;
3. canonical editable Figma shell artifact — file `DsjM9F9yt0WZRhyKGHOvCl`, reconciled shell node `7:2`, header `7:3`, live strip `7:28`;
4. exact-head rendered browser evidence from pinned GitHub/Playwright Chromium.

The written v2.2 specification remains controlling over concept imagery. No protocol, economics, custody, Arc/USDC, DEX, transaction-construction or financial-ledger semantics changed in this lane.

## Tooling status

- GitHub: available and authoritative for committed source/history/CI.
- Figma: the canonical editable shell was established, but the Starter-plan MCP call limit was reached during reconciliation. The outage/limit did not authorize redesign or a lower visual bar. Brand/Search/mobile corrections remain Figma synchronization debt when writable MCP access returns.
- Vercel: connector/team access is present, but `list_projects` returned no configured Bread project. No Vercel preview evidence is fabricated. Exact-head GitHub/Playwright is the current rendered fallback.
- `/tmp/bread-synthra-fork-proof`: untouched by this lane.

## Exact rendered evidence

### Desktop

- Viewport: **1586 × 992**
- Workflow: `day7-task10-playwright-closeout` run `31908014716` — PASS
- Artifact: `9252919190`
- Artifact digest: `sha256:e98b4671c282d0a5f8627e9ef17567a9ce8b503d932ae71edaeb5c9da71a0f5f`
- Rendered PNG SHA-256: `c9197124221712c1409b0ff6c1a98571107ffc764ee764253eb0798d4688dd76`

### Mobile

- Viewport: **390 × 844**
- Workflow: `day7-task10-playwright-closeout` run `31908014716` — PASS
- Artifact: `9252919323`
- Artifact digest: `sha256:e7f48c573b58f200f6d1ccd47fb58efe302d72576ad6a445f0e79598caaa306b`
- Rendered PNG SHA-256: `5431247887d0570d3ce69a110d8cedc0128db605cd28dcbf8a04301dd8672688`

The development capture includes the Next.js development indicator at the bottom-left. That indicator is test-harness tooling rather than Bread product UI and is excluded from the product visual comparison.

## Material drift found and corrected

### 1. Desktop header composition and proportions

Initial drift: the shell used a loose flex-like composition with weak centering/proportion control.

Correction:

- 64px desktop header;
- 1440px written-spec standard max-width;
- 32px desktop gutters;
- stable `Bread -> nav -> flexible Search -> watchlist -> Wallet` ordering;
- centered Search target at 520px;
- bounded watchlist and wallet controls.

Accepted header geometry head: `c3f839d5f2b073e93fcf11981f107313813ed495`.

### 2. Navigation character

Initial drift: plain text navigation lacked the approved/reference Bread trading-shell character.

Correction:

- canonical decorative 20px navigation icons;
- labels and route semantics unchanged;
- active state remains `accent-soft` + accent icon/text.

Accepted nav-icon head: `7c7d2a7f3474fe1f5cb1d14ed981356320f1a7cd`.

### 3. Live activity strip

Initial drift: the strip was absent.

Correction:

- one 40px desktop surface directly below the header;
- one 36px compact mobile surface below the mobile top bar;
- stable shared `bread-live-strip` component root;
- truthful status states from the existing indexed `/v1/status` boundary;
- no fabricated trades/min, movers, volume or launch counts.

Accepted desktop strip head: `0829cf18c438ff7adcf31f41fddbf5a906bc9e50`.

### 4. Bread-specific brand cohesion

Initial drift: the header rendered only a text wordmark and lacked the approved Bread mark/personality.

Correction:

- one shared desktop/mobile `BreadBrand` primitive;
- decorative 36×36 `brand-butter` `•ᴗ•` mark;
- BREAD wordmark retained;
- no semantic or route behavior changed.

Accepted brand head: `439ee0103b84d05aa5042942cc03ece9d50f1372`.

### 5. Search character and keyboard reachability

Initial drift: Search looked like a generic text button and did not implement the written desktop Ctrl/Cmd+K shortcut.

Correction:

- restrained normal-size 16px search glyph;
- left-aligned icon + placeholder inside the centered 520px trigger;
- Ctrl+K and Cmd+K open the existing Search dialog after stable load;
- Escape/focus-return behavior retained;
- accessible trigger name remains exactly `Search`;
- ranking/query/data semantics unchanged.

Accepted Search head: `990dd5e9358cf23655cdc9ada45de650632002ae`.

### 6. Mobile shell order and density

Initial drift: the mobile live strip was explicitly hidden below 768px, violating the written v2.2 mobile composition.

RED evidence: `577a8305106a63a5ae410e1080e4392f5310cdb9`, browser run `31907570558` — expected failure because `.bread-live-strip` resolved hidden at 390×844 while 26 other browser journeys passed.

Correction:

- DOM order now permits desktop `header -> strip` and mobile `top bar -> strip -> page` without duplicate surfaces;
- mobile top bar remains 56px;
- mobile live strip renders at 36px with 16px mobile gutters;
- bottom navigation retains Explore / Trending / Create / Portfolio and safe-area handling;
- no horizontal document overflow at 390px;
- Search and wallet labels fit their own controls at 390px.

Accepted production-shell head: `83220005d2ae93755ec380abf4566a6929feeeee`.
Final same-tree evidence head: `6c0cee1a27f8c0adcf8b57fd44ff22693db006e3`.

## Final structured visual diff

### Matches the approved/reference character where source-compatible

- Bread butter mascot/mark + BREAD identity is immediate but not oversized.
- Desktop nav uses compact icon + label items with a restrained blue selected state.
- Search is centered, broad, command-like and visually quieter than the wallet CTA.
- Watchlist is a compact butter star control; wallet/network action remains clear without dominating the whole header.
- Desktop shell proportions are compact and stable rather than marketing-hero sized.
- Background/surface contrast is dark and restrained; borders are subtle rather than neon/high-chroma.
- Controls use the shared 8px radius and tokenized spacing instead of arbitrary geometry.
- Header/live-strip/page boundaries remain clear without boxes-inside-boxes.
- Live strip reads as one calm informational surface rather than a marquee/pill farm.
- Mobile retains Bread identity, one-tap Search, Wallet, compact live status and persistent bottom navigation.
- Navigation/search/live updates preserve the playful Bread character without casino/gamified treatment.

### Intentional written-spec-controlled differences

1. **Desktop canvas width:** the written v2.2 standard max width of 1440px with 32px desktop gutters controls over the concept/Figma shell's earlier full-canvas x32 origin at 1586px. Code is intentionally not widened merely to imitate conflicting concept geometry.
2. **Live-strip statistics:** sample/reference trades-per-minute, movers and volume are not reproduced until reliable Bread indexed data exists. Current status-only content is intentionally truthful rather than fabricated.
3. **Explore page body:** token-card/feed composition remains the pre-v2.2 body and is explicitly outside Lane 2. It is the next page-composition lane, not unresolved shell drift.
4. **Development indicator:** the small Next.js dev indicator in Playwright screenshots is a non-product capture-environment overlay, not Bread UI.

## Exact-head regression evidence

All of the following are PASS on `6c0cee1a27f8c0adcf8b57fd44ff22693db006e3`:

- root `ci`: run `31908014748`
- UI foundation/shell: run `31908014633`
- Explore/Search: run `31908014663`
- wallet/network: run `31908014751`
- frontend security: run `31908014708`
- production gates: run `31908014701`
- desktop/mobile Playwright + both screenshot artifacts: run `31908014716`
- release browser matrix: run `31908014677`
- Day-9 final-RC truthfulness workflow: run `31908014737` (automation green does not override remaining Day-9 blockers)
- service rollback: run `31908014637`
- recovery drills: run `31908014646`

## Verdict

`APPROVED_VISUAL_REFERENCE_RECONCILIATION = PASS`

`LANE_2_GLOBAL_SHELL_NAVIGATION = PASS`

This PASS is limited to the global shell/navigation visual-reconciliation scope. It does not claim the Explore/TokenCard body is v2.2-complete, does not claim Day 9 is complete, does not create an RC tag, and does not begin Day 10. Lane 3 may now begin from this accepted Lane-2 baseline.
