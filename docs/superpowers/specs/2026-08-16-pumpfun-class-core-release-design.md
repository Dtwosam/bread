# Bread UI/UX v2.2 Source-Conformance Release Closure

**Status:** SOURCE-DERIVED IMPLEMENTATION NOTE — NON-AUTHORITATIVE

**Date:** 2026-08-16

**Purpose:** Close remaining Bread UI/UX v2.2 software lanes by implementing the existing ratified Project Sources literally. This file does not create product, protocol, market-data, storage, ranking, lifecycle, or financial semantics.

## 1. Authority

The implementation authority is the ratified Bread Project Source pack, not this repository note and not competitor behavior.

Controlling hierarchy for this closure:

1. `00-bread-master-source-of-truth-v1.6` — top-level scope, protocol/security/release authority.
2. `Bread-UI-UX-v2-complete-interface-specification-v2.2` — detailed visual/component/page/responsive UI authority after v1.6 ratification.
3. `04A-product-information-architecture-user-journeys` — core product jobs, routes, required page content and journeys.
4. `04D-ux-performance-accessibility-production-gates` — performance, accessibility, transaction recovery, metadata security, browser/device and production gates.
5. `06B-interfaces-data-model-indexer-runtime-contracts` — canonical cross-layer identities, indexed/read boundaries and shared interface rules.
6. `06D-chatgpt-agent-execution-protocol-quality-gates` — source-first RED -> GREEN implementation workflow and stop conditions.
7. `06H-cross-chat-continuity-build-state-handoff-protocol` and the current `CURRENT-BUILD-STATE` — workflow position and continuation state only; they do not replace product/protocol semantics.

Where sources are silent, conflicting, or require an authority that the repository does not yet expose, implementation stops and reports the gap. It must not invent a substitute.

## 2. Pump.fun Benchmark Boundary

The v2.2 source itself states that **Pump.fun-level simplicity and personality is the minimum bar, not the final target**. That is the only role of the Pump.fun comparison in this closure.

It does **not** authorize copying Pump.fun features, ranking, economics, media/storage choices, social systems, lifecycle vocabulary, analytics, or interaction semantics.

The same v2.2 source explicitly requires Bread to keep its own visual identity and forbids cloning a competitor. Therefore every implementation decision below comes from Bread sources or existing canonical Bread repository authority.

## 3. No-Drift Rule

The v2.2 written specification is to be followed literally. Implementation may not improvise alternate colors, spacing, hierarchy, creator prominence, page structure, interaction states, financial fields, breakpoints, or copy conventions.

04A and 04D remain controlling and are not weakened. Protocol economics, Arc/USDC rules, security invariants, transaction construction, adapter semantics, custody/admin authority and financial ledgers remain unchanged.

## 4. Search Closure

Source-required Search behavior includes:

- desktop command-style overlay and mobile full-height search surface,
- exact contract match ranked first and explicitly labeled,
- text queries beginning around two characters and immediate address-like search,
- result groups: Exact match, Tokens, Creators/wallets, Recent searches, Trending searches,
- token rows showing image, name/ticker, creator attribution, short contract, market cap, holders, age and lifecycle state,
- duplicate names/tickers retaining contract identity,
- creator-wallet results supporting creator-filtered discovery rather than a public reputation product,
- keyboard up/down navigation, Enter open, Esc close and focus return.

### Search semantics that are not defined by current sources

The current sources require `Recent searches` and `Trending searches` as groups, but do not define:

- Recent-search persistence/storage location,
- retention count or expiry,
- deduplication/removal semantics,
- Search-specific trending ranking/window,
- whether Search Trending must reuse the Explore Trending feed.

Therefore this closure must first inspect existing canonical repository behavior. If no already-authoritative implementation exists, those exact semantics remain a source gap and must not be invented in code.

The previously proposed `localStorage`, maximum-eight retention, and automatic reuse of the Explore Trending feed are withdrawn as implementation requirements because they are not stated by the controlling sources.

## 5. Explore, Token Cards and Market Cap

Source-required Explore behavior includes New, Trending, Almost Baked and Graduated feeds; indexed Trending authority; required filters/sorts as supported; first-viewport real tokens; stable card positions; and no paid placement disguised as organic Trending.

Source-required TokenCard content includes token image, name/ticker/age, creator, market cap, movement, compact volume/holders, baked progress or graduated state, and at most one primary badge. Market cap and recent movement are the strongest data row.

