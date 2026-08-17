# Bread v1.6.1 Gap-Closure Conformance & Exact-Head Closure Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ratify the uploaded `v1.6.1-pre-rc-ui-gap-closure` source amendment, audit the already-written candidate against all eight frozen decisions, repair only demonstrated divergences, and establish fresh exact-head automated evidence without weakening Day-9 external release gates.

**Architecture:** Preserve the existing PR #94 candidate and treat it as recovery-era candidate code written before final Project Source upload. The controlling v1.6.1 amendment owns market-cap authority, explicit sorts, indexed lifecycle classification, image-only media, Recent Search, Trending Search, sanitized display metadata, and legal-route structure. Verification remains cross-layer: indexer/read API/shared types/web consumer plus browser/load/security evidence.

**Tech Stack:** TypeScript, Next.js/React, Fastify, PostgreSQL, pnpm, Vitest, Playwright, GitHub Actions.

## Global Constraints

- Keep PR #94 draft/open/unmerged.
- No RC tag, no Day-9 PASS claim, and no Day 10 while mandatory gates remain open.
- Do not touch `/tmp/bread-synthra-fork-proof`.
- No Solidity, protocol economics, supply, custody, graduation mechanics, Arc/USDC identity, admin authority, transaction construction, DEX routing, or financial-ledger changes.
- No JavaScript floating-point market-cap formula; one indexed exact value is authoritative.
- Trending Search reuses the canonical Trending feed; Recent Search remains browser-local only.
- Media is PNG/JPEG/WebP only, max 5 MB, server-decoded/sanitized, with canonical HTTPS references; SVG/video/arbitrary remote trust are excluded.
- Final legal copy remains externally blocked until real operator/jurisdiction/eligibility/contact/data-processing facts are supplied and approved.
- A pre-existing candidate may be preserved only after source-to-code conformance review; exact-head PASS requires fresh command/workflow evidence.

---

### Task 1: Ratification and Continuity Synchronization

**Files:**
- Modify: `docs/source-amendments/ui-v2-2-gap-closure-v1.6.1.md`
- Modify: `docs/current-build-state.yaml`
- Create: `docs/superpowers/plans/2026-08-17-v161-gap-closure-conformance.md`

**Interfaces:**
- Consumes: uploaded Project Source `v1.6.1-pre-rc-ui-gap-closure`, CURRENT-BUILD-STATE v1.9, PR #94 head/base.
- Produces: explicit `PROJECT_SOURCE_RATIFICATION = RATIFIED` workflow state and a frozen candidate head for conformance verification.

- [ ] **Step 1: Record uploaded/read-back source ratification**

Update the repository amendment status to `RATIFIED` and record that the uploaded Project Source matches the repository note on all eight frozen decisions.

- [ ] **Step 2: Synchronize the machine-readable handoff**

Bump `docs/current-build-state.yaml`, replace the resolved semantic-gap blocker with `V1_6_1_CANDIDATE_CONFORMANCE_AND_EXACT_HEAD_CI`, retain physical-device/legal/public-mainnet blockers, and preserve the prior exact verified `b60318ef...` baseline as historical evidence rather than current candidate acceptance.

- [ ] **Step 3: Commit one docs-only ratification checkpoint**

Expected commit message:

```text
docs(source): ratify v1.6.1 gap-closure source
```

This commit must not claim the candidate is verified.

---

### Task 2: Source-to-Code Conformance Audit

**Files:**
- Inspect: `packages/db/src/repositories/trades.ts`
- Inspect: `packages/db/src/repositories/explicit-sort.ts`
- Inspect: `packages/db/src/repositories/lifecycle.ts`
- Inspect: `apps/api/src/media/token-image.ts`
- Inspect: `apps/api/src/routes/media.ts`
- Inspect: `apps/web/lib/search/recent-targets.ts`
- Inspect: `apps/web/components/search-surface.tsx`
- Inspect: `apps/api/src/display-metadata.ts`
- Inspect: `apps/api/src/routes/token.ts`
- Inspect: `apps/web/components/token/token-identity.tsx`
- Inspect: legal route files/tests discovered in the current tree.
- Test: `tests/day6/market-cap-authority.test.ts`
- Test: `tests/day6/explicit-feed-sort.test.ts`
- Test: `tests/day6/search-lifecycle-db.test.ts`
- Test: `tests/day7/token-media-gap-closure.test.ts`
- Test: `tests/day7/token-media-runtime.test.ts`
- Test: `tests/day7/recent-search-gap-closure.test.ts`
- Test: `tests/day7/trending-search-gap-closure.test.ts`
- Test: `tests/day7/token-metadata-gap-closure.test.ts`

