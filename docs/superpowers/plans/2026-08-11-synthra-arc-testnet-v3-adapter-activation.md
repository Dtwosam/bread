# Synthra Arc Testnet V3 Adapter Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify and, only if exact deployment identity passes, activate an Arc Testnet Uniswap-V3-compatible graduation destination currently provided by Synthra while preserving Bread's DEX-neutral mainnet portability.

**Architecture:** Bread core remains bound only to `IGraduationAdapter`; no Synthra-specific branch enters financial business logic. Arc Testnet DEX selection is represented as adapter family plus dependency addresses in the network/protocol manifests, with vendor/source provenance bound into evidence. A generic V3 candidate validator proves code presence, Position Manager -> Factory identity, supported fee tier, and canonical Arc USDC before any candidate may replace `UNRESOLVED_TESTNET_ADAPTER`.

**Tech Stack:** Solidity/Foundry, Node.js ESM, JSON-RPC, Vitest, existing Bread manifest/config packages, GitHub Actions.

## Global Constraints

- Synthra is a testnet candidate only; no mainnet DEX selection is made here.
- Existing launches retain snapshotted adapter/configuration; later DEX changes apply only to new stack versions.
- No chain-specific DEX address may be hardcoded into Bread business logic.
- The canonical Bread quote asset remains Arc's 6-decimal ERC-20 USDC; native USDC remains gas-only.
- No DEX address is written to the canonical manifest until exact deployment identity is independently verified.
- `ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED` remains open on any evidence/compatibility failure.
- No Day-9 PASS, RC tag, Day-10 start, production economics decision, or mainnet activation is authorized by this lane.

---

### Task 1: Preserve the DEX-neutral activation contract

**Files:**
- Create: `docs/evidence/day9-synthra-arc-testnet-v3-candidate.md`
- Reference: `contracts/src/interfaces/IGraduationAdapter.sol`
- Reference: `contracts/src/graduation/BreadV3GraduationAdapter.sol`
- Reference: `config/protocol/day5-dex-source-inventory.json`

**Interfaces:**
- Consumes: current `IGraduationAdapter` family boundary and Project Source portability rules.
- Produces: one bounded candidate evidence record that separates venue discovery from deployment activation.

- [ ] **Step 1: Record source provenance and current evidence state**

Record Synthra's official documentation/Arc ecosystem evidence as proof that Synthra operates a V3-style concentrated-liquidity venue on Arc Testnet, but explicitly mark exact Factory/Position Manager identity as unresolved until verified.

- [ ] **Step 2: Record activation rules**

The evidence file must state that the canonical manifest remains unresolved unless the exact dependency pair passes Task 2. Do not put guessed addresses in the file.

- [ ] **Step 3: Commit**

```bash
git add docs/evidence/day9-synthra-arc-testnet-v3-candidate.md
git commit -m "docs(day9): record Synthra V3 testnet candidate"
```

### Task 2: Add a vendor-neutral V3 deployment-identity validator

**Files:**
- Create: `scripts/day9/verify-v3-dex-candidate.mjs`
- Create: `tests/day9/v3-dex-candidate-validation.test.ts`
- Modify: `package.json` only if a named script is necessary; otherwise execute the validator directly.

**Interfaces:**
- Consumes CLI arguments `--rpc-url`, `--chain-id`, `--usdc`, `--factory`, `--position-manager`, `--fee`.
- Produces exit code `0` plus a JSON PASS report on verified compatibility; non-zero plus a bounded error on mismatch/unresolved dependency.

The validator must be vendor-neutral. It may use V3 ABI signatures but may not contain the string `Synthra` or a Synthra address.

- [ ] **Step 1: Write the failing test**

Test a local mock JSON-RPC server and assert that the validator rejects:

1. wrong chain ID;
2. missing Factory bytecode;
3. missing Position Manager bytecode;
4. `positionManager.factory()` mismatch;
5. zero/unsupported `feeAmountTickSpacing(fee)`;
6. USDC `decimals()` not equal to 6.

Also assert one compatible fixture returns PASS with the exact supplied addresses and fee.

- [ ] **Step 2: Run the test to verify RED**

```bash
pnpm exec vitest run tests/day9/v3-dex-candidate-validation.test.ts
```

Expected: FAIL because `scripts/day9/verify-v3-dex-candidate.mjs` does not yet exist.

- [ ] **Step 3: Implement the minimal validator**

Use direct JSON-RPC only. Required calls:

```text
eth_chainId
eth_getCode(factory)
eth_getCode(positionManager)
eth_getCode(usdc)
eth_call usdc.decimals()
eth_call positionManager.factory()
eth_call factory.feeAmountTickSpacing(uint24 fee)
```

Encode only the minimal required selectors/ABI arguments. Reject empty code, address mismatch, chain mismatch, non-6-decimal USDC, and non-positive tick spacing. Emit a deterministic JSON report containing `status`, `chainId`, `usdc`, `factory`, `positionManager`, `fee`, and `tickSpacing`.

- [ ] **Step 4: Run focused test to verify GREEN**