Market cap is also required on Search rows, Token detail, Creator launch rows and the relevant Explore controls.

### Market-cap authority boundary

The sources require market cap to be displayed, but the source material reviewed for this closure does not define a new market-cap formula. `06B` establishes `token_metrics` as the derived market/activity projection and prohibits lanes from inventing private interpretations of shared interfaces.

Therefore:

- use an existing canonical indexed/repository market-cap definition if one is already present and source-conformant;
- propagate that canonical value through shared types/API/UI where required;
- if the repository does not contain an authoritative market-cap derivation, stop and record a source/interface gap;
- do not introduce a new formula such as `price × circulating supply` merely because it is conventional.

The previous independent market-cap formula in this note is withdrawn.

## 6. Token Media / Metadata

Bread sources require token images across Explore, Search, Token, Create/Success, Portfolio and Creator contexts.

04D additionally requires:

- token images to be resized/cached and delivered at appropriate dimensions,
- image dimensions/aspect ratio reserved to prevent CLS,
- token images/metadata treated as untrusted,
- no arbitrary HTML rendering from metadata,
- external URLs sanitized/normalized with javascript/data URL injection prevented,
- malicious or unavailable token metadata/image behavior included in failure testing.

06B separates sanitized display metadata from finance state.

### Storage/upload authority boundary

The current sources require an image field in Create and safe image handling, but the reviewed sources do not select a storage provider, signed-upload protocol, file-size limit, MIME allowlist, SVG policy, or third-party media service.

Therefore implementation must reuse an already-approved repository/service boundary if one exists. If none exists, the production upload/storage mechanism remains a source/architecture gap. Do not choose a new provider or invent limits/policies in this lane.

The previously proposed storage-provider selection, MIME/file-size policy and SVG rule are withdrawn as independent design requirements.

## 7. Lifecycle Vocabulary

Use the lifecycle/state vocabulary in v2.2 and the existing protocol/indexer authority. Do not replace it with a simplified three-state model.

Source-backed UI states include, as supported by canonical state:

- Active with baked progress,
- Almost Baked,
- Graduating / Processing,
- Graduation pending after failed auto-graduation,
- Graduated,
- any existing exceptional/rescued treatment already defined by protocol sources.

Explore lifecycle filtering is `New / Active / Almost Baked / Processing / Graduated` as supported.

Lifecycle must not be inferred from age, market cap, volume, holders or a guessed threshold. Graduation must not be presented as an investment-safety guarantee.

The previous `Bonding / Graduating / Graduated` simplification is withdrawn.

## 8. Token / Trade

Retain the v2.2 Token/Trade requirements already implemented or still needing exact-head closure:

- compact token identity with creator attribution and contract identity,
- primary market stats where authoritative,
- chart never blocking Buy/Sell,
- baked/graduation module,
- sticky desktop TradePanel and mobile persistent Buy/Sell actions/sheet,
- visible expected output, minimum output, base fee, creator tax, opening tax, price impact and slippage,
- exact opening-protection warning/cost,
- current-estimation Buy MAX Arc gas reserve without changing ordinary balance display or Sell MAX semantics,
- stale-review/quote invalidation before signing,
- transaction hash persistence/recovery and explorer link,
- truthful disconnected, wrong-network, RPC/indexer-degraded and route-changed states.

No transaction-construction, protocol-economic or financial-ledger semantics change here.

## 9. Create / Review / Success

Implement only the source-defined staged Create/Review flow and fields.

Source-required Create content includes image, name, ticker, description, optional links, creator tax, buyback choice and optional initial buy. The mandatory Review presents fixed supply, quote currency, creator tax, buyback, initial buy, launch fee, graduation target, creator revenue wallet and permanent-liquidity-lock behavior. Final CTA is exactly `Launch` or `Launch & Buy` based on the prepared operation.

The v2.2 success state requires token image/name/ticker, creator attribution, contract address, View Token, Copy Link, Share, transaction status/hash and creator economics summary.

Prepared economics/config must be re-read where required and stale review values highlighted rather than silently accepted.

Do not expose protocol-only concepts to normal creators and do not invent a storage/upload mechanism beyond existing authority described in Section 6.

## 10. Portfolio and Creator Dashboard

Portfolio remains holdings-first and calm. Required values are shown only where reliable; PnL/average entry require complete trustworthy cost basis. Creator attribution stays secondary and Trade/value stays stronger.

