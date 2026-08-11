# Day 9 Release Candidate & Rehearsal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the durable Day-8 integrated Bread launchpad into an evidence-backed Day-9 release candidate by reconciling the current Arc Testnet environment, proving clean deployment/recovery/rollback paths, running the supported browser/device/wallet/accessibility matrix, and freezing/tagging only an exact commit that satisfies every available Day-9 gate without inventing unresolved production values.

**Architecture:** Day 9 does not add product behavior. It layers release/rehearsal tooling and evidence around the already-integrated contracts, SDK, indexer, API and web application. The canonical Arc manifests remain authoritative; controlled local/CI fixtures may prove script and recovery behavior but may never be written into canonical network/deployment manifests or be represented as verified Arc DEX infrastructure.

**Tech Stack:** Solidity 0.8.26 + Foundry 1.5.0, TypeScript/Node 24.18.0, pnpm 11.15.1, PostgreSQL, Redis, Next.js, Fastify, Playwright 1.62.0, GitHub Actions, existing Bread deployment/indexer/operator scripts.

## Global Constraints

- Start baseline: `fe9b13f1ce271fd5423fdd76de13034dac18fee1` (`DAY_8_ATTACK_SYSTEM_INTEGRATED_PASS_DURABLE`).
- Day 9 is release-candidate/rehearsal work only; no feature invention, new economics, framework/database rewrite, or visual redesign.
- Chain remains authoritative for balances, fees, reserves, ownership and graduation; DB/indexer/API/Redis remain projections/operational aids.
- No server custody/signing/relaying for ordinary user Launch/Buy/Sell/Claim transactions.
- Canonical Bread finance remains 6-decimal ERC-20 USDC.
- Do not populate Arc mainnet values while official Arc docs still publish mainnet as unavailable/upcoming.
- Do not activate a canonical Arc V3/V4 adapter without independently verified official deployment evidence plus compatibility proof.
- `BREAD_PRODUCTION_ECONOMICS_CONFIG` remains a public/mainnet release gate. Local/CI rehearsal may use clearly marked deterministic test-only values; canonical deployment manifests may not silently adopt them.
- `CURRENT_PONS_FACTORY_SOURCE_PARITY` remains a truthfulness/reference gap. Current Pons documentation must not be used to rewrite accepted Bread Day-1–Day-8 semantics during Day 9.
- `PONS_AUDIT_FINDINGS` remains a continuing review gate. Absence of a newly located report is not an audit-clean claim.
- Guardian only increases restriction; Protocol Admin alone reduces/unpauses; durable production admin may not be a single EOA.
- Every rehearsal must retain exact command output, commit identity and manifests/config hashes where applicable.
- Any change after the RC freeze invalidates that RC and requires a new exact candidate commit plus the affected gates.
- Do not claim a physical device, wallet/in-app browser, live Arc deployment, monitoring provider, Vercel preview or Sentry release unless that exact environment actually executed.

## Verified Preflight Facts at Plan Freeze

- Actual `main` is exactly `fe9b13f1ce271fd5423fdd76de13034dac18fee1`.
- `config/networks/arc-testnet.json` has the correct chain ID (`5042002`), canonical 6-decimal ERC-20 USDC (`0x3600000000000000000000000000000000000000`), Permit2/Create2/Multicall3 values, but its RPC/WS endpoints use the older `rpc.testnet.arc.io` host.
- Current official Arc documentation publishes `https://rpc.testnet.arc.network` and `wss://rpc.testnet.arc.network`; this is an environment-config drift to reconcile before rehearsal.
- `config/networks/arc-mainnet.json` remains intentionally empty/`AWAITING_OFFICIAL_VALUES`.
- `config/networks/arc-testnet.json` keeps `dex.type = UNRESOLVED_TESTNET_ADAPTER` with null DEX addresses.
- `config/deployments/arc-testnet.day5.json` remains `BLOCKED_UNTIL_VERIFIED_DEX_AND_PRODUCTION_CONFIG`, has no deployed core addresses and no active adapter.
- Existing production-path deployment tools are already strict:
  - `contracts/script/DeployDay5Graduation.s.sol`
  - `scripts/day5/configure-graduation.mjs`
  - `scripts/day5/verify-graduation-deployment.mjs`
  - `scripts/day5/smoke-graduation.mjs`
