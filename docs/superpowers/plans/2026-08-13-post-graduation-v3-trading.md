# Post-Graduation V3 Trading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep active Bread launches on the existing bonding-curve Buy/Sell path, but route a launch that is canonically `POOL_CREATED` through its exact snapshotted `UNISWAP_V3` TOKEN/USDC pool using verified Arc-Testnet V3 periphery dependencies and Bread's existing direct-wallet transaction lifecycle.

**Architecture:** Financial route selection is chain-authoritative, not indexer-authoritative. The SDK rereads the launch snapshot from `BreadLaunchFactory`, the graduation record from that launch's snapshotted coordinator, and the snapshotted adapter's V3 identity/config before selecting either the existing curve path or the exact graduated pool. Arc-specific SwapRouter/Quoter addresses and ABI kinds live only in the network manifest; the route resolver verifies that those periphery contracts belong to the same V3 factory as the snapshotted launch before they can prepare a write. The existing wallet validation, exact allowance, fresh review, immediate pre-sign simulation, single broadcast, persistence, replacement handling and reload recovery lifecycle remains the execution owner.

**Tech Stack:** TypeScript 7, Vitest 4, viem 2.55, React/Next.js 16, Zod 4, Arc Testnet JSON-RPC, Bread protocol SDK/config/web packages.

## Global Constraints

- PR #93 remains draft/open/unmerged; no Day-9 PASS, RC tag or Day-10 start from this lane.
- No Solidity, protocol economics, deployment authority, graduation accounting or permanent-lock semantics change.
- No `Synthra` branch or vendor address in shared financial/business logic; `UNISWAP_V3` remains the adapter family.
- Existing launches retain their snapshotted coordinator, graduation adapter, adapter family and config hash; current indexed state never selects a financial write.
- Network manifests own chain-specific periphery dependencies. No guessed router/quoter address is permitted.
- Arc Testnet post-graduation routing must verify the periphery contracts against the same factory snapshotted by the launch's V3 adapter.
- `NOT_GRADUATED` + `readyToGraduate() == false` may trade on the curve. `NOT_GRADUATED` + ready, `SWEPT`, and `RESCUED` must not be routed to a trade write. `POOL_CREATED` may route only to the verified graduated pool.
- All exact-input swaps use fresh onchain quote data, user-selected slippage, exact input allowance to the verified router, `value = 0`, and simulation immediately before the wallet signature boundary.
- No post-graduation Bread curve fee, creator tax or opening tax is invented. V3 venue fee is represented as the pool fee tier and is already reflected in quoted output.
- TDD is mandatory: each production behavior begins with a failing test that is observed failing for the intended reason.

---

### Task 1: Verify Arc-Testnet V3 swap periphery identity and ABI shape

**Files:**
- Modify after verification: `packages/config/src/manifests.ts`
- Modify after verification: `config/networks/arc-testnet.json`
- Test: `tests/day9/post-graduation-v3-trading.test.ts`
- Evidence: `docs/evidence/day9-post-graduation-v3-trading.md`

**Interfaces:**
- Produces: a verified Arc-Testnet tuple `{ factory, positionManager, swapRouter, swapRouterKind, quoter, quoterKind }` where both periphery contracts are proven to belong to `0x0fB6EEDA6e90E90797083861A75D15752a27f59c`.
- Consumes: canonical Arc Testnet USDC `0x3600000000000000000000000000000000000000`, BTST `0x9E9c161316FFA946E0D809Ba17345728478132f5`, pool `0x9995b278d08484ff746bbe91187a723d85c093f1`, V3 fee `3000`.

- [ ] **Step 1: Extract exact published periphery addresses and ABI kinds without touching the repo dependency graph**

Run from a temporary directory on the operator machine:

```bash
TMP="$(mktemp -d)"
cd "$TMP"
npm pack @synthra-swap/sdk-core@4.2.12
npm pack @synthra-swap/v3-sdk@3.11.7
npm pack @synthra-swap/v3-periphery@1.4.6
for TGZ in ./*.tgz; do
  DIR="${TGZ%.tgz}"
  mkdir -p "$DIR"
  tar -xzf "$TGZ" -C "$DIR"
done
rg -n -i '5042002|ARC|swaprouter|swap_router|quoter|0x0fB6EEDA6e90E90797083861A75D15752a27f59c|0x444Cc395346428216fB6f2892eb03cB804aE4CD5' .
```

