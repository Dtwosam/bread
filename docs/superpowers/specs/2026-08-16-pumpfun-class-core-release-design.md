# Bread Pump.fun-Class Core Release Closure Design

**Status:** APPROVED DIRECTION — written specification pending final user review

**Date:** 2026-08-16

**Scope:** Close the remaining Bread UI/UX v2.2 software lanes to a competitive launchpad release standard without changing protocol economics, custody, admin authority, canonical USDC, DEX semantics, transaction construction, or financial ledgers.

## 1. Product Goal

Bread should ship a fast, understandable launchpad loop:

1. discover a token,
2. understand its identity, creator, market state, and lifecycle,
3. buy or sell with explicit transaction consequences,
4. create a token through a staged review flow,
5. monitor holdings and creator revenue,
6. repeat the loop comfortably on desktop and mobile.

The target is **Pump.fun-class core usability**, not feature-for-feature cloning. Bread keeps its own Arc/USDC architecture, protocol semantics, information architecture, and visual identity.

## 2. Non-Goals

This closure does not add livestreaming, voice/social rooms, reputation scores, automated trading modes, speculative ranking systems, or new protocol economics.

It does not invent missing source authority. Unknown or unavailable values remain visibly unavailable until a canonical source exists.

It does not weaken the existing `PHYSICAL_DEVICE_EXTERNAL_EXECUTION_REQUIRED` release gate or fabricate device evidence.

## 3. Search and Discovery Closure

### 3.1 Recent searches

Recent searches are a local-device convenience only.

- Store at most 8 unique normalized search entries.
- Order newest first.
- Re-selecting an existing entry moves it to the front rather than duplicating it.
- Users can remove an individual entry and clear all entries.
- Do not sync recent searches to a wallet, account, API, analytics system, or blockchain.
- If browser storage is unavailable or blocked, Search continues to function normally without recents.

### 3.2 Trending searches

Do not create a second ranking system for Search.

- Search trending suggestions are derived from the same canonical backend-backed **Trending** token feed already used by Explore.
- The Search UI may present a bounded subset of those authoritative Trending results as suggestions before a query is entered.
- Search suggestion presentation must not alter Trending membership or ranking.
- No browser-side popularity scoring, wallet telemetry, or fabricated search-frequency metric is introduced.

### 3.3 Exact identity and creator behavior

Retain accepted Search semantics:

- exact contract-address matches remain visually distinct,
- creator identity is the canonical launch deployer identity,
- `creator_fee_recipient` is not creator-search authority,
- token and creator/wallet results remain grouped without changing backend membership or ranking.

## 4. Canonical Market Cap

Market cap becomes a first-class indexed market metric, but it must have one canonical backend definition.

### 4.1 Authority

The backend/indexed layer owns market-cap calculation and projection. React components do not independently calculate market cap.

For a token with authoritative price and supply inputs:

`marketCapQuote = canonicalTokenPriceInUSDC × canonicalCirculatingSupply`

The implementation must use the repository's existing canonical fixed-point/base-unit conventions and must not introduce floating-point money arithmetic.

### 4.2 Lifecycle-aware supply source

The calculation must consume the authoritative supply quantity already defined by the Bread protocol/indexer for the token's current lifecycle. If the repository does not expose a trustworthy circulating-supply input for a lifecycle state, market cap is `null` for that state rather than guessed.

### 4.3 Presentation

Market cap is projected through shared API types and reused by:

- Explore TokenCard,
- Search result metadata where space permits,
- Token detail primary stats,
- Creator launch rows,
- any future Stats aggregation that has reliable indexed authority.

Missing market cap renders `—`; it is never reconstructed client-side.

## 5. Secure Token Media Pipeline

A public launchpad needs real token imagery, but arbitrary user-controlled URLs must not become an SSRF or unsafe-media path.

### 5.1 Creation input

The Create flow supports an actual image selection/upload experience rather than pretending an arbitrary URL is a complete upload system.