- Existing recovery tooling already includes canonical indexer rebuild/reconcile CLI plus Day-8 RPC failover and catch-up owners.
- Existing Day-7 browser evidence covers Chromium primary journeys and bounded Firefox/WebKit support probes, but this is not yet the complete Day-9 physical/device/wallet release matrix.

---

### Task 1: Reconcile Arc Testnet environment identity before rehearsal

**Files:**
- Create: `tests/day9/arc-testnet-environment-reconciliation.test.ts`
- Modify: `config/networks/arc-testnet.json`
- Create: `.github/workflows/day9-lane1-environment-reconciliation.yml`
- Create: `docs/evidence/day9-environment-preflight.md`

**Interfaces:**
- Consumes: canonical network manifest loader under `packages/config/src/manifests.ts` and the existing network manifest schema.
- Produces: one source-aligned Arc Testnet manifest whose RPC/WS endpoints match current official Arc documentation while DEX remains explicitly unresolved.

- [ ] **Step 1: Write the failing manifest regression**

```ts
import { describe, expect, it } from 'vitest';
import arcTestnet from '../../config/networks/arc-testnet.json';
import arcMainnet from '../../config/networks/arc-mainnet.json';

describe('Day 9 Arc environment reconciliation', () => {
  it('uses the currently published Arc Testnet endpoints without inventing DEX/mainnet values', () => {
    expect(arcTestnet.chainId).toBe(5_042_002);
    expect(arcTestnet.rpc).toEqual(['https://rpc.testnet.arc.network']);
    expect(arcTestnet.websocket).toEqual(['wss://rpc.testnet.arc.network']);
    expect(arcTestnet.usdc).toEqual({
      address: '0x3600000000000000000000000000000000000000',
      decimals: 6,
      role: 'bread-financial-quote-asset',
    });
    expect(arcTestnet.dex).toEqual({
      type: 'UNRESOLVED_TESTNET_ADAPTER',
      poolManager: null,
      positionManager: null,
      factory: null,
    });
    expect(arcMainnet.status).toBe('AWAITING_OFFICIAL_VALUES');
    expect(arcMainnet.chainId).toBeNull();
    expect(arcMainnet.rpc).toEqual([]);
    expect(arcMainnet.usdc.address).toBeNull();
  });
});
```

- [ ] **Step 2: Run the RED**

Run:

```bash
pnpm exec vitest run tests/day9/arc-testnet-environment-reconciliation.test.ts
```

Expected: FAIL because the current Testnet RPC/WS host is `rpc.testnet.arc.io` rather than the current official `rpc.testnet.arc.network` host. No other assertion should fail.

- [ ] **Step 3: Apply the minimum environment correction**

Change only these two values in `config/networks/arc-testnet.json`:

```json
"rpc": ["https://rpc.testnet.arc.network"],
"websocket": ["wss://rpc.testnet.arc.network"]
```

Do not modify USDC, chain ID, DEX fields, mainnet fields, economics or deployment addresses.

- [ ] **Step 4: Run focused + manifest/source regressions**

```bash
pnpm exec vitest run tests/day9/arc-testnet-environment-reconciliation.test.ts
pnpm validate
pnpm test
```

Expected: PASS.

- [ ] **Step 5: Add a read-only live Arc Testnet probe to the lane workflow**

The workflow must install the pinned Foundry toolchain and run only read calls:

```bash
test "$(cast chain-id --rpc-url https://rpc.testnet.arc.network)" = "5042002"
code="$(cast code 0x3600000000000000000000000000000000000000 --rpc-url https://rpc.testnet.arc.network)"
test "$code" != "0x"
test "$(cast call 0x3600000000000000000000000000000000000000 'decimals()(uint8)' --rpc-url https://rpc.testnet.arc.network)" = "6"
```

