# Day 9 — Synthra Arc Testnet V3 Candidate Evidence

Status: **CURRENT SDK DEPLOYMENT IDENTITY PASS — INDEPENDENT ARC RPC PASS — REAL-DEPENDENCY FORK INTEGRATION PASS — PUBLIC TESTNET BREAD DEPLOYMENT PENDING**

Checked: 2026-08-11
Baseline main: `c21b49a1f8edaaad999e461edb0ce602071bda5c`
Fork-proof branch head executed by operator: `fe7bf6fcd33d2f23530dda54f18d29823cb9ce72`
Candidate role: Arc Testnet-only V3-compatible graduation dependency behind Bread's existing `IGraduationAdapter` boundary.

## Current Synthra Arc deployment identity

Synthra's current SDK registry was queried exactly through `getSynthraChainDeployment(ChainId.ARC)` from `@synthra-swap/sdk/chains` and returned:

- Arc chain ID: `5042002`
- Factory: `0x0fB6EEDA6e90E90797083861A75D15752a27f59c`
- Nonfungible Position Manager: `0x444Cc395346428216fB6f2892eb03cB804aE4CD5`
- Quoter: `0x3Ce954107b1A675826B33bF23060Dd655e3758fE`
- Multicall: `0xe139b61c9B8Eebf32bb335cb11AA6B7Cd69e13f4`
- SwapRouter02: `0xA545bCB1Bd7985c59ea162aB1748A0803434C31b`
- Universal Router: `0xbf4479C07Dc6fdc6dAa764A0ccA06969e894275F`

The SDK/documented Arc quote asset is canonical Arc USDC `0x3600000000000000000000000000000000000000` with 6 ERC-20 decimals, matching Bread's ratified Arc Testnet manifest.

## Independent Arc RPC dependency proof

A separate read-only operator-executed Arc RPC check proved:

```json
{
  "chainId": 5042002,
  "factory": "0x0fB6EEDA6e90E90797083861A75D15752a27f59c",
  "factoryCodeBytes": 24564,
  "positionManager": "0x444Cc395346428216fB6f2892eb03cB804aE4CD5",
  "positionManagerCodeBytes": 24384,
  "positionManagerFactory": "0x0fb6eeda6e90e90797083861a75d15752a27f59c",
  "factoryMatches": true,
  "usdc": "0x3600000000000000000000000000000000000000",
  "usdcCodeBytes": 1798,
  "usdcDecimals": 6,
  "feeTiers": {
    "100": 1,
    "500": 10,
    "3000": 60,
    "10000": 200
  }
}
```

Therefore the dependency-identity and fee-compatibility gate is PASS. The existing controlled Day-9 rehearsal fee `3000` is available with tick spacing `60`; it remains a testnet/rehearsal value and is not a production/mainnet economics decision.

## Arc Testnet manifest activation

`config/networks/arc-testnet.json` records only the generic adapter family and verified dependencies:

- `dex.type = UNISWAP_V3`
- `positionManager = 0x444Cc395346428216fB6f2892eb03cB804aE4CD5`
- `factory = 0x0fB6EEDA6e90E90797083861A75D15752a27f59c`
- `poolManager = null`

`Synthra` remains evidence/provenance metadata only. No core financial path branches on vendor identity.

## Real-dependency Arc fork proof — PASS

Repository proof surfaces:

- `contracts/test/fork/ArcV3DependencyFork.t.sol`
- `scripts/day9/run-arc-v3-fork-proof.mjs`

The operator executed the exact branch head `fe7bf6fcd33d2f23530dda54f18d29823cb9ce72` using Bread's pinned Foundry `v1.5.0` and received:

```text
DAY9_ARC_V3_FORK_PROOF_PASS
```

Exact reported result:

```json
{
  "chainId": 5042002,
  "forkBlock": 56439192,
  "factory": "0x0fB6EEDA6e90E90797083861A75D15752a27f59c",
  "positionManager": "0x444Cc395346428216fB6f2892eb03cB804aE4CD5",
  "positionManagerBlocklisted": false,
  "usdc": "0x3600000000000000000000000000000000000000",
  "v3Fee": 3000,
  "arcNativeCoinControlMode": "FOUNDRY_FORK_TEST_SHIM_ONLY_AFTER_PINNED_BLOCK_PREFLIGHT",
  "arcNativeCoinAuthorityMode": "FOUNDRY_FORK_TEST_SHIM_ONLY",
  "liveTransactionBroadcast": false,
  "privateKeyRequired": false,
  "mainnetDexSelected": false
}
```