Allowed initial scope:

- common static web image formats supported by the selected storage/proxy implementation,
- explicit file-size limit,
- explicit MIME/type validation,
- no SVG unless the existing security policy and sanitization path already permits it,
- no executable or HTML content.

### 5.2 Storage boundary

The image-upload implementation must use an approved repository/service integration. If no approved storage provider or signed-upload boundary exists in the current project configuration, the production upload path remains gated and the UI must not silently substitute arbitrary remote URLs.

The implementation plan must first inspect existing repository storage, deployment, and environment support before selecting the narrowest compatible provider path.

### 5.3 Canonical projection

Once accepted, token media is represented by a canonical indexed/API field. Consumer components render only that canonical field or a deterministic Bread placeholder.

Client components must not fetch arbitrary token metadata URLs to discover images.

### 5.4 Failure behavior

Bad, missing, unsupported, or failed media resolves to a stable placeholder without blocking discovery, trading, portfolio, or creator surfaces.

## 6. Lifecycle Vocabulary

User-facing lifecycle labels remain intentionally small and deterministic:

- **Bonding** — token remains on the bonding path before graduation processing.
- **Graduating** — canonical protocol/indexer state says graduation is being processed/pending.
- **Graduated** — canonical successful pool-created/graduated state.

Do not infer lifecycle from age, market cap, volume, holder count, or progress percentage.

Existing protocol-specific exceptional states continue to use their established source-backed treatment and are not relabeled as successful graduation.

## 7. Core Surface Release Bar

### 7.1 Explore

A normal token card should surface, when canonically available:

- token image,
- name and ticker,
- canonical creator,
- market cap,
- age,
- trailing 24h volume,
- holder count,
- bonding/graduation progress for applicable tokens,
- lifecycle treatment.

Unknown fields remain quiet and explicit rather than fabricated.

### 7.2 Token / Trade

The token page keeps trading visually dominant and exposes:

- token identity and canonical creator,
- chart/activity surfaces already supported by canonical data,
- market cap, holders, volume, and lifecycle/progress where available,
- explicit Buy/Sell state,
- current-balance semantics,
- Buy MAX gas-reserve behavior already implemented,
- exact prepared review values and opening-protection cost before signing,
- stale-quote refresh and transaction explorer recovery behavior.

No trade transaction-construction semantics change in this closure.

### 7.3 Create / Review / Success

Retain the staged v2.2 structure:

`Token → Economics → Review → Success`

Finish the production-quality token image path described in Section 5 while retaining:

- canonical launch economics/config readback,
- exact prepared review values,
- stale-review change highlighting,
- creator/deployer identity,
- contract identity,
- View Token, Copy Link, and sharing affordances.

### 7.4 Portfolio

Retain holdings as the primary surface. Show only reliable values:

- token identity/image,
- canonical creator,
- amount,
- current value,
- market movement only when a reliable indexed projection exists,
- cost basis/PnL only when complete trustworthy inputs exist,
- Trade action where tradeable,
- recent indexed wallet activity.

### 7.5 Creator dashboard

Keep the creator dashboard operational rather than reputational:

- total earned,
- claimable USDC,
- active launches when lifecycle coverage is complete,
- launch identity/image,
- canonical `by you` creator attribution,
- market cap,
- lifecycle,
- revenue,
- truthful claim status,
- canonical FeeEscrow read/simulate/write/re-read claim flow.

Do not add creator reputation, trust scores, public history rankings, or fabricated per-launch outstanding claim allocation.

### 7.6 Secondary routes

Retain truthful limited-source behavior for `/activity`, `/stats`, legal pages, profile compatibility, 404, and maintenance/error states.

- Global Activity is populated only if a reliable platform-wide indexed projection exists.
- Stats are populated only from reliable indexed aggregates.
- Legal pages do not fabricate approved legal copy.
- `/profile/:address` remains a compatibility path rather than a reputation product.
- Frontend/read-service failures stay clearly distinct from onchain contract state.