Do not broadcast any transaction.

- [ ] **Step 6: Record bounded external evidence**

`docs/evidence/day9-environment-preflight.md` must record the exact official Arc URLs checked, the date, the exact Bread commit, and these dispositions:

```text
ARC_TESTNET_NETWORK_IDENTITY = VERIFIED_CURRENT_OFFICIAL_READ_SURFACE
ARC_TESTNET_DEX = UNRESOLVED_DO_NOT_ACTIVATE
ARC_MAINNET_VALUES = OPEN_OFFICIAL_PUBLICATION_BLOCKER
CURRENT_PONS_FACTORY_SOURCE_PARITY = OPEN_NON_BLOCKING_FOR_BREAD_REHEARSAL
PONS_AUDIT_FINDINGS = CONTINUING_WATCH_NO_AUDIT_CLEAN_CLAIM
```

- [ ] **Step 7: Commit**

```bash
git add config/networks/arc-testnet.json tests/day9/arc-testnet-environment-reconciliation.test.ts .github/workflows/day9-lane1-environment-reconciliation.yml docs/evidence/day9-environment-preflight.md
git commit -m "fix(day9): reconcile current Arc testnet endpoints"
```

---

### Task 2: Add an explicit Day-9 rehearsal-readiness gate

**Files:**
- Create: `scripts/day9/check-rehearsal-readiness.mts`
- Create: `tests/day9/rehearsal-readiness.test.ts`
- Create: `.github/workflows/day9-lane2-rehearsal-readiness.yml`

**Interfaces:**
- Consumes: `config/networks/<network>.json`, `config/deployments/<network>.day5.json` and the existing Day-5 configure/verify requirements.
- Produces: typed readiness output that prevents controlled/local fixture rehearsals from being mistaken for canonical Arc Testnet deployment evidence.

- [ ] **Step 1: Write RED tests for the current canonical manifests**

```ts
import { describe, expect, it } from 'vitest';
import { assessDay9RehearsalReadiness } from '../../scripts/day9/check-rehearsal-readiness.mts';

describe('Day 9 rehearsal readiness', () => {
  it('blocks canonical Arc Testnet deployment while DEX evidence is unresolved', () => {
    expect(assessDay9RehearsalReadiness({ network: 'arc-testnet', mode: 'CANONICAL' })).toMatchObject({
      ready: false,
      code: 'ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED',
    });
  });

  it('blocks Arc mainnet while official values remain absent', () => {
    expect(assessDay9RehearsalReadiness({ network: 'arc-mainnet', mode: 'CANONICAL' })).toMatchObject({
      ready: false,
      code: 'ARC_MAINNET_VALUES_REQUIRED',
    });
  });

  it('never upgrades a controlled fixture rehearsal into canonical readiness', () => {
    const result = assessDay9RehearsalReadiness({ network: 'arc-testnet', mode: 'CONTROLLED_FIXTURE' });
    expect(result).toMatchObject({
      ready: true,
      canonicalDeploymentClaim: false,
      productionMoneyClaim: false,
    });
  });
});
```

- [ ] **Step 2: Run the RED**

```bash
pnpm exec vitest run tests/day9/rehearsal-readiness.test.ts
```

Expected: FAIL because `scripts/day9/check-rehearsal-readiness.mts` does not exist.

- [ ] **Step 3: Implement the minimum typed guard**

The script must return only these status shapes:

```ts
export type Day9Readiness =
  | { ready: true; mode: 'CANONICAL'; canonicalDeploymentClaim: true; productionMoneyClaim: false }
  | { ready: true; mode: 'CONTROLLED_FIXTURE'; canonicalDeploymentClaim: false; productionMoneyClaim: false }
  | { ready: false; code: 'ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED' | 'ARC_MAINNET_VALUES_REQUIRED' | 'DEPLOYMENT_MANIFEST_NOT_READY' };
```

