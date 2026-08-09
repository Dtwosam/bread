# Day 7 Route-Contract Correction

**Status:** CONTROLLING CORRECTION to `docs/superpowers/plans/2026-08-10-day7-public-web.md`.

This correction changes only the Task-6 file/route interpretation. It does not redesign Bread or alter the rest of the Day-7 plan.

## Source reconciliation

04A/04C freeze these public routes for the relevant create flow:

- `/`
- `/explore`
- `/token/:address`
- `/create`
- `/portfolio`
- `/creator`
- `/profile/:address`
- `/activity`
- `/stats`
- `/docs`
- `/legal/terms`
- `/legal/privacy`
- `/legal/risks`

Search is a desktop overlay/mobile full-height surface, not a `/search` route. Launch Review is a required **screen/state inside the Create flow**, not authority to add `/create/review`.

## Corrected Task 6 boundary

The original Task-6 line that proposed:

`apps/web/app/create/review/page.tsx`

is superseded and MUST NOT be implemented.

Task 6 instead keeps `/create` as the canonical route and composes the source-defined form -> review -> transaction -> success states within that route (or route-local components/state), for example:

- `apps/web/app/create/page.tsx`
- `apps/web/components/create/token-form.tsx`
- `apps/web/components/create/launch-review.tsx`
- `apps/web/components/create/launch-success.tsx`

The browser may preserve review state in normal component/query/local recovery state where needed, but must not introduce a new public route absent from 04A/04C.

## Regression rule

Before the Create lane can PASS, its source-conformance test must prove that the public route implementation has not added `/create/review` or another invented Create/Review route.
