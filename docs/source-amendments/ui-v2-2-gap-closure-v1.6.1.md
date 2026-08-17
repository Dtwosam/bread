# Bread UI/UX v2.2 Gap-Closure Source Amendment

**Proposed source label:** `v1.6.1-pre-rc-ui-gap-closure`  
**Date:** 17 Aug 2026  
**Status:** USER-APPROVED DECISIONS — PROPOSED CONTROLLING AMENDMENT; Project Source upload/readback ratification required before affected production implementation.

## Authority boundary

This amendment resolves only the source/interface gaps explicitly named below. It carries forward the ratified v1.6 source hierarchy, UI/UX v2.2, 04D, 06B, 06C–06I and CURRENT-BUILD-STATE continuity rules except where it expressly replaces an unresolved gap. External launchpads are product-pattern benchmarks only; they do not become Bread protocol authority.

It does **not** change Solidity, protocol economics, supply, custody, graduation mechanics, Arc/USDC identity, admin authority, transaction construction, DEX routing or financial ledgers.

## Frozen gap-closure decisions

1. **Market cap** — canonical indexed token price × the launch's canonical snapshotted fixed total supply. Compute once in the indexer/read-model layer using existing exact integer/fixed-point conventions; no JavaScript floating point and no second frontend formula. The same indexed value powers display, filter and sort.

2. **Sort semantics** — Trending remains a separate canonical feed. Explicit sorts are Newest descending, Market cap descending, 24h Volume descending, Holders descending and Baked Progress descending. Numeric ties fall back to launch time descending, then canonical token address ascending. Null/unavailable values sort after valid values.

3. **Lifecycle / graduation classification** — protocol/indexer state is authoritative. Precedence: Graduated → Graduation pending → Processing/Graduating → Almost Baked → New → Active. Almost Baked and New use canonical feed classification rather than React-invented thresholds. The Processing filter includes actively processing and retry-pending graduation; rendered labels remain exact.

4. **Token media** — image upload only; no video. Bread-controlled provider-neutral upload. Accept PNG/JPEG/WebP up to 5 MB; reject SVG and non-image payloads; verify content bytes/MIME, decode server-side, strip unsafe metadata, resize/cache canonical variants and return a canonical HTTPS media reference. Arbitrary remote URLs are not trusted image content. Invalid/unavailable media uses the deterministic fallback.

5. **Recent Search** — browser-local only. Last 8 successfully selected Search targets, deduplicated by canonical identity, newest-first, removable/clearable. No wallet/account association, server sync or ranking authority.

6. **Trending Search** — populate token suggestions from Bread's canonical indexed Trending token feed in its existing order. Do not rank raw user search terms. No hidden paid placement. Do not create a second Trending algorithm.

7. **Token description/social projection** — project sanitized display metadata through the indexer/API: image reference, plain-text description, website, X and Telegram when supplied and valid. Metadata remains separate from finance state. Never render arbitrary HTML; invalid/unavailable values are omitted.

8. **Legal structure** — maintain Terms, Privacy and Risks routes. Final public copy must use Bread's real operator identity, jurisdiction, eligibility/restricted-country policy, contact details and actual analytics/data-processing behavior. Engineering may prepare route structure and factual placeholders, but cannot mark legal copy release-ready until those facts are supplied/approved.

## Cross-layer rules

- 06B remains controlling: sanitized metadata is separate from finance state; API is read-only for protocol financial actions; no derived DB/frontend state becomes a competing source of truth.
- Any market-cap, lifecycle or metadata schema addition updates canonical shared types/fixtures and at least one real consumer compatibility test.
- Cursor pagination remains deterministic under explicit sorts.
- Trending Search reuses the existing canonical Trending feed boundary rather than duplicating feed logic in the web client.
- Media processing may degrade before transaction-critical state under overload and may not weaken transaction correctness.

## Non-goals

- No protocol/economics/custody/admin/transaction-construction change.
- No video or SVG media.
- No creator reputation, trust score, comments, referrals, leaderboards or alerts.
- No search-frequency Trending algorithm or hidden sponsorship.
- No arbitrary frontend lifecycle threshold such as `80% = Almost Baked`.
- No duplicated market-cap formula in UI components.
- No final legal claims without real operator/legal facts.
- No weakening of 04D accessibility, performance, CSP, malicious-metadata, recovery or physical-device gates.

## Ratification gate

```text
PROJECT_SOURCE_PACK_PROPOSED = v1.6.1-pre-rc-ui-gap-closure
USER_DECISION_STATUS = APPROVED_IN_CHAT
PROJECT_SOURCE_UPLOAD = PENDING_USER_UPLOAD / REPLACEMENT
PROJECT_SOURCE_RATIFICATION = PENDING
AFFECTED_PRODUCTION_IMPLEMENTATION = BLOCKED_UNTIL_UPLOAD + ACTIVE-CHAT_READBACK + GIT/YAML_RECONCILIATION
DAY9 / RC = STILL INCOMPLETE
```

After upload/readback reconciliation, execute each area as bounded RED → GREEN slices under 06D, rerun focused + adjacent + security + performance/load + browser evidence, keep PR #94 draft/open/unmerged, and preserve the physical-device blocker.