Canonical readiness requires an active `UNISWAP_V3`/`UNISWAP_V4` adapter, non-zero evidence/config hashes, non-null required addresses, and a deployment manifest status permitted by the existing Day-5 verification scripts. Controlled fixture mode is allowed only for local/CI script/recovery rehearsal and must never mutate `config/networks/*.json` or `config/deployments/*.json`.

- [ ] **Step 4: Run focused regressions**

```bash
pnpm exec vitest run tests/day9/rehearsal-readiness.test.ts
pnpm validate
```

Expected: PASS with current canonical Arc Testnet status explicitly blocked.

- [ ] **Step 5: Commit**

```bash
git add scripts/day9/check-rehearsal-readiness.mts tests/day9/rehearsal-readiness.test.ts .github/workflows/day9-lane2-rehearsal-readiness.yml
git commit -m "test(day9): make rehearsal readiness explicit"
```

---

### Task 3: Prove clean-environment deployment scripts with controlled local dependencies

**Files:**
- Create: `contracts/script/rehearsal/DeployDay9ControlledDependencies.s.sol`
- Create: `contracts/src/rehearsal/Day9ProtocolAdminHarness.sol`
- Create: `scripts/day9/run-clean-local-rehearsal.mjs`
- Create: `tests/day9/clean-local-rehearsal.test.ts`
- Create: `.github/workflows/day9-lane3-clean-local-rehearsal.yml`

**Interfaces:**
- Consumes: the production `DeployDay5Graduation.s.sol`, `configure-graduation.mjs`, `verify-graduation-deployment.mjs`, `SmokeDay5Graduation.s.sol`, and canonical generated Bread ABIs.
- Produces: a clean temporary local environment proving the production Bread deployment/wiring/smoke scripts work from zero state while all external DEX/admin/USDC dependencies are unmistakably rehearsal-only.

- [ ] **Step 1: Write the RED orchestration test**

```ts
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';

describe('Day 9 clean local rehearsal', () => {
  it('reaches deploy -> wire -> verify -> launch -> buy -> claim -> graduate -> lock from an empty environment', () => {
    const result = spawnSync(process.execPath, ['scripts/day9/run-clean-local-rehearsal.mjs'], {
      encoding: 'utf8',
      env: { ...process.env, BREAD_DAY9_MODE: 'CONTROLLED_FIXTURE' },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('DAY9_CLEAN_LOCAL_REHEARSAL_PASS');
    expect(result.stdout).toContain('CANONICAL_ARC_DEPLOYMENT_CLAIM=false');
  });
});
```

- [ ] **Step 2: Verify RED**

```bash
pnpm exec vitest run tests/day9/clean-local-rehearsal.test.ts
```

Expected: FAIL because the rehearsal runner/dependencies do not exist.

- [ ] **Step 3: Implement test-only external dependencies**

`Day9ProtocolAdminHarness.sol` must be a contract so `DeployDay5Graduation` cannot hand long-lived ownership to the deployer EOA. It may expose only a test-only forwarding method used by the rehearsal and must live under the explicit `rehearsal` namespace.

The controlled DEX dependencies must implement only the interface shapes needed by `BreadV3GraduationAdapter` and must not be imported by production deployment/config code.

- [ ] **Step 4: Implement the clean runner**

The runner must:

```text
1. create a temporary Anvil chain;
2. deploy rehearsal-only USDC/admin/V3 interface fixtures;
3. derive deterministic TEST_ONLY economics values and their exact economicsConfigHash;
4. execute the existing Bread production deployment script against those inputs;
5. write a temporary deployment manifest outside config/networks and config/deployments;
6. verify ownership/wiring/code using the same checks as scripts/day5/verify-graduation-deployment.mjs;
7. fund the smoke operator with rehearsal-only USDC;
8. run the existing full smoke lifecycle;
9. assert permanent lock and creator claim;
10. destroy the environment;
11. assert git diff/tree unchanged outside intended evidence output.
```

The runner must print:

```text
DAY9_CLEAN_LOCAL_REHEARSAL_PASS
CANONICAL_ARC_DEPLOYMENT_CLAIM=false
PRODUCTION_ECONOMICS_CLAIM=false
```