Creator remains the creator's own operational dashboard, not a reputation product. Source-required summary/list fields include total earned, claimable USDC, active launches, locked buyback where applicable, token identity, `by you`, market cap, lifecycle, revenue and claim status. The claim panel must show exact claimable USDC and recipient before signature.

Where a source-required value has no trustworthy current projection, do not fabricate it or derive it from unrelated fields.

Canonical creator identity remains the onchain creator/deployer identity established by the current repository/source reconciliation, not the creator fee-recipient wallet.

## 11. Secondary Routes and Failure States

Retain the source-defined treatment:

- `/activity`: use reliable activity data only; do not invent fields when scope is limited,
- `/stats`: platform statistics only from reliable indexed data,
- `/docs`: readable 720-840px documentation shell with sticky desktop section nav and Geist Mono code/address blocks,
- `/legal/terms`, `/legal/privacy`, `/legal/risks`: readable legal templates; do not fabricate approved legal content,
- `/profile/:address`: minimal compatibility route or creator-filtered discovery; no reputation product,
- 404: distinguish ordinary not-found from a valid-looking non-Bread launch address,
- maintenance/error: distinguish website/API failure from onchain contract state.

## 12. Accessibility, Performance and Security Gates

04D remains a release gate, not optional polish.

Required closure includes:

- LCP target <=2.0s p75 and release ceiling <=2.5s,
- INP target <=150ms p75 and release ceiling <=200ms,
- CLS target <=0.05 and release ceiling <=0.10,
- cached feed API p95 <=250ms,
- token read API p95 <=350ms,
- primary UI acknowledgement <=100ms,
- quote refresh target <=500ms after input settles excluding wallet/RPC outages,
- no per-card authoritative RPC fanout,
- code-split secondary/chart/wallet-specific surfaces,
- WCAG 2.2 AA target, keyboard access, visible focus, programmatic labels, live-region transaction status, reduced-motion support and non-color-only financial/status communication,
- tested current Chrome/Edge, Safari, Firefox, iOS Safari, Android Chrome and explicitly claimed wallet-browser paths,
- >=10,000-client hot-launch capacity gate with healthy read errors below 1% in the defined test,
- malicious/unavailable token metadata/image, API/RPC failure, indexer delay and transaction recovery failure scenarios.

Performance or accessibility regressions block release even if the page looks better.

## 13. Implementation Workflow

For every remaining implementation slice, follow 06D literally:

1. read the relevant Project Sources and existing canonical interfaces,
2. identify upstream/downstream consumers and affected regressions,
3. write the focused failing test,
4. verify the failure represents the missing source-required behavior,
5. implement the minimum source-conformant change,
6. run focused tests,
7. run adjacent/regression tests,
8. review the diff against the sources,
9. run type/static/lint/build checks,
10. commit one coherent change,
11. run the required integrated exact-head verification before calling the lane complete.

Stop instead of improvising when source docs conflict, a required public interface is undefined, a dependency differs from assumptions, or an architecture/security decision would be required.

## 14. Lane Closure and Final Candidate

Do not mark a lane complete merely because its component tests pass. The implementation plan and 06D require the continuously integrated system and affected journeys to remain green.

On the final unified candidate, rerun the affected root CI, indexed/API/read tests, Explore/Search, Token/Trade, Create, Portfolio/Creator, accessibility, production gates, frontend security, browser/Playwright, alternate-browser/release matrix, recovery/reconcile and 06I hot-launch/capacity evidence on one exact code-bearing head.

`PHYSICAL_DEVICE_EXTERNAL_EXECUTION_REQUIRED` remains an independent Day-9 release gate. Software-lane completion does not fabricate or waive physical/current branded-device evidence.

No RC tag is created and Day 10 does not begin until the controlling Day-9 gates allow it.

## 15. Source-Gap Register for Remaining Closure

These are implementation blockers unless an already-authoritative repository path resolves them:

- exact Recent-search persistence/retention/removal semantics,
- exact Search-specific Trending-search semantics,
- canonical market-cap derivation if not already defined by current indexed implementation,
- approved token image upload/storage/provider contract if not already present,
- any missing reliable global Activity/Stats aggregation,
- approved legal Terms/Privacy/Risk copy,
- any required production/mainnet economics/config/Arc values that remain externally gated.

A gap is not permission to design a new answer. It is a stop condition to be resolved through existing repository authority, an explicit source amendment, or an external dependency becoming available.