The retained evidence must identify the published file/export that supplies each address and whether the deployed router ABI is classic V3 `SwapRouter` or `SwapRouter02`, and whether the quoter is V1 or V2. If the published packages do not identify both dependencies, stop this task and keep post-graduation writes disabled; do not infer addresses from standard Uniswap deployments.

- [ ] **Step 2: Independently verify both discovered contracts against Arc Testnet**

For the exact addresses produced by Step 1, run read-only RPC probes proving runtime bytecode and `factory()` equality to the already-verified Synthra V3 factory. Also perform a read-only exact-input quote against the exact BTST/USDC/3000 pool using the ABI kind discovered in Step 1. The quote must return a positive output and must not mutate chain state.

- [ ] **Step 3: Write the failing manifest test**

Add a test that parses a `UNISWAP_V3` network manifest containing the exact fields:

```ts
swapRouter: Address | null
swapRouterKind: 'V3_SWAP_ROUTER' | 'V3_SWAP_ROUTER_02' | null
quoter: Address | null
quoterKind: 'V3_QUOTER' | 'V3_QUOTER_V2' | null
```

and asserts that the parser retains them while rejecting an address without its corresponding ABI kind. The current strict schema must fail this test before production schema changes.

- [ ] **Step 4: Run the focused test and observe RED**

Run:

```bash
corepack pnpm exec vitest run tests/day9/post-graduation-v3-trading.test.ts
```

Expected: FAIL because the current strict `dexSchema` does not accept the new periphery fields.

- [ ] **Step 5: Implement the minimal manifest/context support**

Extend `dexSchema` only with the four verified periphery fields above. Extend `ProtocolContext` with an optional canonicalized graduated-trading dependency object derived from those fields only when the manifest is complete and `dex.type === 'UNISWAP_V3'`. An incomplete tuple must remain unavailable rather than partially usable.

- [ ] **Step 6: Run the focused test and observe GREEN**

Run the same Vitest command. Expected: PASS for manifest/context dependency validation.

- [ ] **Step 7: Commit**

```bash
git add packages/config/src/manifests.ts packages/protocol-sdk/src/context.ts config/networks/arc-testnet.json tests/day9/post-graduation-v3-trading.test.ts docs/evidence/day9-post-graduation-v3-trading.md
git commit -m "feat(day9): verify v3 trade periphery dependencies"
```

---

### Task 2: Add canonical trade-route resolution

**Files:**
- Create: `packages/protocol-sdk/src/trade-route.ts`
- Modify: `packages/protocol-sdk/src/index.ts`
- Modify only if minimal read ABIs are absent: `packages/protocol-sdk/src/abi/generated.ts`
- Test: `tests/day9/post-graduation-v3-trading.test.ts`

**Interfaces:**
- Produces:

```ts
type CanonicalTradeRoute =
  | { kind: 'CURVE'; curve: Address }
  | {
      kind: 'V3_POOL';
      token: Address;
      quoteAsset: Address;
      pool: Address;
      fee: number;
      factory: Address;
      positionManager: Address;
      swapRouter: Address;
      swapRouterKind: 'V3_SWAP_ROUTER' | 'V3_SWAP_ROUTER_02';
      quoter: Address;
      quoterKind: 'V3_QUOTER' | 'V3_QUOTER_V2';
    };

async function resolveCanonicalTradeRoute(
  client: PublicClient,
  context: ProtocolContext,
  token: Address,
): Promise<CanonicalTradeRoute>;
```

- Consumes: launch snapshot from `factory.getLaunch(token)`, launch-snapshotted coordinator, launch-snapshotted adapter/family/config hash, coordinator `getGraduation(token)`, V3 adapter immutable getters, verified network periphery tuple.

- [ ] **Step 1: Add failing route-selection tests**

Cover these independent cases:

