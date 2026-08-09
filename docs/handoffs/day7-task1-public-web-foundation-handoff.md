# Bread Day 7 Task 1 — Public Web Foundation Durable Handoff

Status: `DAY7_TASK1_PUBLIC_WEB_FOUNDATION_INTEGRATED_PASS_DURABLE`

This document becomes the controlling durable Task-1 handoff when PR #60 is exact-head green and merged to `main`.

## Verified predecessor

- Day-6 durable closeout / Day-7 start baseline: `9c9012db9f2fe607edc6e668a2fa19d34f925e87`
- Day-6 remains closed. This handoff does not reopen any Day-6 scope.

## Task-1 implementation

- Implementation PR: #59
- Final exact implementation head: `feb5ce08c03d2e51b1813f30e94c5fbb5add3dba`
- Guarded squash merge: `1e5d3537f22dbdb969e50da009c641b94f35a656`
- Durable handoff PR: #60
- Branch: `agent/day7-public-web-foundation`

Implemented from frozen 04A–04D:

- exact 04B semantic color, typography, spacing, radius, breakpoint, motion and control geometry tokens;
- build-time self-hosted Inter + Geist Mono integration;
- reusable Button/Card/navigation/loading/empty/error primitives;
- explicit focus/pressed/loading/disabled behavior and stable loading-button geometry;
- responsive 64px desktop header, 32/24/16px gutters, 1440px max width, 56px mobile top bar and 64px + safe-area bottom navigation;
- source-defined desktop/mobile navigation destinations;
- bootstrap page replaced only with the Explore shell heading; no fabricated feed/token data;
- Day-7 plan committed and corrected so Search remains an overlay/surface and Launch Review remains inside `/create`, not a new route.

## Meaningful RED evidence

- `31341270239`: missing design foundation only.
- `31341715167`: missing 44px touch-target contract only.
- `31341935378`: missing technical-font/control-geometry contract only.
- `31342095678`: loading-width preservation and pressed-state behavior only.

No syntax/config/setup failure was accepted as RED.

## Final exact-head proof for implementation PR #59

Exact head: `feb5ce08c03d2e51b1813f30e94c5fbb5add3dba`

- root CI `31342250098` — PASS
- Day-7 Task-1 `31342250101` — PASS
- retained Day-6 Task 5 `31342250150` — PASS
- retained Day-6 Task 6 `31342250124` — PASS
- retained Day-6 Task 7 `31342250123` — PASS
- retained Day-6 Task 8 `31342250096` — PASS
- retained Day-6 Task 9 `31342250106` — PASS
- retained Day-6 Task 10 `31342250120` — PASS

Root CI included repository validation, bootstrap tests, full tests, full Day-6 suite, strict shared type assertion, source-integrity/format checks, TypeScript typecheck, workspace production build, clean-tree verification, Foundry compile/tests, generated ABI drift check, PostgreSQL/Redis health and Day-6 PostgreSQL integration.

## Source/design review

`DAY7_TASK1_SOURCE_DESIGN_REVIEW = PASS`

- no protocol/economics/ABI/address/domain duplication;
- no raw-RPC primary UX;
- no API financial write authority or transaction relay;
- no guessed production/mainnet values;
- no invented public route;
- no fake feed/token state;
- Search and wallet action wiring remain intentionally owned by later lanes;
- mobile Buy/Sell 48px transaction composition remains owned by the Trade lane; Task 1 only freezes the shared control token.

## Canonical interfaces produced

Later Day-7 lanes consume:

- `@bread/ui` exports: `breadTheme`, `Button`, `Card`, `Navigation`, `MobileNavigation`, `Skeleton`, `EmptyState`, `ErrorState`;
- `@bread/ui/theme.css` semantic CSS variables and global primitive classes;
- the responsive `apps/web` application shell;
- `docs/superpowers/plans/2026-08-10-day7-public-web.md` plus its corrections document.

No later lane may create private copies of these theme/navigation semantics.

## Next safe action

Once PR #60 is present on `main`, begin **Day 7 Task 2 — indexed read client/query/freshness/degraded-state boundary** from the freshly verified latest `main` descendant.

Task 2 must consume the accepted Day-6 read API/types and Task-1 UI foundation. Its first RED must prove the missing canonical `/v1` browser read boundary: typed `IndexedResponse<T>`/`FreshnessMeta` propagation, typed API errors, bounded query serialization, deduplicated query keys, explicit FRESH/LAGGING/REBUILDING/DEGRADED states, and no raw-RPC primary rendering path.

Do not start Explore/Search implementation before that read boundary is integrated.