## 8. Mobile and Accessibility Standard

Mobile is a first-class interaction target, not compressed desktop.

Closure requires:

- no horizontal overflow on supported mobile widths,
- safe-area-aware sticky transaction/create controls,
- full-height overlays/sheets that remain operable with mobile browser chrome,
- keyboard-visible focus for all interactive controls,
- logical tab order,
- accessible names for icon-only controls,
- sufficient hit targets,
- no color-only state communication,
- reduced-motion compatibility where animation exists,
- error and pending states announced/readable without relying on transient visuals.

Existing v2.2/04D accessibility and performance gates remain controlling where stricter.

## 9. Performance and Data-Access Rules

- No per-card or per-result raw-RPC fanout.
- Discovery metrics come from indexed/backend projections.
- Existing cache and pagination authority remains server-side.
- Media loading must be bounded and resilient.
- New Search recents use local browser storage only and must not delay initial Search usability.
- Market-cap computation belongs in the indexed/backend data path, not repeated client-side.
- Existing 10k hot-launch/capacity and recovery gates must be rerun on the final unified candidate.

## 10. Error and Degraded-State Rules

Every newly completed path must degrade truthfully:

- missing canonical metric → `—`,
- missing/bad image → deterministic placeholder,
- local storage failure → Search works without recents,
- Trending suggestion fetch failure → Search remains usable without suggestions,
- API/read failure → state identifies website/read-service problem without implying an onchain state change,
- pending transaction → explicit pending state until canonical re-read confirms outcome,
- unknown lifecycle → do not infer a label from neighboring metrics.

## 11. Testing and Lane Closure

Every implementation slice follows repository RED → GREEN discipline.

Required focused coverage includes:

1. local recent-search persistence/deduplication/removal/failure fallback,
2. Trending suggestions reuse authoritative Trending membership/order,
3. canonical market-cap fixed-point calculation and null semantics,
4. market-cap API/type/UI propagation without client recomputation,
5. secure media validation and canonical projection/fallback behavior,
6. lifecycle labels driven only by canonical state,
7. desktop/mobile Search and Explore rendering,
8. Token/Create/Portfolio/Creator regressions,
9. accessibility keyboard/focus behavior,
10. degraded/error behavior.

After focused slices pass, one exact integrated head must run the affected root CI, production gates, frontend security, indexed read/API tests, Explore/Search, Token/Trade, Create, Portfolio/Creator, browser/Playwright, alternate-browser/release matrix, recovery/reconcile, and 10k hot-launch/capacity workflows.

A software lane is only marked complete when its required integrated gates pass on the same code-bearing head.

## 12. Release Boundary

Software-lane completion does **not** by itself declare Day 9 complete.

The following remain independent release gates:

- genuine physical/current branded device evidence required by `PHYSICAL_DEVICE_EXTERNAL_EXECUTION_REQUIRED`,
- approved production economics/runtime/mainnet values where still externally gated,
- approved legal copy before a public legal representation is claimed,
- any other explicitly retained source/security blocker that cannot be resolved from current repository authority.

No RC tag is created and Day 10 does not begin until the controlling Day-9 release gates allow it.

## 13. Implementation Order

Close the release in this order so each step produces a usable, independently testable increment:

1. Recent Search local persistence.
2. Trending Search suggestions from the existing authoritative Trending feed.
3. Canonical indexed market-cap authority and propagation.
4. Secure token-media upload/projection after confirming an approved storage boundary.
5. Lifecycle/metric presentation consolidation across Explore, Search, Token, Portfolio, and Creator.
6. Responsive/accessibility/degraded-state regression fixes.
7. One exact-head unified verification sweep.
8. Mark software lanes complete only where exact-head evidence supports it.

This order does not reopen already accepted behavior unless a regression or source conflict is demonstrated.