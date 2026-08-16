# UI/UX v2.2 — Token primary Holder stat acceptance

Status: ACCEPTED SUB-SLICE — Token / Trade lane remains open
Date: 2026-08-16
Accepted code-bearing head: `5ca948568e7b5c24f652ef2fb5beaba979c1abbd`
PR: #94 (`agent/ui-ux-v2-2-implementation`, draft/open/unmerged)

## Source-backed contract

- Ratified UI/UX v2.2 requires Holders in the active Token market-stats row.
- The canonical primary token read already exposes indexed `holderCount` through `GET /v1/tokens/:address`.
- Initial Token interactivity must not wait for heavy Holder analytics. The primary stat therefore consumes `IndexedTokenDetail.holderCount`; it does not load `/v1/tokens/:address/holders` and does not issue raw RPC.
- Unknown holder count remains visibly unavailable as `—`; no client-side holder computation or classification is introduced.

## RED

Test-only head: `52febd26ba58e2d9e858ed0e59766164676bca33`

- Day-7 Token consumer-contract run `31949805101`: expected failure. The new assertion alone failed because `TokenStats` still contained `['Holders', '—']`.
- Primary desktop/mobile browser run `31949805061`: expected failure. Playwright summary was 2 failed / 59 passed / 19 skipped; only desktop/mobile `token-holder-count.spec.ts` failed because exact holder value `42` was absent.
- Browser contract also requires the primary indexed token request, forbids the heavy `/holders` analytics request for this stat, and forbids raw RPC.

## Minimum GREEN

Code head: `5ca948568e7b5c24f652ef2fb5beaba979c1abbd`

Only the owning Token stat changed:

`['Holders', token.holderCount ?? '—']`

No API, DB, query-key, holders-tab, transaction, protocol, economics or RPC behavior changed.

## Exact-head verification

All listed evidence is on `5ca948568e7b5c24f652ef2fb5beaba979c1abbd`:

- Root CI: `31951696034` PASS
- Token page consumer contract: `31951696011` PASS
- Primary desktop/mobile browser: `31951696072` PASS
- Trade lifecycle: `31951696044` PASS
- Wallet/network: `31951696069` PASS
- Explore/Search regression: `31951696051` PASS
- Indexed-read boundary: `31951696077` PASS
- Shared API types: `31951696057` PASS
- Production gates: `31951696012` PASS
- Frontend security: `31951696070` PASS
- Rebuild/reconcile: `31951696043` PASS
- Cross-browser probe: `31951696038` PASS
- 10k hot-launch capacity: `31951696067` PASS
- Service rollback: `31951696025` PASS
- Day-9 recovery: `31951696015` PASS
- Release browser matrix: `31951696062` PASS
- Day-9 truthfulness workflow: `31951696019` PASS while retaining the external physical-device blocker

## Continuity / unresolved work

This acceptance does **not** close the Token / Trade major lane and does not close Explore/Search Lane 3.

Lane 3 remains open for previously recorded authoritative-source/security gaps, including market-cap authority, undefined sort semantics, incomplete New/Active/Almost-Baked lifecycle semantics, Search image proxy/cache/SSRF/IPFS policy, and undefined Recent/Trending Search persistence/ranking semantics.

Token / Trade still requires explicit tracked completion of the ratified sub-surfaces, including active-token treatment, graduation/pending variants, graduated-token treatment, desktop trading, mobile trading, degraded/loading/error/recovery states, wallet/network states, responsive closure, accessibility, performance, and final visual/browser evidence.

Final Day-9 release remains blocked by the required final redesigned-candidate verification, including physical/current branded-device evidence. No RC tag is authorized and Day 10 has not started.

## NEXT_ACTION

Before any new Token / Trade implementation slice, re-read the relevant ratified Project Sources and the owning interfaces. Select only a source-backed missing behavior, write and verify its expected RED, implement the minimum GREEN, then run focused + adjacent + responsive/browser/accessibility/performance + affected 06I load and exact-head CI evidence as required. Do not infer missing financial/lifecycle/sort semantics and do not reopen accepted behavior without a demonstrated regression.
