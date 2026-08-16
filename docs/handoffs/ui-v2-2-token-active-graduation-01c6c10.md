# UI/UX v2.2 — Active Token graduation/baked progress acceptance

Status: ACCEPTED SUB-SLICE — Token / Trade lane remains open
Date: 2026-08-16
Accepted code-bearing head: `01c6c10ac357453d77e942ff667ba026671dea1a`
PR: #94 (`agent/ui-ux-v2-2-implementation`, draft/open/unmerged)

## Source-backed contract

Ratified v2.2 and 04A require the active bonding Token graduation module to present user-facing baked progress, accumulated USDC, the snapshotted graduation target, and the amount remaining. Percentage copy uses normal one-decimal percentage formatting. Graduation/progress is not a safety endorsement.

The accepted indexed authority is the existing canonical projection: `graduation_progress_bps = real_quote_reserve * 10000 / graduation_threshold`, clamped to 10000. The primary Token detail already exposes `curveState.realQuoteReserve`, `graduationThreshold`, and the canonical progress summary. `trackedQuote` is not used as the active baked-progress accumulated-value authority.

## RED

Test-only head: `71c2ba3ce4731bfd761abda5a25daedba3cbaaec` (static RED introduced at parent `b8c5d7b62c2b8eb860b346c1d498c1d90d799b19`).

- Token owner run `31952642142`: 16 retained tests passed / only the new active baked-progress contract failed because `GraduationModule` did not use `realQuoteReserve`.
- Primary desktop/mobile browser run `31952654344`: 61 retained journeys passed / only desktop + mobile `token-active-graduation.spec.ts` failed, both at missing exact `42.0% baked`.
- Browser contract also required the primary indexed Token read, no Holder-analytics request for this surface, and zero raw RPC.

## Minimum GREEN

Code head: `01c6c10ac357453d77e942ff667ba026671dea1a`.

Only `apps/web/components/token/graduation-module.tsx` changed in production for this slice.

For canonical Active state it now renders:

- `42.0% baked` from the existing canonical progress bps;
- `Accumulated` from `curveState.realQuoteReserve`;
- `Snapshotted target` from `graduationThreshold`;
- `Remaining` from exact non-negative `graduationThreshold - realQuoteReserve` base-unit arithmetic.

The existing active-state identity (`Active · Indexed state ...`), progress track, transaction recovery, and non-active Processing/Pending/Graduated rendering paths remain otherwise unchanged. This slice does not define an Almost-Baked threshold and does not claim Processing/Pending/Graduated v2.2 treatment complete.

## Exact-head verification

All listed evidence is on `01c6c10ac357453d77e942ff667ba026671dea1a`:

- Root CI: `31953224240` PASS
- Token page consumer contract: `31953224252` PASS
- Primary desktop/mobile browser: `31953224253` PASS
- Trade lifecycle: `31953224223` PASS
- Wallet/network: `31953224238` PASS
- Explore/Search regression: `31953224231` PASS
- Indexed-read boundary: `31953224236` PASS
- Shared API types: `31953224235` PASS
- Production gates: `31953224257` PASS
- Frontend security: `31953224208` PASS
- Rebuild/reconcile: `31953224215` PASS
- Cross-browser probe: `31953224193` PASS
- 10k hot-launch capacity: `31953224248` PASS
- Service rollback: `31953224226` PASS
- Failure recovery: `31953224195` PASS
- Day-9 recovery drills: `31953224198` PASS
- Release browser matrix: `31953224242` PASS
- Day-9 truthfulness gate: `31953224221` PASS while retaining the external physical-device blocker

## Continuity / unresolved work

This acceptance does **not** close the Token / Trade major lane and does not close Explore/Search Lane 3.

Token / Trade still explicitly tracks Processing/Pending graduation treatment, graduated-token treatment, chart surface, desktop trade panel v2.2, mobile trading, degraded/loading/error/recovery states, wallet/network states, responsive closure, accessibility, performance and final visual/browser evidence.

Explore/Search Lane 3 remains open for its previously recorded authoritative-source/security blockers, including market-cap authority, undefined sort semantics, incomplete New/Active/Almost-Baked lifecycle semantics, Search image proxy/cache/SSRF/IPFS policy, and undefined Recent/Trending Search persistence/ranking semantics.

Final Day-9 release remains blocked by the final redesigned-candidate responsive/accessibility/performance/load/browser/device evidence. No RC tag is authorized and Day 10 has not started.

## NEXT_ACTION

Before the next Token / Trade implementation slice, re-read the relevant ratified Project Sources and owning interfaces. A source-backed candidate is the canonical Processing/Pending/Graduated graduation-state treatment; it must be split/bounded so accepted active progress and transaction-recovery behavior are not reopened. Verify RED before production code, implement the minimum GREEN, then run focused + adjacent + browser/accessibility/performance/load/recovery exact-head evidence as required.