The passing test exercises the real forked Synthra Factory and Nonfungible Position Manager, canonical Arc USDC contract behavior, Bread's real `BreadV3GraduationAdapter`, a fresh launch token and the real `BreadPermanentLiquidityLocker`.

The PASS proves the tested integration can:

- validate the exact Factory/Position-Manager relationship and enabled fee tier;
- transfer the canonical Arc USDC amount through Bread's adapter path in the Arc-compatible fork harness;
- create/initialize a fresh TOKEN/USDC V3 pool through the real Synthra dependencies;
- mint a full-range V3 position through the real Position Manager;
- mint the LP NFT directly to `BreadPermanentLiquidityLocker`;
- confirm `ownerOf(positionId)` is the permanent locker;
- reconcile USDC used + modeled dust to the supplied USDC amount;
- reconcile token used + modeled dust to the supplied pool-token amount;
- leave no adapter token/USDC residue;
- clear Position Manager allowances;
- register the locked position in the permanent locker.

## Foundry / Arc execution-environment qualification

Stock Foundry does not implement Arc's chain-specific native-USDC precompiles at:

- `0x1800000000000000000000000000000000000000` — Native Coin Authority;
- `0x1800000000000000000000000000000000000001` — Native Coin Control.

The fork proof therefore uses test-only shims at those exact addresses. This is not Bread production code and is never deployed to Arc.

The Native Coin Control shim reads the real forked Arc blocklist mapping at Solidity slot `2`, preserving the pinned-block blocklist state. The runner also performs a pinned-block RPC preflight showing the existing Synthra Position Manager is not blocklisted before fork substitution. The Native Coin Authority shim reproduces only the native-balance transfer primitive needed for canonical USDC movement, with cheatcode access explicitly limited to the fork-only etched authority address.

This qualification means the fork PASS is strong real-dependency integration evidence, but it is not a substitute for the source-required clean public Arc Testnet deployment/rehearsal using Arc's native execution client.

## Portability preserved

This testnet dependency selection does not bind Bread mainnet to Synthra.

A later mainnet protocol-stack version may independently select canonical Uniswap V4, canonical Uniswap V3, or another approved DEX adapter after its own deployment/security/compatibility gate. Existing launches retain their snapshotted adapter and graduation config hash. A later DEX change applies only to new stack launches and cannot silently redirect existing launches.

Arc mainnet remains unresolved in Bread's canonical mainnet manifest and no Synthra mainnet dependency is selected.

## Source-defined next gate

The financial-invariants source requires integration/fork tests with canonical USDC + selected DEX dependencies in a production-like environment; this fork gate is now PASS for the selected Arc Testnet V3 dependencies.

The Day-9 release-candidate source still requires a **clean Arc Testnet deployment using production scripts**, followed by code/config/ownership verification and smoke lifecycle before the release-candidate/rehearsal lane can close.

The remaining DEX/deployment work therefore is:

1. deploy/wire a test-only Bread protocol stack on public Arc Testnet using the existing production deployment scripts and manifest schema;
2. use canonical Arc USDC and the verified V3 Factory/Position Manager;
3. retain the explicit test-only V3 fee `3000` for the controlled rehearsal unless a controlling source changes it;
4. verify deployed code/config/ownership/adapter config hash and write the deployment manifest;
5. run the public-testnet launch → trade → graduation → permanent-lock smoke lifecycle;
6. prove failed external progression/retry cannot duplicate pool/liquidity or double-spend swept assets in the integrated deployment evidence;
7. retain all remaining Day-9 non-DEX gates: recovery/multisig drill, supported physical matrix, exact-head CI, evidence bundle and RC freeze.

## Current bounded verdict

`SYNTHRA_ARC_TESTNET_V3_REAL_DEPENDENCY_FORK_INTEGRATION_PASS_PUBLIC_TESTNET_BREAD_DEPLOYMENT_PENDING`

Consequences:

- Synthra Arc Testnet address discovery: **PASS**.
- Independent Arc RPC dependency identity: **PASS**.
- V3 `3000` test/rehearsal fee availability: **PASS** (`tickSpacing = 60`).
- Arc Testnet network-manifest dependency activation: **PASS / RECORDED**.
- Real-dependency Bread/Synthra fork integration: **PASS** at fork block `56439192`.
- `ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED`: **CLEARED for dependency identity and fork compatibility**; public Bread deployment/smoke evidence still required by Day 9.
- `ARC_TESTNET_DEPLOYMENT_MANIFEST_NOT_READY`: remains **OPEN** until Bread's own public-testnet contracts are deployed, verified and recorded.
- No Day-9 PASS or RC tag yet.
- Day 10 remains stopped.
- No production/mainnet DEX or fee choice is implied.