1. Phase `NOT_GRADUATED` plus `readyToGraduate() == false` returns `CURVE` using the curve from the canonical launch record.
2. Phase `NOT_GRADUATED` plus `readyToGraduate() == true` rejects trading with a graduation-pending error.
3. Phase `SWEPT` rejects trading with a graduation-pending error.
4. Phase `RESCUED` rejects trading as unavailable.
5. Phase `POOL_CREATED` with adapter family other than numeric `2` rejects.
6. V3 adapter `configHash`, `usdc`, factory or position-manager mismatch rejects.
7. Router or quoter `factory()` mismatch rejects.
8. Coordinator `poolId` must decode to a nonzero address and equal `factory.getPool(token, USDC, fee)`.
9. Pool `token0/token1/fee` must equal the exact TOKEN/USDC/fee route and `liquidity()` must be positive.
10. A fully matching phase-2 launch returns `V3_POOL` with the exact snapshotted pool and verified periphery tuple.

- [ ] **Step 2: Run and observe RED**

```bash
corepack pnpm exec vitest run tests/day9/post-graduation-v3-trading.test.ts
```

Expected: route tests fail because `resolveCanonicalTradeRoute` is not exported/implemented.

- [ ] **Step 3: Implement minimal chain-authoritative resolution**

Do not consult indexed `graduationPhase`, indexed `poolId`, or the current deployment's adapter to select the write. Read the canonical launch first, then use only that launch's coordinator/adapter snapshot and the verified network periphery dependencies. Decode `poolId` from the coordinator as the low 20 bytes because `BreadV3GraduationAdapter` encodes `bytes32(uint256(uint160(pool)))`.

- [ ] **Step 4: Run and observe GREEN**

Run the focused test. Expected: all route-selection cases PASS and existing active-curve behavior remains unchanged.

- [ ] **Step 5: Commit**

```bash
git add packages/protocol-sdk/src/trade-route.ts packages/protocol-sdk/src/index.ts packages/protocol-sdk/src/abi/generated.ts tests/day9/post-graduation-v3-trading.test.ts
git commit -m "feat(day9): resolve canonical graduated trade route"
```

---

### Task 3: Add exact-input V3 quote/review and transaction builder

**Files:**
- Create: `packages/protocol-sdk/src/v3-trading.ts`
- Modify: `packages/protocol-sdk/src/trade-review.ts`
- Modify: `packages/protocol-sdk/src/builders.ts`
- Modify: `packages/protocol-sdk/src/index.ts`
- Test: `tests/day9/post-graduation-v3-trading.test.ts`
- Test: `tests/day6/sdk-builders.test.ts`

**Interfaces:**
- Produces:

```ts
type V3TradeReview = Readonly<{
  action: 'BUY' | 'SELL';
  route: 'V3_POOL';
  inputAmount: bigint;
  expectedOutput: bigint;
  minimumOutput: bigint;
  venueFee: number; // V3 fee units, e.g. 3000 = 0.30%
  baseFee: 0n;
  creatorTax: 0n;
  openingTaxBps: 0;
  openingTax: 0n;
  priceImpactBps: number;
  slippageBps: number;
}>;

async function readV3TradeReview(
  client: PublicClient,
  route: Extract<CanonicalTradeRoute, { kind: 'V3_POOL' }>,
  action: 'BUY' | 'SELL',
  inputAmount: bigint,
  slippageBps: number,
): Promise<V3TradeReview>;

function prepareV3ExactInputTrade(
  route: Extract<CanonicalTradeRoute, { kind: 'V3_POOL' }>,
  input: { action: 'BUY' | 'SELL'; inputAmount: bigint; minimumOutput: bigint; recipient: Address },
): PreparedBreadTransaction;
```

- Consumes: exact router/quoter ABI kinds proven in Task 1 and exact `V3_POOL` route from Task 2.

- [ ] **Step 1: Add failing builder/review tests**

Assert:
- BUY means USDC -> token; SELL means token -> USDC.
- quote is obtained from the verified quoter using exact TOKEN/USDC/fee and positive exact input.
- `minimumOutput = floor(expectedOutput * (10000 - slippageBps) / 10000)`.
- current pool `slot0.sqrtPriceX96` is used to compute raw-unit spot output and non-negative price impact without trusting indexed price data.
- router request uses exact single-hop V3 parameters, zero native value and `sqrtPriceLimitX96 = 0`.
- classic `V3_SWAP_ROUTER` includes the required deadline field; `V3_SWAP_ROUTER_02` uses its verified parameter shape. Only the Task-1-verified kind is placed in Arc Testnet config, but both types are represented explicitly so an ABI change can never be guessed.
- BUY allowance is exact USDC input to the router; SELL allowance is exact token input to the router.
- V3 review exposes Bread curve fees/taxes as zero and separately exposes the V3 venue fee tier.