**Interfaces:**
- Consumes: the eight frozen v1.6.1 decisions.
- Produces: a written conformance verdict per area; code changes only if a concrete source divergence is demonstrated.

- [ ] **Step 1: Verify each existing RED/GREEN history maps to the ratified requirement**

Expected historical pairs include market-cap `6bf138b... -> a97669d...`, sorts `0e95d0b... -> ff56632...`, lifecycle `15d9778... -> 9687107...`, media `4f5ce27... -> 9681dd9...`, Recent `88146cd... -> 433bda9...`, Trending `7dc352a... -> 63e264a...`, and metadata `4112438... -> 3acbcbd...` plus downstream wiring.

- [ ] **Step 2: Run the focused source tests through exact-head CI**

The exact-head workflow runs the full Day-6 and Day-7 suites, which include the above focused guards. A syntax/config/harness failure is not accepted as a RED or product defect.

- [ ] **Step 3: Repair only demonstrated divergence**

If a test exposes a source mismatch, reproduce it in the smallest owning test and change only the owning subsystem. No unrelated refactor or semantic expansion is allowed.

---

### Task 3: Integrated Exact-Head Verification

**Files:**
- Execute: `.github/workflows/v161-gap-closure-exact-head.yml`
- Evidence output on success: `docs/evidence/v1.6.1-gap-closure-exact-head.md`

**Interfaces:**
- Consumes: the ratified candidate head.
- Produces: immutable software-head evidence for source/static/type/build/indexed-read/frontend/load/browser gates.

- [ ] **Step 1: Run source/static/type/build gates**

Exact workflow commands:

```bash
pnpm install --frozen-lockfile
pnpm validate
pnpm typecheck
pnpm exec prettier --check apps/api/src/display-metadata.ts apps/api/src/routes/token.ts apps/api/src/routes/types.ts apps/api/src/server.ts apps/indexer/src/reducers.ts apps/web/components/search-surface.tsx apps/web/components/token/token-identity.tsx packages/types/src/api.ts packages/types/src/index.ts tests/day7/explore-search-v2-closure.test.ts tests/day7/token-metadata-gap-closure.test.ts
pnpm build
```

- [ ] **Step 2: Run indexed/read and frontend regressions**

```bash
docker compose -f infra/docker/compose.yaml up -d --wait --wait-timeout 60
BREAD_DB_INTEGRATION=1 BREAD_DATABASE_URL=postgresql://bread:bread_local_only@127.0.0.1:5432/bread pnpm test:day6
pnpm exec vitest run tests/day7
```

- [ ] **Step 3: Run concentrated load and release browsers**

```bash
pnpm load:hot-launch
pnpm --filter @bread/web exec playwright install --with-deps chromium firefox webkit
pnpm --filter @bread/web exec playwright test
```

- [ ] **Step 4: Inspect ordinary affected workflows on the exact candidate**

Require fresh successful evidence from root CI and relevant Day-6/Day-7/security/production/browser/load/recovery workflows. `action_required` with zero jobs is an execution/approval state, not a passing test.

- [ ] **Step 5: Debug any real failure systematically**

Read job steps/logs, identify the first causal failure, distinguish harness/config from product behavior, then apply the minimum correction and rerun affected plus adjacent gates.

---

### Task 4: Durable Closure Handoff

**Files:**
- Modify: `docs/current-build-state.yaml`
- Modify: `docs/source-amendments/ui-v2-2-gap-closure-v1.6.1.md` only if evidence-state wording requires synchronization.
- Modify: PR #94 description.
- Consume: `docs/evidence/v1.6.1-gap-closure-exact-head.md` if generated.

**Interfaces:**
- Consumes: fresh exact-head green evidence.
- Produces: a resumable Day-9 handoff tied to the exact software SHA and workflow run IDs.

- [ ] **Step 1: Record exact verified software head and run IDs**

Do not overwrite historical b60318ef evidence; record v1.6.1 as a later verified candidate only when the fresh gates actually pass.

- [ ] **Step 2: Update PR #94 truthfully**

State v1.6.1 source ratification, the exact software/evidence SHA, implemented gap-closure scope, and still-open physical-device/legal/public-mainnet gates. Keep the PR draft/open/unmerged.

- [ ] **Step 3: Preserve release blockers**

Keep `PHYSICAL_DEVICE_EXTERNAL_EXECUTION_REQUIRED`, `APPROVED_LEGAL_COPY`, `BREAD_PRODUCTION_ECONOMICS_CONFIG`, `PONS_AUDIT_FINDINGS`, and `ARC_MAINNET_VALUES` open as applicable. Reference/parity gaps remain truthfulness constraints.

- [ ] **Step 4: Final truthfulness check**

No Day-9 PASS, RC tag, merge, or Day-10 start is permitted from software-only automation while mandatory external gates remain open.
