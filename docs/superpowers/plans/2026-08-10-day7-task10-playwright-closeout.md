# Day 7 Task 10 Playwright Closeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove Bread’s already-integrated Day-7 public web through deterministic browser-level desktop/mobile journeys, repair only demonstrated source gaps, and close Day 7 without inventing protocol, deployment, financial, wallet or read authority.

**Architecture:** Run Playwright against the real `apps/web` Next application and its existing TanStack Query, wagmi, viem and protocol-SDK boundaries. Browser fixtures live only under `apps/web/e2e`: same-origin `/v1` reads are intercepted with accepted Day-6 `IndexedResponse<T>` shapes; Arc JSON-RPC is intercepted with deterministic canonical read/simulation/receipt responses; an EIP-1193 injected-wallet fixture exercises the existing wagmi connector; and a runner temporarily overlays only the intentionally unresolved protocol deployment identity before Next starts, restoring the checked-in blocked deployment manifest in `finally`. No fixture becomes production configuration or a second transaction/read implementation.

**Tech Stack:** Next.js 16.2.12, React 19.2.8, TypeScript 7.0.2, Playwright 1.62.0, wagmi 3.7.1, viem 2.55.8, TanStack Query 5.101.4, pnpm 11.15.1, Node 24.18.0.

## Global Constraints

- Exact durable start baseline: `070a3f274d0ed26bfb1b38cb14b4364c8d7a376a` (`DAY7_TASK9_RESPONSIVE_ACCESSIBILITY_PERFORMANCE_FRONTEND_SECURITY_CONVERGENCE_INTEGRATED_PASS_DURABLE`).
- 04A–04D remain frozen product/UI authority. Task 10 is browser proof/closeout, not a feature or redesign lane.
- Keep committed `config/networks/arc-testnet.json` and `config/deployments/arc-testnet.day5.json` authoritative and unchanged after every E2E run. Test-only deployment values may exist only in `apps/web/e2e/fixtures/protocol-deployment.json` and a temporary working-tree overlay restored by the runner.
- Test-only protocol stack identity must be visibly non-production (`e2e-test-only`); no production economics/admin/mainnet/DEX value is inferred or frozen.
- Public reads continue through same-origin Day-6 `/v1` API shapes; no E2E helper may call component-private read APIs or introduce per-card RPC fanout.
- User writes continue through the existing injected-wallet -> wagmi -> viem -> `@bread/protocol-sdk` path. No fixture may call transaction controllers directly as a substitute for browser interaction.
- Transaction-critical reads/simulation remain chain-side through the existing public client; the RPC fixture only answers the exact calls the real SDK/runtime emits.
- Playwright fixtures must use accepted shared DTO/ABI shapes and `viem` encoding/decoding rather than duplicating financial formulas.
- Only browser failures that reproduce a frozen source requirement may authorize production repair. Harness/config failures are fixed in the harness, not in application code.
- Existing release/mainnet blockers remain unchanged: `CURRENT_PONS_FACTORY_SOURCE_PARITY`, `PONS_V2_RUNTIME_REFERENCE`, `BREAD_PRODUCTION_ECONOMICS_CONFIG`, `PONS_AUDIT_FINDINGS`, `ARC_MAINNET_VALUES`.
- Required Day-7 verdicts before closeout: `PRIMARY_DESKTOP_MOBILE_E2E = PASS`, `NO_RAW_RPC_PRIMARY_UX = PASS`, `MOBILE_KEYBOARD_TRADE_FLOW = PASS`.

---