- [ ] **Step 5: Run focused + contract regressions**

```bash
pnpm exec vitest run tests/day9/clean-local-rehearsal.test.ts
cd contracts && forge test -q
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add contracts/script/rehearsal contracts/src/rehearsal scripts/day9/run-clean-local-rehearsal.mjs tests/day9/clean-local-rehearsal.test.ts .github/workflows/day9-lane3-clean-local-rehearsal.yml
git commit -m "test(day9): rehearse clean Bread deployment locally"
```

---

### Task 4: Rehearse service rollback without changing financial state

**Files:**
- Create: `scripts/day9/rehearse-service-rollback.mts`
- Create: `tests/day9/service-rollback-rehearsal.test.ts`
- Create: `.github/workflows/day9-lane4-service-rollback.yml`

**Interfaces:**
- Consumes: built web/API/indexer artifacts, existing API health/status behavior, DB schema/migrations, Redis, and the canonical read-model contracts.
- Produces: evidence that a bad web/API/indexer application release can be replaced by the prior known-good build without changing contracts or corrupting indexed state.

- [ ] **Step 1: Write the RED**

```ts
it('restores the known-good web/API/indexer release after a deliberately unhealthy candidate', async () => {
  const result = await rehearseServiceRollback({
    knownGoodCommit: 'fe9b13f1ce271fd5423fdd76de13034dac18fee1',
    candidateMode: 'INJECTED_UNHEALTHY_APPLICATION_ONLY',
  });
  expect(result).toMatchObject({
    rollback: 'PASS',
    contractMutationCount: 0,
    authoritativeReconcile: 'PASS',
  });
});
```

- [ ] **Step 2: Verify RED**

```bash
pnpm exec vitest run tests/day9/service-rollback-rehearsal.test.ts
```

Expected: FAIL because the rehearsal helper does not exist.

- [ ] **Step 3: Implement the minimum application-only rollback harness**

The harness must use separate process ports/directories for known-good and candidate builds, inject an application health failure without touching contracts, switch the test router to known-good, then verify:

```text
web health/read path = healthy
API /health = healthy
indexer process = healthy
DB checkpoint unchanged or advanced monotonically
reconcile = PASS
contractMutationCount = 0
```

Do not implement smart-contract rollback.

- [ ] **Step 4: Run focused + root build**

```bash
pnpm exec vitest run tests/day9/service-rollback-rehearsal.test.ts
pnpm build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/day9/rehearse-service-rollback.mts tests/day9/service-rollback-rehearsal.test.ts .github/workflows/day9-lane4-service-rollback.yml
git commit -m "test(day9): rehearse application rollback"
```

---

### Task 5: Run the complete recovery/admin drill bundle

**Files:**
- Create: `scripts/day9/run-recovery-drills.mts`
- Create: `tests/day9/recovery-drill-bundle.test.ts`
- Create: `.github/workflows/day9-lane5-recovery-drills.yml`
- Reuse without semantic changes: Day-4 emergency tests, Day-5 graduation retry/recovery tests, Day-6 rebuild/reconcile tests, Day-7 transaction recovery, Day-8 RPC failover/catch-up tests.

**Interfaces:**
- Consumes: `BreadEmergencyController`, existing owner/Guardian boundaries, `runIndexerCommand`, `createBoundedRpcFailoverLogClient`, `runIndexerCatchUp`, persisted browser transaction recovery.
- Produces: one machine-readable rehearsal summary mapping the 05D pre-launch recovery checklist to exact tests/evidence.

- [ ] **Step 1: Write the RED mapping test**

The expected drill IDs are exact:

```ts
const required = [
  'GUARDIAN_PAUSE_NEW_LAUNCHES',
  'ESCALATE_BUY_TRADING_PAUSE',
  'PROTOCOL_ADMIN_UNPAUSE',
  'APPLICATION_ROLLBACK',
  'RPC_FAILOVER',
  'INDEXER_REBUILD_RECONCILE',
  'SUBMITTED_TX_BROWSER_REFRESH_RECOVERY',
  'FAILED_GRADUATION_RETRY',
  'GUARDIAN_ROTATION',
  'MULTISIG_SIGNER_RECOVERY_ROTATION',
] as const;
```