- [ ] **Step 2: Run focused tests and observe RED**

```bash
corepack pnpm exec vitest run tests/day9/post-graduation-v3-trading.test.ts tests/day6/sdk-builders.test.ts
```

Expected: FAIL because V3 quote/review/builder exports do not exist.

- [ ] **Step 3: Implement minimal V3 quote/review/builder**

Use Bread-local minimal ABIs matching the exact verified periphery kinds. Never import a vendor SDK into Bread's financial execution path. Preserve `PreparedBreadTransaction` signer-free semantics.

- [ ] **Step 4: Run focused tests and observe GREEN**

Run the same command. Expected: PASS including all pre-existing Day-6 curve builder tests.

- [ ] **Step 5: Commit**

```bash
git add packages/protocol-sdk/src/v3-trading.ts packages/protocol-sdk/src/trade-review.ts packages/protocol-sdk/src/builders.ts packages/protocol-sdk/src/index.ts tests/day9/post-graduation-v3-trading.test.ts tests/day6/sdk-builders.test.ts
git commit -m "feat(day9): build graduated v3 exact-input trades"
```

---

### Task 4: Route the existing web transaction lifecycle by canonical state

**Files:**
- Modify: `apps/web/lib/transactions/controller.ts`
- Modify: `apps/web/components/trade/trade-experience.tsx`
- Modify: `apps/web/components/trade/trade-panel.tsx`
- Test: `tests/day7/trade-controller.test.ts`
- Test: `tests/day7/trade-execution.test.ts`
- Test: `tests/day7/trade-review-guard.test.ts`
- Test: `tests/day7/trade-allowance-simulation.test.ts`
- Test: `tests/day9/post-graduation-v3-trading.test.ts`

**Interfaces:**
- Consumes: `resolveCanonicalTradeRoute`, `readV3TradeReview`, `prepareV3ExactInputTrade`.
- Produces: one `prepareTradeReview` / `prepareTradeForSignature` / `executeTradeLifecycle` surface that preserves current curve semantics and selects V3 only after a fresh canonical phase-2 proof.

- [ ] **Step 1: Add failing controller tests**

Prove:
- an active canonical launch executes the unchanged curve review/builder path;
- a canonical `POOL_CREATED` launch performs a V3 review and prepares the V3 router transaction;
- allowance probing uses the same selected canonical route as final preparation;
- immediately after allowance confirmation the controller re-resolves the canonical route, rereads the quote and simulates the exact router request before signature;
- if route or quote changes between user review and final reread, no wallet trade is opened and `reviewChanged` is returned;
- pending/rescued/mismatched route states fail before allowance/broadcast;
- exactly one wallet send and existing persistence/replacement/reload semantics remain unchanged.

- [ ] **Step 2: Run focused controller tests and observe RED**

```bash
corepack pnpm exec vitest run tests/day7/trade-controller.test.ts tests/day7/trade-execution.test.ts tests/day7/trade-review-guard.test.ts tests/day7/trade-allowance-simulation.test.ts tests/day9/post-graduation-v3-trading.test.ts
```

Expected: new graduated-route tests FAIL while existing curve tests remain PASS.

- [ ] **Step 3: Implement minimal controller/UI routing**

`TradeExperience` may use indexed graduation state only for explanatory copy; the controller itself always resolves the canonical route. `TradePanel` renders V3 reviews without claiming Bread curve fees/taxes: show expected/minimum output, V3 venue fee, price impact and slippage; keep current curve fee/tax rows for curve reviews.

- [ ] **Step 4: Run focused controller/UI tests and observe GREEN**

Run the same focused command plus:

