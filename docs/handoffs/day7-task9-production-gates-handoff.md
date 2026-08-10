# Day 7 Task 9 — Responsive, Accessibility, Performance and Frontend-Security Convergence — Durable Handoff

Date: 2026-08-10

## Verdict

`DAY7_TASK9_RESPONSIVE_ACCESSIBILITY_PERFORMANCE_FRONTEND_SECURITY_CONVERGENCE_INTEGRATED_PASS_DURABLE`

This docs-only candidate records the Task-9 verdict. It becomes authoritative only after its exact head passes the required root, Day-7 and retained Day-6 continuity gates, is guarded-merged, and the resulting `main`, `docs/current-build-state.yaml` and this handoff are freshly read back.

## Accepted implementation baseline

- Pre-Task-9 durable baseline: `892ea2d0952cdde138f5f53d0ef1473e4eb1fb4e`
- Implementation PR: `#80`
- Final audited implementation head: `7311da37bf546546686d0dd05a2767e763bb4170`
- Guarded merge on `main`: `6373eb2b70c339a0aff734bb8cc707469ea53aef`
- Merge title: `Merge Day 7 Task 9 production-gate convergence`

Fresh repository history after merge showed `6373eb2b70c339a0aff734bb8cc707469ea53aef` as actual `main` before this durability branch was created.

## Source contract preserved

Task 9 converged the integrated Day-7 Tasks 1–8 public web product against the frozen 04B–04D responsive, accessibility, performance and frontend-security requirements. It did not redesign accepted product journeys or reopen already-proven owners without evidence.

- Existing financial, SDK, ABI/address, canonical-config, wallet, transaction and recovery authorities remain unchanged.
- Indexed API reads and shared TanStack Query ownership remain the public read path; no raw-RPC primary UX or per-card RPC fanout was introduced.
- Existing Token chart/secondary-tab lazy loading and Task-8 wallet-menu lazy loading remain intact.
- No protocol economics, fee/creator-tax semantics, production values, mainnet values, Solidity behavior, API financial-write authority, server signing/relaying/custody or dependency/lockfile changes were introduced.
- Representative runtime CWV, load, failure-injection and browser/device release evidence remains in the later controlling Day-8/Day-9 gates; static Task-9 evidence is not represented as those later proofs.
- Provider-specific Sentry release correlation remains conditional on that connected service being present and is not falsely claimed by this lane.

## Task-9 audit and TDD evidence

### Original frontend-security RED → GREEN

The initial source audit demonstrated two real gaps:

1. no app-wide CSP/browser-security-header owner;
2. creator-supplied image/Website/X/Telegram metadata URLs entered canonical launch review without a shared URL-safety boundary.

RED head: `9ae115bcc6de32a0db16ab4ed580729b395fc613`

- Workflow `31403409561`
- retained affected assertions: **34 PASS**
- intended new assertions: **2 FAIL**

GREEN head: `0edfa6d61fdeee42b2a9712ca0a890868781cdfa`

- Workflow `31403832582`: PASS
- app-wide CSP + browser security headers added at the Next boundary;
- `normalizeExternalMetadataUrl` added as the shared creator-metadata boundary;
- only complete HTTP/HTTPS URLs accepted;
- unsafe schemes and embedded credentials rejected.

### 9-path / 7-file workflow discrepancy

The rollover discrepancy was a real coverage hole, not implicit coverage.

The Task-9 workflow named two stale/nonexistent positional filters:

- `tests/day7/ui-foundation.test.tsx` instead of `tests/day7/ui-foundation.test.ts`;
- `tests/day7/create-scope.test.tsx` instead of the retained Task-6 source-contract regression `tests/day7/create-review.test.tsx`.

Vitest ignored those unmatched filters, explaining the earlier seven-file summary.

Repair head: `cf421e473990504fbc8eb33d27f8833cfcc1d4fe`

- Workflow `31406705816`: **9 test files / 45 tests PASS**.

### Accessibility / mobile RED → GREEN

The continuing source audit demonstrated three additional gaps:

- Search had Escape handling but no keyboard focus containment/restoration;
- Create preparation/runtime errors were announced but not programmatically associated with the form;
- the mobile trade sheet could exceed the exact 04B `90dvh` expanded-height cap.

RED head: `ba95215655ca0d5af50e594a448d9bd432ca3171`

- Workflow `31407300701`: **45 retained PASS / exactly 3 intended FAIL**.

Minimum GREEN repairs:

- Search stores the invoking focus target, traps Tab/Shift+Tab within the dialog, handles Escape and restores focus after close;
- Create form uses a stable `aria-describedby` relationship to its live error;
- mobile trade sheet uses `min(90dvh, calc(100dvh - 56px - env(safe-area-inset-top)))`, retaining internal scrolling and bottom safe-area padding.

A later static assertion expected only the spelling `event.key === 'Tab'` while the correct implementation used the equivalent guard `event.key !== 'Tab'`. Workflow `31407597762` proved this was a test-contract false negative, not a production defect. The assertion was corrected without changing the already-correct focus behavior.

### Degraded route-state RED → GREEN