### Task 1: Pin the Playwright test toolchain and create the dedicated CI lane

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/web/playwright.config.ts`
- Create: `.github/workflows/day7-task10-playwright-closeout.yml`
- Temporary only, then delete before Task-1 close: `.github/workflows/day7-task10-lockfile-bootstrap.yml`

**Interfaces:**
- Consumes: frozen `config/toolchain/versions.json` Playwright version `1.62.0`, Node `24.18.0`, pnpm `11.15.1`.
- Produces: `pnpm --filter @bread/web test:e2e` and the `day7-task10-playwright-closeout` workflow.

- [ ] **Step 1: Generate the exact pnpm package/lock patch instead of guessing lock internals.**

Create a temporary branch-only workflow that runs:

```yaml
- run: pnpm install --frozen-lockfile
- run: pnpm --filter @bread/web add -D @playwright/test@1.62.0 --lockfile-only
- run: git diff -- apps/web/package.json pnpm-lock.yaml
```

Fetch the workflow log, apply that exact package/lock diff to the branch, then delete the temporary workflow. No generated dependency metadata is hand-authored.

- [ ] **Step 2: Add the web E2E script.**

`apps/web/package.json` must contain exactly:

```json
"test:e2e": "node e2e/run.mjs"
```

and `@playwright/test` must be exactly `1.62.0` in `devDependencies`.

- [ ] **Step 3: Add `apps/web/playwright.config.ts`.**

Use `testDir: './e2e/specs'`, `fullyParallel: false`, `workers: 1`, `baseURL: 'http://127.0.0.1:3000'`, trace/screenshot/video retained on failure, and projects:

```ts
projects: [
  { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
]
```

The first Task-10 gate requires Chromium desktop + mobile. Firefox/WebKit are added only after those deterministic journeys are green and the runner image supports installing/running them without weakening the gate.

`webServer.command` is `pnpm dev --hostname 127.0.0.1 --port 3000`, with `reuseExistingServer: false` in CI.

- [ ] **Step 4: Add `.github/workflows/day7-task10-playwright-closeout.yml`.**

Pin the repository’s existing checkout/setup-node/pnpm action SHAs, run `pnpm install --frozen-lockfile`, run `pnpm --filter @bread/web exec playwright install --with-deps chromium`, then run `pnpm --filter @bread/web test:e2e`. After the E2E command, assert:

```bash
git diff --exit-code -- config/deployments/arc-testnet.day5.json config/networks/arc-testnet.json
```

so a failed/aborted fixture cannot silently become deployment truth.

- [ ] **Step 5: Commit only the durable toolchain/config files.**

Commit: `test(day7): add Task 10 Playwright harness`.

---

### Task 2: Build deterministic API, RPC, wallet and deployment fixtures outside production modules

**Files:**
- Create: `apps/web/e2e/run.mjs`
- Create: `apps/web/e2e/fixtures/protocol-deployment.json`
- Create: `apps/web/e2e/fixtures/constants.ts`
- Create: `apps/web/e2e/fixtures/indexed-api.ts`
- Create: `apps/web/e2e/fixtures/rpc.ts`
- Create: `apps/web/e2e/fixtures/wallet.ts`
- Create: `apps/web/e2e/fixtures/browser.ts`
- Test indirectly through: `apps/web/e2e/specs/harness.spec.ts`

**Interfaces:**
- Consumes: checked-in Arc testnet chain ID `5042002`, canonical testnet USDC `0x3600000000000000000000000000000000000000`, generated Bread ABI registry and Day-6 API DTOs.
- Produces: browser fixture `test`/`expect`, deterministic indexed/API states, deterministic chain state, and an injected wallet that the existing wagmi connector discovers.

- [ ] **Step 1: Create a visibly test-only protocol deployment fixture.**

`protocol-deployment.json` uses `network: "arc-testnet"`, `chainId: 5042002`, `stackVersion: "e2e-test-only"`, `deploymentStartBlock: 1`, deterministic nonzero addresses for Factory/Deployer/FeePolicy/FeeEscrow/EmergencyController/Locker/Coordinator and a deterministic graduation adapter. It must use `status: "TEST_ONLY_PLAYWRIGHT_FIXTURE"` and must never overwrite the committed file outside `run.mjs` execution.

- [ ] **Step 2: Implement `run.mjs` as the restoration owner.**

Pseudo-contract:

```js
const original = await readFile(deploymentPath, 'utf8');
try {
  await writeFile(deploymentPath, fixtureJson);
  const result = spawnSync('pnpm', ['exec', 'playwright', 'test'], {
    cwd: webRoot,
    stdio: 'inherit',
    env: { ...process.env, BREAD_E2E: '1' },
  });
  process.exitCode = result.status ?? 1;
} finally {
  await writeFile(deploymentPath, original);
}
```

Handle `SIGINT`/`SIGTERM` by restoring before exit. Immediately after Playwright returns, byte-compare the restored deployment content with the original and fail if it differs.

- [ ] **Step 3: Implement canonical API fixtures.**

`indexed-api.ts` imports the real `IndexedResponse`, `IndexedFeedItem`, `IndexedTokenDetail`, `IndexedSearchResult`, portfolio/creator DTOs from `@bread/types` source paths. Provide deterministic fixtures for:

- two same-name search results with different token contracts;
- one active token, one graduation-pending token and one graduated token;
- portfolio data for the injected wallet;
- creator claim data for the injected wallet;
- freshness modes `FRESH` and `DEGRADED`.

Every envelope must contain the accepted `FreshnessMeta` source `bread-indexer`; no fixture computes protocol prices/fees from alternate formulas.

- [ ] **Step 4: Implement RPC fixture with existing ABI/viem ownership.**

`rpc.ts` imports `decodeFunctionData`, `encodeFunctionResult`, `encodeEventTopics`, `encodeAbiParameters` only from the app’s pinned `viem`, and `breadAbiRegistry` from `@bread/protocol-sdk` source. Route `https://rpc.testnet.arc.io/**` and answer only the methods needed by the real browser runtime:

- `eth_chainId`, `eth_blockNumber`;
- `eth_call` for curve `getReserves`, `reservedTokens`, `tradeFeeBps`, `creatorTaxBps`, `currentSnipeTaxBps`;
- ERC-20 `balanceOf`, `allowance`;
- Factory `currentLaunchConfig`, `previewLaunchEconomics`;
- FeePolicy `currentFeePolicy`;
- FeeEscrow `balanceOf`;
- transaction simulation `eth_call` for prepared write calldata;
- `eth_getTransactionReceipt` / `eth_getTransactionByHash` needed by viem receipt waiting.

A successful launch receipt includes a correctly ABI-encoded canonical Factory `LaunchCreated` log for the deterministic new token address. Unknown RPC methods or unknown contract/function calldata throw/fail the test rather than returning a permissive fake value.

- [ ] **Step 5: Implement EIP-1193 wallet fixture.**

`wallet.ts` installs `window.ethereum` through `BrowserContext.addInitScript` before navigation. Support only:

- `eth_accounts`, `eth_requestAccounts`;
- `eth_chainId`;
- `wallet_switchEthereumChain`;
- `eth_sendTransaction` returning deterministic distinct hashes;
- `on`, `removeListener` for `accountsChanged`, `chainChanged`, `connect`, `disconnect`.

Expose a test-only controller on `window.__breadE2EWallet` to set connected/disconnected state and chain ID. Do not call application transaction functions directly.

- [ ] **Step 6: Write `harness.spec.ts` and run it.**

Prove that:

1. the app starts with the temporary `e2e-test-only` ProtocolContext;
2. `/v1` browser reads are served by the indexed fixture;
3. RPC calls are observable and unknown calls fail closed;
4. the injected connector is discoverable;
5. the committed deployment/network files are restored after the run.

If harness failures are fixture/config errors, repair only these E2E files. No production module is authorized by this task.

- [ ] **Step 7: Commit the fixture boundary.**

Commit: `test(day7): add deterministic browser fixtures`.

---

### Task 3: Add browse, search, graduation, degraded and responsive browser RED coverage

**Files:**
- Create: `apps/web/e2e/specs/browse-search.spec.ts`
- Create: `apps/web/e2e/specs/degraded-graduation.spec.ts`
- Create: `apps/web/e2e/specs/mobile-shell.spec.ts`
- Modify only if a browser RED proves a source gap: the smallest owning `apps/web` file plus a permanent focused Day-7 regression.

**Interfaces:**
- Consumes: Task-2 browser fixtures and integrated Tasks 1–9 UI.
- Produces: browser evidence for disconnected browsing, contract-safe search, degraded truthfulness, graduation visibility and mobile shell/accessibility behavior.

- [ ] **Step 1: Write browser tests before changing production code.**

Required assertions:

- disconnected user can browse Explore and a token page without a wallet;
- Search opens without wallet, same-name results visibly retain different contract identity and route to the correct token contract;
- Search modal keyboard Tab/Shift+Tab stays contained, Escape closes and focus returns to the trigger;
- `DEGRADED` API metadata shows the truthful delayed/degraded banner without fabricating missing values;
- active, pending/processing and graduated token fixtures render distinct graduation states and permanent-lock evidence where supported;
- mobile bottom navigation exposes Explore/Trending/Create/Portfolio and no horizontal viewport overflow occurs at the frozen mobile viewport;
- no browser request to Arc RPC is emitted while performing browse/search-only primary reads.

- [ ] **Step 2: Push RED and verify GitHub failure is behavioral.**

The dedicated Task-10 workflow must fail only on a source-backed browser assertion. If it fails because a fixture/API/RPC selector is wrong, fix Task-2 harness first and re-run before authorizing application changes.

- [ ] **Step 3: For each demonstrated product gap, add a focused regression and minimum GREEN repair.**

Do not pre-authorize a file list before the browser RED identifies the owner. For every gap, first add the equivalent focused Vitest/source regression beside the existing Day-7 owner, verify its intended RED on GitHub, then modify only that owner. If all browser tests pass, make no production change.

- [ ] **Step 4: Re-run Task-10 + affected Day-7 workflow(s).**

Commit browser coverage and any proven minimal repair coherently. No redesign/refactor commits.

---

### Task 4: Add wallet, trade, launch, claim and recovery browser RED coverage

**Files:**
- Create: `apps/web/e2e/specs/wallet-trade.spec.ts`
- Create: `apps/web/e2e/specs/create-launch.spec.ts`
- Create: `apps/web/e2e/specs/creator-claim.spec.ts`
- Create: `apps/web/e2e/specs/transaction-recovery.spec.ts`
- Modify only after demonstrated RED: smallest owning Task-5/6/7/8 web module plus its focused Day-7 regression.

**Interfaces:**
- Consumes: existing wagmi/injected-wallet owner, SDK builders/reviews/simulation, transaction storage/recovery controllers and Task-2 chain fixture.
- Produces: browser proof for direct-wallet write lifecycle, pre-sign review, duplicate-submit prevention and reload recovery.

- [ ] **Step 1: Prove wallet/network behavior.**

Browser tests cover disconnected -> Connect wallet -> READY and wrong-network -> Switch to Arc. Browsing remains available while wrong-network. No test invokes runtime/controller functions directly.

- [ ] **Step 2: Prove Buy and Sell.**

For each action, interact with the real token page/trade sheet and assert before signature that expected/minimum output, base fee, creator tax, opening tax where applicable, price impact and slippage are visible. Submit through the injected wallet, assert only one `eth_sendTransaction` for the intended write (plus an approval only when the canonical allowance fixture requires it), and reach Confirmed from the receipt fixture.

- [ ] **Step 3: Prove Create -> Review -> Launch and atomic Launch & Buy.**

Use only source-defined form fields. Verify review values come from canonical RPC fixture data, final action text is `Launch` or `Launch & Buy`, then submit through the wallet. Launch success must derive token identity from the canonical `LaunchCreated` receipt log and route/show the deterministic new token contract.

- [ ] **Step 4: Prove creator claim.**

Load the real Creator page for the connected wallet, verify exact fixture claimable USDC + recipient, submit Claim through the wallet, and confirm via receipt. A zero-claim fixture must not offer a financial write.

- [ ] **Step 5: Prove duplicate-submit and reload recovery.**

Hold a receipt in pending state, click the primary action repeatedly and assert only one intended transaction hash is submitted. Reload the page with the persisted SUBMITTED/CONFIRMING record, then release the fixture receipt and assert recovery reaches Confirmed. A receipt/network timeout must surface Unknown/Still checking semantics rather than false failure.

- [ ] **Step 6: Verify RED before repair.**

As in Task 3, production repair is authorized only after GitHub shows a source-backed browser failure and a focused permanent regression reproduces it. Harness failures stay in E2E files.

---

### Task 5: Prove mobile software-keyboard trade flow and cross-browser support

**Files:**
- Create: `apps/web/e2e/specs/mobile-trade.spec.ts`
- Modify: `apps/web/playwright.config.ts` only if Firefox/WebKit installation/support is demonstrated green in CI.
- Modify application CSS/components only after a source-backed RED and focused regression.

**Interfaces:**
- Consumes: frozen 04B/04C mobile 56px top bar, 64px bottom nav, safe areas, max-90dvh trade sheet and Task-4 transaction behavior.
- Produces: `MOBILE_KEYBOARD_TRADE_FLOW = PASS` evidence.

- [ ] **Step 1: Test the mobile trade sheet with input focused.**

Open Buy/Sell from the persistent mobile action bar, focus the decimal amount input, assert the sheet remains within viewport bounds, has internal scrolling, includes safe-area bottom padding and keeps the primary action reachable by scrolling while the input stays focusable. Assert all interactive targets exercised by the flow are at least 44 CSS px on the relevant axis.

- [ ] **Step 2: Execute one mobile Buy through the same wallet/RPC fixtures.**

The flow must review -> submit -> confirm without horizontal overflow or inaccessible primary action.

- [ ] **Step 3: Probe Firefox/WebKit support.**

In a dedicated CI commit, install/run the same browse + transaction smoke on Firefox/WebKit. Keep them as required Task-10 projects only if the runner supports deterministic green execution; otherwise record the environment limitation and retain Chromium desktop/mobile as the controlling Day-7 proof, leaving the broader browser/device matrix to Day 9 per 06C/04D.

---

### Task 6: Run the exact-head Day-7 closeout matrix and guarded-merge

**Files:**
- Create: `docs/evidence/day7-public-web-closeout.md`
- Modify: PR body for the final exact-head workflow IDs.
- Do not yet modify `docs/current-build-state.yaml`; durability is Task 7 after the implementation merge.

**Interfaces:**
- Consumes: complete Task-10 browser suite + all accepted Day-6/Day-7 regressions.
- Produces: audited implementation verdicts `PRIMARY_DESKTOP_MOBILE_E2E = PASS`, `NO_RAW_RPC_PRIMARY_UX = PASS`, `MOBILE_KEYBOARD_TRADE_FLOW = PASS`.

- [ ] **Step 1: Run the final candidate matrix.**

Required on one exact candidate head:

- Task-10 Playwright workflow;
- root CI;
- Day-7 Tasks 1–9 retained workflows;
- retained Day-6 Tasks 5–10;
- any new focused regression workflow added by a demonstrated Task-10 repair.

- [ ] **Step 2: Perform source/design/security diff review.**

Confirm no protocol/economics/ABI/address/canonical-config/API-financial-write/server-relay/wallet-authority/transaction-recovery/dependency drift beyond the pinned Playwright test dependency. Verify E2E fixture values never remain in committed production manifests and unknown RPC calls fail closed.

- [ ] **Step 3: Write `docs/evidence/day7-public-web-closeout.md`.**

Record source coverage, all demonstrated RED->GREEN repairs (or explicitly state no production gap where applicable), candidate head, workflow matrix, browser projects actually proven, fixture/restoration boundary and unchanged blockers. Because adding the evidence file creates a new commit, run the full continuity matrix once more on that evidence-bearing exact head; put those final run IDs in PR # body rather than creating an infinite self-referential evidence commit.

- [ ] **Step 4: Mark the Task-10 PR ready and guarded-merge only the exact audited head.**

Use `expected_head_sha`. Freshly verify actual merged `main` before durability work.

---

### Task 7: Create the separate docs-only Day-7 durable closeout before Day 8

**Files:**
- Create: `docs/handoffs/day7-public-web-closeout-handoff.md`
- Modify: `docs/current-build-state.yaml`

**Interfaces:**
- Consumes: actual merged Task-10 `main` and exact-head evidence.
- Produces: durable Day-7 baseline and `NEXT_ACTION` for Day 8 only after continuity merge.

- [ ] **Step 1: Branch from actual merged Task-10 `main`.**

Do not reuse the implementation branch. Update `docs/current-build-state.yaml` additively to the next schema version while preserving literal source-integrity markers required by repository validators, including the ratified Day-4 source marker.

- [ ] **Step 2: Record durable Day-7 verdict.**

The handoff must state:

```text
DAY_7_PUBLIC_WEB_INTEGRATED_PASS_DURABLE
PRIMARY_DESKTOP_MOBILE_E2E = PASS
NO_RAW_RPC_PRIMARY_UX = PASS
MOBILE_KEYBOARD_TRADE_FLOW = PASS
```

and list actual implementation PR/head/merge, browser evidence, unchanged blockers, and Day-8 next action.

- [ ] **Step 3: Run docs-only continuity matrix.**

Root + Day-7 Tasks 1–10 + retained Day-6 Tasks 5–10 must pass on the exact docs head. Do not weaken any validator to make the compact handoff pass; restore required frozen markers if a source-integrity guard identifies one.

- [ ] **Step 4: Guarded-merge the docs-only head and read back actual `main`, build state and handoff.**

Only after that fresh readback may Day 8 start.

---

## Plan Self-Review

- **Spec coverage:** 04A critical journeys, 04B/04C desktop/mobile composition, 04D keyboard/accessibility/degraded/transaction/recovery/security requirements, 06C Day-7 `PRIMARY_DESKTOP_MOBILE_E2E` / `NO_RAW_RPC_PRIMARY_UX` / `MOBILE_KEYBOARD_TRADE_FLOW` gates, 06I no-per-card-RPC/deduplication expectations and 06H durability are each assigned to a concrete task.
- **No authority duplication:** API fixtures only answer the accepted `/v1` DTO boundary; RPC fixtures only answer calls emitted by the existing public client/SDK; injected-wallet fixtures only implement EIP-1193; no fixture exposes a parallel app transaction API.
- **No source invention:** committed Arc testnet network/USDC values are preserved; unresolved protocol deployment data is overlaid only during test execution with explicit `TEST_ONLY_PLAYWRIGHT_FIXTURE` / `e2e-test-only` identity and restored byte-for-byte.
- **TDD discipline:** browser tests are RED evidence. Production repair is not pre-authorized by the plan; a browser RED must first be confirmed as source-backed and reproduced in the smallest focused Day-7 regression before minimum GREEN.
- **No placeholder repair scope:** unknown future bugs intentionally have no speculative application file assignment. If a real RED appears, add a bounded plan amendment naming its proven owner before changing production code.
- **Continuity:** implementation merge and docs-only durability merge are separate; Day 8 cannot begin from a merely local/PR PASS.