```bash
pnpm exec vitest run tests/day9/v3-dex-candidate-validation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run adjacent manifest/Day-9 tests**

```bash
pnpm exec vitest run tests/day6/shared-contract.test.ts tests/day9/arc-testnet-environment-reconciliation.test.ts tests/day9/v3-dex-candidate-validation.test.ts
```

Expected: PASS while `arc-testnet.json` remains unresolved.

- [ ] **Step 6: Commit**

```bash
git add scripts/day9/verify-v3-dex-candidate.mjs tests/day9/v3-dex-candidate-validation.test.ts
git commit -m "test(day9): verify portable V3 DEX dependency identity"
```

### Task 3: Verify the real Synthra Arc Testnet deployment

**Files:**
- Update: `docs/evidence/day9-synthra-arc-testnet-v3-candidate.md`
- No canonical manifest update until this task passes.

**Interfaces:**
- Consumes: exact authoritative candidate Factory/Position Manager addresses plus Arc Testnet RPC.
- Produces: reproducible validator output and source provenance sufficient to calculate/bind a non-zero DEX evidence hash.

- [ ] **Step 1: Resolve exact candidate addresses from authoritative evidence**

Accept only an official Synthra deployment surface, official Arc integration/deployment publication, verified-source metadata tied to Synthra's deployment, or equivalent reproducible evidence. Do not use a third-party chain list or another network's Synthra addresses.

- [ ] **Step 2: Execute the generic validator against Arc Testnet**

```bash
node scripts/day9/verify-v3-dex-candidate.mjs \
  --rpc-url "$ARC_RPC_URL" \
  --chain-id 5042002 \
  --usdc 0x3600000000000000000000000000000000000000 \
  --factory "$VERIFIED_V3_FACTORY" \
  --position-manager "$VERIFIED_V3_POSITION_MANAGER" \
  --fee "$VERIFIED_V3_FEE"
```

Expected: deterministic PASS JSON. If it fails, stop activation and retain the blocker.

- [ ] **Step 3: Bind and record evidence**

Record the authoritative source identity, exact addresses, fee tier, validator output, checked block/time, and evidence hash. This is still not a money-path PASS.

### Task 4: Activate only the verified testnet manifest candidate

**Files:**
- Modify: `config/networks/arc-testnet.json`
- Modify: `config/protocol/day5-dex-source-inventory.json`
- Modify: `tests/day9/arc-testnet-environment-reconciliation.test.ts`
- Modify: `config/deployments/arc-testnet.day5.json` only as produced by the actual deployment lane, never prefilled with invented Bread contract addresses.

**Interfaces:**
- Consumes: Task-3 verified dependency pair and evidence hash.
- Produces: Arc Testnet network manifest selecting `UNISWAP_V3` family dependencies while keeping mainnet unresolved/independent.

- [ ] **Step 1: Write the manifest transition test first**

Change the Day-9 reconciliation test to require `dex.type === "UNISWAP_V3"`, exact verified `factory` and `positionManager`, and `poolManager === null`. Add an assertion that Arc mainnet remains unresolved and does not inherit the testnet DEX addresses.

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run tests/day9/arc-testnet-environment-reconciliation.test.ts
```

Expected: FAIL while the canonical Arc Testnet manifest remains unresolved.

- [ ] **Step 3: Update only manifest/evidence inventory values proved by Task 3**

Do not add Synthra-specific branches to Solidity/TypeScript financial code. The manifest `type` is the adapter family, not the venue brand.

- [ ] **Step 4: Run GREEN + manifest regressions**

```bash
pnpm exec vitest run tests/day6/shared-contract.test.ts tests/day9/arc-testnet-environment-reconciliation.test.ts tests/day9/v3-dex-candidate-validation.test.ts
```

Expected: PASS.

### Task 5: Rerun affected Day-9 deployment/financial gates

**Files:**
- Update evidence under `docs/evidence/` only from actual executions.
- Update `docs/current-build-state.yaml` only after the new exact-head matrix establishes the new blocker state.

**Interfaces:**
- Consumes: verified testnet manifest + deployed Bread stack + existing Day-9 rehearsal tooling.
- Produces: an exact-head Day-9 result. It may remain BLOCKED for multisig/physical-device/other release gates.

- [ ] **Step 1: Run the existing clean deployment/rehearsal automation using the verified manifest/evidence**

Use the same Day-9 scripts and schema; do not create a parallel Synthra-only deployment path.

- [ ] **Step 2: Prove the money-path lifecycle**

Required testnet proof remains launch -> buy -> sell -> claim -> graduate -> verify permanent lock -> reconcile USDC, including INV-050 through INV-056 and duplicate-liquidity/retry protections.

- [ ] **Step 3: Re-run the final exact-head matrix**

Only the exact resulting evidence may determine whether `ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED` and `ARC_TESTNET_DEPLOYMENT_MANIFEST_NOT_READY` close. Other blockers remain independent.

- [ ] **Step 4: Do not tag an RC unless the complete Day-9 gate passes**

No calendar or partial DEX success overrides any remaining mandatory blocker.
