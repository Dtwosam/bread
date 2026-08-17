# UI/UX v2.2 — Token Pending Graduation Acceptance

Accepted code-bearing head: `bc18035ce4a37e1dfff2e2c5c8850b31cd61971a`

## Bounded source contract

This slice implements only the ratified v2.2 failed-auto-graduation public state:

- label the state **Graduation pending**;
- preserve the already-completed threshold-crossing trade as confirmed;
- preserve the permissionless/authorized graduation retry path;
- never present the whole trade as failed;
- do not reopen accepted active reserve-backed baked progress or graduated routing.

The production change is limited to `apps/web/components/token/graduation-module.tsx`: the failed-auto-graduation display state changed from `Pending` to `Graduation pending`. Retry routing, transaction construction, recovery copy, active progress and graduated routing were unchanged.

## RED evidence

Test-only RED head: `d36c925ea47cbc440322b7ec0d4e0d369f7596bc`.

- Token page run `31953667793`: 17 retained assertions passed and exactly one expected failure proved the missing `Graduation pending` label.
- Primary desktop/mobile browser run `31953667922`: 61 retained journeys passed; exactly the desktop and mobile Pending-label cases failed.
- The RED already proved completed-trade confirmation and retry visibility remained present.

## Exact-head GREEN / regression evidence

All evidence below is on `bc18035ce4a37e1dfff2e2c5c8850b31cd61971a`:

- root CI / validate / tests / typecheck / build / infrastructure: `31956520566` — PASS
- Token page consumer contract: `31956520530` — PASS
- primary desktop/mobile Playwright: `31956520516` — PASS
- trade lifecycle: `31956520560` — PASS
- wallet/network: `31956520484` — PASS
- Explore/Search: `31956520567` — PASS
- indexed-read boundary: `31956520558` — PASS
- shared API types: `31956520532` — PASS
- production gates: `31956520512` — PASS
- frontend security: `31956520504` — PASS
- rebuild/reconcile: `31956520483` — PASS
- cross-browser Firefox/WebKit probe: `31956520523` — PASS
- 10k hot-launch capacity: `31956520497` — PASS
- service rollback: `31956520493` — PASS
- failure recovery: `31956520514` — PASS
- Day-9 recovery drills: `31956520482` — PASS
- release browser matrix Chromium/Firefox/WebKit + manifest restoration: `31956520472` — PASS
- Day-9 truthfulness gate: `31956520486` — PASS with the external physical-device blocker retained

## Scope boundary

This acceptance does **not** close the Token/Trade major lane. The following remain independently tracked: Processing/`Graduating`, graduated-token treatment, chart, desktop TradePanel v2.2, mobile trading, degraded/loading/error/recovery states, wallet/network closure, responsive closure, accessibility, performance and final visual/browser evidence.

Explore/Search Lane 3 also remains open with its recorded source/security decisions unresolved.

Before any next implementation slice, re-read the relevant ratified Project Sources and owning interfaces. Do not infer the next lifecycle behavior from this slice.
