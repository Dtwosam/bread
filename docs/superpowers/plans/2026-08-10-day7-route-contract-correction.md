# Day 7 Implementation-Plan Corrections

**Status:** CONTROLLING CORRECTION to `docs/superpowers/plans/2026-08-10-day7-public-web.md`.

These corrections keep the written plan aligned with the frozen 04A–04D source contract and the accepted repository implementation shape. They do not redesign Bread or alter Day-7 product/protocol semantics.

## Task 1 implementation-path correction

The original Task-1 file list used `.tsx` suffixes for the framework-light `packages/ui` primitives and the focused test. The implementation deliberately uses `React.createElement` without JSX, so the actual owning paths are `.ts`:

- `packages/ui/src/button.ts`
- `packages/ui/src/card.ts`
- `packages/ui/src/navigation.ts`
- `packages/ui/src/states.ts`
- `tests/day7/ui-foundation.test.ts`

The focused Task-1 command is therefore:

`pnpm exec vitest run tests/day7/ui-foundation.test.ts`

The root `package.json` did not require a Task-1 change because the existing pinned Vitest/tooling scripts already owned the required test execution. This supersedes only the stale Task-1 path/command placeholders in the original plan.

## Task 6 route-contract correction

### Source reconciliation

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

### Corrected Task 6 boundary

The original Task-6 line that proposed:

`apps/web/app/create/review/page.tsx`

is superseded and MUST NOT be implemented.

Task 6 instead keeps `/create` as the canonical route and composes the source-defined form -> review -> transaction -> success states within that route (or route-local components/state), for example:

- `apps/web/app/create/page.tsx`
- `apps/web/components/create/token-form.tsx`
- `apps/web/components/create/launch-review.tsx`
- `apps/web/components/create/launch-success.tsx`

The browser may preserve review state in normal component/query/local recovery state where needed, but must not introduce a new public route absent from 04A/04C.

### Regression rule

Before the Create lane can PASS, its source-conformance test must prove that the public route implementation has not added `/create/review` or another invented Create/Review route.