The audit also demonstrated no route-level owner for unexpected public-web route failures.

RED head: `3ac361b2b757340efe466d29ff2cf02dbbf5ccd7`

- Workflow `31407961425`: **48 retained PASS / exactly 1 intended FAIL**.

GREEN head: `f35f35308af09c9dd50edfadd8a51c2dd56e5a15`

- adds `apps/web/app/error.tsx`;
- exposes a safe retry action;
- exposes only the opaque Next digest/reference rather than raw exception text;
- does not imply any onchain rollback or server financial authority.

Workflow `31408064526`: **9 test files / 49 tests PASS**.

## Performance / bundle / request-ownership audit

The audit found no demonstrated reason to rewrite already-correct request or code-splitting owners:

- Token chart and secondary tabs remain dynamically loaded;
- wallet-specific menu UI remains dynamically loaded;
- public indexed reads continue through one shared QueryClient and canonical query-key space, preserving request deduplication;
- no per-card/raw-RPC primary web path was introduced;
- no operator/admin application import was found in the public web surface.

Final workflow head `7311da37bf546546686d0dd05a2767e763bb4170` adds production bundle-analysis evidence using the installed Next analyzer without inventing a byte budget. The analyzer generated `.next/diagnostics/analyze` successfully and the Task-9 gate fails if `apps/operator` or `@bread/operator` leaks into the public web module graph.

## Exact-head implementation evidence

Final implementation head: `7311da37bf546546686d0dd05a2767e763bb4170`

- Task-9 workflow `31408200323`: PASS — **9 files / 49 tests PASS**, production bundle analysis PASS, operator/admin leakage check PASS
- root CI `31408197408`: PASS
- Day-7 Task 1 `31408197395`: PASS
- Day-7 Task 3 Explore/Search `31408200301`: PASS
- Day-7 Task 3 shared API/types `31408200280`: PASS
- Day-7 Task 5 `31408197285`: PASS
- Day-7 Task 6 `31408197300`: PASS
- Day-7 Task 7 `31408197336`: PASS
- Day-7 Task 8 `31408197277`: PASS
- retained Day-6 Task 5 `31408197476`: PASS
- retained Day-6 Task 6 `31408197341`: PASS
- retained Day-6 Task 7 `31408197293`: PASS
- retained Day-6 Task 8 `31408200258`: PASS
- retained Day-6 Task 9 `31408197384`: PASS
- retained Day-6 Task 10 `31408197317`: PASS

## Final source / design / security review

PASS for Task-9 scope.

The final implementation diff was confined to:

- `.github/workflows/day7-task9-production-gates.yml`
- `apps/web/next.config.ts`
- `apps/web/lib/security/external-url.ts`
- `apps/web/components/search-surface.tsx`
- `apps/web/components/create/token-form.tsx`
- `apps/web/app/create/page.tsx`
- `apps/web/components/trade/trade.module.css`
- `apps/web/app/error.tsx`
- `tests/day7/production-gates.test.ts`

Review confirmed no protocol, economics, fee/creator-tax, canonical-config, ABI/address, SDK financial-semantics, API financial-write, wallet-authority, transaction-state/recovery, dependency/lockfile or mainnet-value change.

## External / release blockers — unchanged

- `CURRENT_PONS_FACTORY_SOURCE_PARITY`
- `PONS_V2_RUNTIME_REFERENCE`
- `BREAD_PRODUCTION_ECONOMICS_CONFIG`
- `PONS_AUDIT_FINDINGS`
- `ARC_MAINNET_VALUES`

Task 9 does not claim exact-current Pons parity, production economics finality, completed Pons audits, Arc mainnet publication or canonical Arc DEX deployment.

## Next safe lane after durable merge

**Day 7 Task 10 — Playwright primary journeys and integrated Day-7 closeout.**

Task 10 must consume the fully integrated Tasks 1–9 product and prove the frozen primary desktop/mobile journeys, transaction/degraded/recovery behavior and Day-7 end gate without feature invention. It may repair only demonstrated gaps through the same RED → GREEN discipline. It must not become a substitute for Day-8 stress/security/failure-injection work or Day-9 release/device rehearsal.

## Do not do

- Do not start Task 10 until this durability handoff is exact-head green, guarded-merged and actual `main` plus v1.46 are freshly verified.
- Do not reopen accepted Tasks 1–9 absent a demonstrated regression, genuine source conflict or newly ratified source change.
- Do not add a second wallet, transaction, recovery, API/domain, financial or canonical-config authority.
- Do not invent production economics, Arc mainnet values or canonical Arc DEX addresses.
- Do not route user-signed financial writes through Bread servers.
- Do not weaken later Day-8/Day-9 runtime security, load, CWV, device or recovery evidence gates.

## Durability condition

This handoff is complete only when:

1. `docs/current-build-state.yaml` advances additively from v1.45 to v1.46;
2. the exact docs-only handoff head passes root + affected Day-7 Tasks 1–9 + retained Day-6 Tasks 5–10 continuity gates;
3. the handoff PR is guarded-merged with expected-head protection;
4. resulting `main`, v1.46 and this handoff are freshly read back;
5. only then may Task 10 begin.
