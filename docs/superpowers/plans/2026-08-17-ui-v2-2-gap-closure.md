# Bread UI/UX v2.2 — Source-Constrained Software Closure Plan

> Status: execution plan only. This file is not Project Source authority. Ratified Project Sources and canonical repository interfaces outrank it.

## Controlling rule

Implement only semantics defined by the ratified v1.6 Project Source pack or an already-canonical repository interface that does not conflict with it. If a required v2.2 field/group exists but its value, ranking, persistence, security, or classification semantics are not defined, leave it unavailable/blocked and record the gap rather than inventing behavior.

Creator attribution remains the canonical onchain deployer.

## Accepted source-backed software work

- Explore feeds: New, Trending, Almost Baked, Graduated.
- Explore filters already backed by canonical repository semantics: Age, Holders, Baked progress, Creator wallet, trailing-24h volume.
- Search: exact contract match, token results, creator/wallet results, keyboard navigation/focus return, indexed holder count/age and canonical graduation-state labels.
- Token/Search media: reserve the v2.2 image slot and use the deterministic local fallback while no approved remote media/storage/proxy authority exists.
- Token/Trade: source-backed lifecycle, stat ordering, review/recovery, Buy MAX current gas reserve, mobile trade flow and wallet/network states already accepted by focused evidence.
- Create: source-defined Token -> Economics -> Review -> Success staging.
- Portfolio/Creator: source-backed holdings, creator dashboard and canonical FeeEscrow claim flow.
- Secondary Activity/Stats: only canonical indexed launches/trades/graduations and reliable lifetime indexed totals; no invented analytics.

## Explicit source/interface gaps — do not implement by inference

### Market cap value authority

UI/UX v2.2 requires market-cap display/filter/sort, but the ratified sources and canonical repository do not define the authoritative market-cap value/formula. Therefore:

- keep market-cap presentation explicit as unavailable (`—`) where required;
- do not compute `price * supply` or any alternative formula;
- do not activate market-cap filtering/sorting until the value authority is ratified;
- nullable DB/schema fields do not by themselves establish semantic authority.

### Sort semantics

Allowed sort names are specified, but direction/default/tie-break/window semantics are not. Do not invent them.

### Full lifecycle classification

Canonical repository state supports definitive Processing / pending auto-graduation / Graduated states plus accepted feed membership. Do not infer New/Active/Almost-Baked classification thresholds beyond ratified/canonical behavior.

### Search — Recent searches

The group name is required by v2.2, but storage location, retention, ordering, deduplication, limits and clearing behavior are not defined. Do not assume localStorage, an eight-item limit, or wallet-scoped persistence.

### Search — Trending searches

The group name is required by v2.2, but query-ranking/authority semantics are not defined. Do not equate Explore Trending tokens with Trending Search suggestions and do not invent query telemetry.

### Token media provider

The interface requires token imagery and 04D requires safe resized/cached handling, but upload/storage/proxy/IPFS/SSRF policy is not frozen. Keep deterministic fallback slots; do not introduce a provider or arbitrary remote image fetch.

### Legal copy and missing projections

Approved legal copy, token description/social projection, and any other absent aggregate/read projection remain external/source dependencies. Do not fabricate them.

## Current repair sequence

1. Keep the source-conformance RED proving unsupported Recent/Trending Search behavior and market-cap formula are present.
2. Remove only the invented semantics and any tests/CI that institutionalize them.
3. Preserve source-backed Activity/Stats and all previously accepted UI/transaction behavior.
4. Run focused Explore/Search and trade tests, then adjacent production gates, type/build, Playwright, security, load/recovery/browser workflows on one exact head.
5. Correct any genuine regression through RED -> GREEN TDD.
6. Update PR #94 evidence and continuity state only after the unified software head is exact-head green.

## Release boundary

PR #94 stays draft/open/unmerged. No RC tag, no Day 10, and no Day-9 PASS while mandatory software gates or the external physical/current-device matrix remain open.