The test must fail if any required drill is `MISSING`, `UNEXECUTED`, or represented only by prose.

- [ ] **Step 2: Verify RED**

```bash
pnpm exec vitest run tests/day9/recovery-drill-bundle.test.ts
```

Expected: FAIL until the runner maps each drill to executable evidence.

- [ ] **Step 3: Implement the runner using retained suites**

For each drill, invoke the smallest existing owning suite or Day-9 rollback harness and emit:

```json
{
  "id": "RPC_FAILOVER",
  "status": "PASS",
  "evidence": "tests/day8/rpc-failover-under-load.test.ts"
}
```

`MULTISIG_SIGNER_RECOVERY_ROTATION` may be PASS only if a real multisig/Safe-compatible test environment actually executes a threshold signer-change/recovery sequence. A contract merely existing at `protocolAdmin` is not sufficient.

- [ ] **Step 4: Run the drill workflow**

```bash
pnpm exec vitest run tests/day9/recovery-drill-bundle.test.ts
```

Expected: either full PASS or an explicit bounded `DAY9_RECOVERY_DRILL_BLOCKED_MULTISIG_ENVIRONMENT` stop. Never convert that blocker into PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/day9/run-recovery-drills.mts tests/day9/recovery-drill-bundle.test.ts .github/workflows/day9-lane5-recovery-drills.yml
git commit -m "test(day9): compose pre-launch recovery drills"
```

---

### Task 6: Execute the Day-9 browser/device/wallet/accessibility matrix truthfully

**Files:**
- Create: `apps/web/e2e/playwright.day9-release.config.ts`
- Create: `apps/web/e2e/specs/day9-release-matrix.spec.ts`
- Create: `.github/workflows/day9-lane6-browser-matrix.yml`
- Create: `docs/evidence/day9-browser-device-wallet-matrix.md`

**Interfaces:**
- Consumes: the existing deterministic indexed-API/RPC/wallet fixtures and Day-7 primary journey specs.
- Produces: a claim matrix that distinguishes automated engine/viewport coverage from physical-device and wallet/in-app-browser evidence.

- [ ] **Step 1: Write a matrix validator before adding runs**

```ts
expect(matrix.desktopChromium.status).toBe('PASS');
expect(matrix.desktopFirefox.status).toBe('PASS');
expect(matrix.desktopWebKit.status).toBe('PASS');
expect(matrix.mobileChromiumEmulation.status).toBe('PASS');
expect(['PASS', 'EXTERNAL_EXECUTION_REQUIRED']).toContain(matrix.iosSafari.status);
expect(['PASS', 'EXTERNAL_EXECUTION_REQUIRED']).toContain(matrix.androidChrome.status);
expect(['PASS', 'NO_FIRST_CLASS_WALLET_BROWSER_CLAIM']).toContain(matrix.walletBrowser.status);
```

The validator must reject `PASS` when the evidence field contains only emulation for a row explicitly labeled physical/current-device execution.

- [ ] **Step 2: Run existing engines and mobile journeys as retained evidence**

Use pinned Playwright 1.62.0. Do not introduce a new browser-testing dependency.

```bash
pnpm --filter @bread/web exec playwright test --config=e2e/playwright.day9-release.config.ts
```

The config must include Chromium, Firefox and WebKit and must retain the Day-7 canonical-manifest restoration guard.

- [ ] **Step 3: Add release-matrix assertions**

The automated matrix must cover at least:

```text
Explore/Search/Token
Connect generic EIP-1193 wallet
Wrong-network -> Arc switch
Buy review/submit/recovery
Sell review/submit
Create + Launch+Buy
Creator claim
Graduation/lock visibility
Keyboard navigation and visible focus on primary transaction controls
Mobile keyboard-pressure trade flow
Reduced-motion preference
```

- [ ] **Step 4: Record external-execution rows without fabricating them**

`docs/evidence/day9-browser-device-wallet-matrix.md` must say `EXTERNAL_EXECUTION_REQUIRED` for any actual iOS/Android/wallet-in-app environment not executed by the available tooling. If Bread makes no first-class brand-specific wallet-browser claim, record `NO_FIRST_CLASS_WALLET_BROWSER_CLAIM` instead of inventing compatibility.

- [ ] **Step 5: Commit**

```bash
git add apps/web/e2e/playwright.day9-release.config.ts apps/web/e2e/specs/day9-release-matrix.spec.ts .github/workflows/day9-lane6-browser-matrix.yml docs/evidence/day9-browser-device-wallet-matrix.md
git commit -m "test(day9): add release browser matrix"
```

---

### Task 7: Gate any live Arc Testnet rehearsal on real external prerequisites

**Files:**
- Create: `scripts/day9/check-live-arc-rehearsal.mts`
- Create: `tests/day9/live-arc-rehearsal-gate.test.ts`
- Create: `docs/evidence/day9-live-arc-rehearsal.md`

**Interfaces:**
- Consumes: reconciled Arc Testnet manifest, Day-5 deployment manifest, Day-5 configure/verify/smoke scripts.
- Produces: either exact live-rehearsal authorization inputs or a typed blocker; never guessed addresses/keys/economics.

- [ ] **Step 1: Write the gate test**

With the currently verified repository/source state, the expected result is:

```ts
expect(checkLiveArcRehearsal()).toEqual({
  authorized: false,
  blockers: expect.arrayContaining([
    'ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED',
    'ARC_TESTNET_DEPLOYMENT_MANIFEST_NOT_READY',
  ]),
});
```

`BREAD_PRODUCTION_ECONOMICS_CONFIG` must remain reported as a public/mainnet release blocker, but the gate may accept separately labelled deterministic test-only economics for a future Arc Testnet rehearsal only if no production claim is made.

- [ ] **Step 2: Verify the current blocker**

```bash
pnpm exec vitest run tests/day9/live-arc-rehearsal-gate.test.ts
node scripts/day5/configure-graduation.mjs arc-testnet
```

Expected today: the test PASSes by reporting the typed blocker; the existing configure command exits non-zero with `ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED`.

- [ ] **Step 3: Do not broadcast while blocked**

The plan explicitly forbids invoking either of these while `authorized !== true`:

```bash
forge script script/DeployDay5Graduation.s.sol:DeployDay5Graduation --broadcast
node scripts/day5/smoke-graduation.mjs arc-testnet
```

- [ ] **Step 4: If prerequisites later become real, use secure injected secrets only**

A live run may consume secret names such as `BREAD_DEPLOYER_PRIVATE_KEY` / `BREAD_SMOKE_PRIVATE_KEY`, but values must come from a secure operator/GitHub environment and must never be printed, committed, pasted into chat, or stored in manifests. Protocol Admin must be a verified contract/multisig-compatible address; Guardian must be separate; smoke operator must have only required Testnet USDC.

- [ ] **Step 5: Commit the gate/evidence, not fabricated deployment data**

```bash
git add scripts/day9/check-live-arc-rehearsal.mts tests/day9/live-arc-rehearsal-gate.test.ts docs/evidence/day9-live-arc-rehearsal.md
git commit -m "test(day9): gate live Arc rehearsal on verified prerequisites"
```

---

### Task 8: Freeze the RC only after the Day-9 gate can be evaluated truthfully

**Files:**
- Create/update: `docs/evidence/day9-release-candidate-rehearsal.md`
- Update: `docs/current-build-state.yaml`
- Create: `.github/workflows/day9-final-rc-gate.yml`

**Interfaces:**
- Consumes: exact outputs from Tasks 1–7 plus full retained root/Day-6/Day-7/Day-8 regressions.
- Produces: either `DAY_9_RELEASE_CANDIDATE_REHEARSAL_PASS` on one immutable exact commit or a typed Day-9 blocker with no RC PASS/tag claim.

- [ ] **Step 1: Build the final gate manifest**

Required booleans/statuses:

```yaml
source_environment_reconciliation: PASS
clean_environment_script_rehearsal: PASS
canonical_arc_testnet_deployment: PASS_OR_EXPLICIT_BLOCKER
service_rollback: PASS
indexer_rebuild_reconcile: PASS
recovery_drills: PASS_OR_EXPLICIT_MULTISIG_BLOCKER
browser_engine_matrix: PASS
physical_device_matrix: PASS_OR_EXTERNAL_EXECUTION_REQUIRED
wallet_browser_matrix: PASS_OR_NO_FIRST_CLASS_CLAIM
root_ci: PASS
retained_day6: PASS
retained_day7: PASS
retained_day8: PASS
```

- [ ] **Step 2: Apply the non-waivable Day-9 end gate**

`DAY_9_RELEASE_CANDIDATE_REHEARSAL_PASS` requires all source-required end-of-day statements to be actually true:

```text
EMPTY_ENVIRONMENT_TO_USABLE_LAUNCHPAD = PASS
ROLLBACK = PASS
RECONCILE = PASS
SUPPORTED_MATRIX = PASS
```

A controlled local fixture rehearsal is supporting evidence, not a substitute for the required live Testnet deployment when the source calls for it. `EXTERNAL_EXECUTION_REQUIRED` on a required supported matrix row prevents Day-9 PASS.

- [ ] **Step 3: Freeze/tag only a fully eligible exact head**

Only after all required gates are PASS:

```bash
git tag -a bread-day9-rc1 <EXACT_GREEN_HEAD> -m "Bread Day 9 release candidate 1"
git push origin bread-day9-rc1
```

If any required gate is blocked, do not create a release-candidate PASS tag. Keep the exact branch/head and blocker evidence durable instead.

- [ ] **Step 4: Run final exact-head CI**

Required matrix:

```text
root CI
Day-8 lanes 1-5
retained Day-6 Tasks 5-10
retained Day-7 Tasks 1-10 including Playwright
all Day-9 lanes
```

No final PASS may combine runs from different implementation heads unless a source-documented docs-only durability exception applies.

- [ ] **Step 5: Guarded merge and durable handoff**

After review, merge only the exact green audited head with expected-head protection. Then verify actual `main`, create a separate docs-only Day-9 durability handoff, rerun its continuity checks, merge/read back, and only then allow Day 10.

## Self-Review

### Spec coverage

- RC freeze/tag discipline: Task 8.
- Clean deployment from empty environment: Tasks 3 and 7, with explicit distinction between controlled script proof and required live Testnet evidence.
- Code/config/ownership verification and smoke lifecycle: Tasks 3 and 7 reuse the canonical Day-5 scripts.
- Web/API/indexer rollback: Task 4.
- Indexer rebuild/reconcile and RPC/recovery: Task 5.
- Guardian/Admin/multisig drills: Task 5, with a hard stop rather than a fake multisig PASS.
- Browser/device/wallet/accessibility matrix: Task 6.
- Evidence bundle: Task 8.
- Arc/mainnet/DEX and production-value blockers: Tasks 1, 2 and 7.
- Continuous-system/exact-head regression requirements: Task 8.

### Placeholder scan

No `TBD`, `TODO`, guessed address, guessed fee, guessed DEX deployment, guessed Safe address, or hidden future implementation step is authorized by this plan. Externally unavailable prerequisites are represented as typed blockers, not placeholder values.

### Type / authority consistency

- Controlled fixture rehearsal never changes canonical network/deployment manifests.
- Existing Day-5 deployment/smoke scripts remain the Bread contract deployment authority.
- Existing indexer rebuild/reconcile remains the read-model recovery authority.
- New Day-9 scripts orchestrate and verify; they do not become financial or chain-state authorities.
- `day9_started` may become true only after this plan is committed/read and the execution branch is reconciled against current `main`; Day-9 PASS remains impossible while required live Testnet or supported-matrix gates are unresolved.