```bash
corepack pnpm exec vitest run tests/day7/trade-ui.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/transactions/controller.ts apps/web/components/trade/trade-experience.tsx apps/web/components/trade/trade-panel.tsx tests/day7 tests/day9/post-graduation-v3-trading.test.ts
git commit -m "feat(day9): route graduated trades through v3 pool"
```

---

### Task 5: Browser regression and exact-head verification

**Files:**
- Create: `apps/web/e2e/specs/graduated-v3-trading.spec.ts`
- Modify if fixture support is needed: `apps/web/e2e/fixtures/rpc.ts`
- Modify: `docs/evidence/day9-post-graduation-v3-trading.md`
- Modify: `docs/current-build-state.yaml`

**Interfaces:**
- Consumes: completed SDK/controller/UI route.
- Produces: deterministic browser proof plus exact-head local matrix evidence; no live write yet.

- [ ] **Step 1: Add failing browser regression**

Fixture the authoritative RPC so the token detail is indexed as graduated and canonical chain reads prove phase `POOL_CREATED`. Assert the Buy/Sell panel remains enabled, displays a V3 venue review, sends the router request rather than the curve request, and reload recovery never rebroadcasts a submitted swap.

- [ ] **Step 2: Observe RED, implement only fixture/UI adjustments required, then observe GREEN**

Run:

```bash
corepack pnpm exec playwright test apps/web/e2e/specs/graduated-v3-trading.spec.ts --project=desktop-chromium
```

Expected final result: PASS with no curve write for the graduated fixture.

- [ ] **Step 3: Run exact affected matrix**

```bash
corepack pnpm exec vitest run tests/day6/sdk-builders.test.ts tests/day7/trade-controller.test.ts tests/day7/trade-execution.test.ts tests/day7/trade-review-guard.test.ts tests/day7/trade-allowance-simulation.test.ts tests/day7/trade-ui.test.tsx tests/day9/post-graduation-v3-trading.test.ts
corepack pnpm exec tsc -b
corepack pnpm -r --if-present build
corepack pnpm exec playwright test apps/web/e2e/specs/graduated-v3-trading.spec.ts apps/web/e2e/specs/degraded-graduation.spec.ts --project=desktop-chromium
```

Expected: all commands PASS before any BTST post-graduation write is authorized.

- [ ] **Step 4: Commit exact-head evidence**

Record the tested production-code head separately from any later docs-only evidence head. Keep Day 9 globally incomplete while unrelated physical-device / branded-Edge / external-CI gates remain open.

---

### Task 6: Bounded real BTST post-graduation proof

**Files:**
- Modify: `docs/evidence/day9-post-graduation-v3-trading.md`
- Modify: `docs/current-build-state.yaml`

**Interfaces:**
- Consumes: exact-head GREEN implementation and the already-proven live BTST V3 pool.
- Produces: one bounded real Arc-Testnet BUY and, only after independent verification, one bounded SELL proving the native Bread token-page path after graduation.

- [ ] **Step 1: Read-only live route proof**

Against BTST, confirm the resolver returns the exact pool `0x9995b278d08484ff746bbe91187a723d85c093f1`, fee `3000`, canonical USDC, the launch's snapshotted V3 adapter/config and the Task-1-verified router/quoter. Obtain a positive fresh quote and simulate the exact router request before asking the wallet to sign.

- [ ] **Step 2: Execute exactly one tiny BUY through Bread UI**

Verify receipt success, exact router target, exact BTST/USDC/3000 route, user balance delta, pool state movement and no coordinator/adapter residue regression. Do not submit a second action until this is independently reconciled.

- [ ] **Step 3: Execute exactly one bounded SELL through Bread UI**

After the BUY proof passes, sell only the test amount acquired by the bounded proof (or a smaller bounded amount). Verify receipt success and the reverse exact pool route. No manual `cast send` is used as a substitute for the Bread UX proof.

- [ ] **Step 4: Reload/recovery proof**

Reload after confirmation and prove no persisted transaction is rebroadcast. Confirm the graduated token remains tradeable without reopening the bonding curve.

- [ ] **Step 5: Durable closeout**

Record both hashes, quotes/minimum outputs, exact route/dependency identity and final balances in evidence. Mark only the post-graduation trading regression PASS; do not upgrade unrelated Day-9 gates.
