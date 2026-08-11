# Day 9 — Synthra Arc Testnet V3 Candidate Evidence

Status: **CURRENT SDK DEPLOYMENT IDENTITIES RESOLVED — INDEPENDENT ARC RPC IDENTITY CHECK PENDING — ACTIVATION BLOCKED**

Checked: 2026-08-11
Baseline: `c21b49a1f8edaaad999e461edb0ce602071bda5c`
Candidate role: Arc Testnet-only graduation DEX candidate behind Bread's existing `IGraduationAdapter` boundary.

## What is established

1. Arc's own community surface describes Synthra as an all-in-one decentralized trading platform on **Arc Testnet** with spot swaps and concentrated liquidity.
   - Source: `https://community.arc.io/public/events/builder-spotlight-synthra-spot-concentrated-liquidity-and-perpetual-markets-on-arc-p22y3ym3ce`
2. Synthra's official documentation describes spot execution as **Synthra V3 concentrated liquidity** and describes Arc as its primary execution chain.
   - Source: `https://docs.synthra.org/`
3. Synthra's current Smart Contract Integration / Local Development guidance says applications and protocols must not hardcode old router/manager addresses and should load current chain-specific deployment identities from the SDK registry using `getSynthraChainDeployment(ChainId.ARC)`.
4. On 2026-08-11, the operator executed that exact current-SDK lookup in a fresh temporary npm project using `@synthra-swap/sdk/chains`. The returned Arc deployment object reported chain ID `5042002` and the following V3 dependencies:

   - Factory: `0x0fB6EEDA6e90E90797083861A75D15752a27f59c`
   - Nonfungible Position Manager: `0x444Cc395346428216fB6f2892eb03cB804aE4CD5`
   - Quoter: `0x3Ce954107b1A675826B33bF23060Dd655e3758fE`
   - Multicall: `0xe139b61c9B8Eebf32bb335cb11AA6B7Cd69e13f4`
   - SwapRouter02: `0xA545bCB1Bd7985c59ea162aB1748A0803434C31b`
   - Universal Router: `0xbf4479C07Dc6fdc6dAa764A0ccA06969e894275F`

   These values are classified as **current Synthra SDK-derived Arc candidate deployment identities**. They are not yet canonical Bread configuration until independently checked against Arc RPC.
5. The same official Synthra guidance defines Arc USDC as `0x3600000000000000000000000000000000000000` with 6 decimals, matching Bread's already-ratified Arc Testnet quote-asset configuration.
6. Bread already has an inactive-by-default `BreadV3GraduationAdapter` implementing `IGraduationAdapter` against a narrow V3-compatible Factory / Position Manager ABI. Its existence does not authorize network activation.
7. Bread now has a **vendor-neutral** pre-activation validator at `scripts/day9/verify-v3-dex-candidate.mjs`. It accepts only RPC/chain/USDC/Factory/Position-Manager/fee inputs and contains no Synthra-specific branch or address. Its focused fixtures cover the compatible case plus wrong-chain, missing-code, Position-Manager/Factory mismatch, disabled-fee-tier and non-6-decimal-USDC rejection.

## What remains to be established

The exact Arc candidate Factory and Position Manager are now resolved from Synthra's current SDK registry. The remaining dependency-identity gate is **independent Arc RPC verification**, specifically:

- Arc RPC reports chain ID exactly `5042002`;
- canonical Bread ERC-20 USDC reports 6 decimals and has runtime code;
- the SDK-derived Factory has runtime code;
- the SDK-derived Position Manager has runtime code;
- `positionManager.factory()` equals `0x0fB6EEDA6e90E90797083861A75D15752a27f59c`;
- the selected V3 fee tier returns positive `feeAmountTickSpacing`.

Bread's connected execution environment currently cannot resolve `rpc.testnet.arc.network` DNS, so the independent RPC check must not be silently inferred from the SDK result. The repository remains fail-closed until the reproducible RPC output is captured.

## Portability classification

Synthra is **not** a new Bread protocol authority and is **not** a new core adapter family.

If the SDK-derived Arc dependencies pass the independent compatibility gate, Bread will classify execution as `UNISWAP_V3` and place the verified Factory / Position Manager addresses in the Arc Testnet network/deployment manifests. The string `Synthra` remains provenance/evidence metadata only; it must not enter `GraduationCoordinator`, bonding-curve accounting, fee accounting, API/indexer financial truth, or frontend transaction semantics.

A future mainnet protocol-stack version may independently select canonical Uniswap V4, canonical Uniswap V3, or another approved adapter. Existing launches retain their snapshotted adapter and graduation config hash. Changing the testnet venue therefore does not bind Bread mainnet to Synthra.

## Mandatory compatibility checks before activation

The candidate remains blocked until a reproducible Arc Testnet check proves all of the following:

- RPC chain ID is exactly `5042002`;
- canonical Bread ERC-20 USDC is `0x3600000000000000000000000000000000000000` and reports `decimals() == 6`;
- Factory has runtime bytecode;
- Position Manager has runtime bytecode;
- `positionManager.factory()` equals the SDK-derived Factory;
- `factory.feeAmountTickSpacing(selectedFee)` returns positive tick spacing;
- the V3 ABI behavior required by `BreadV3GraduationAdapter` is compatible;
- a real Bread testnet graduation can create/initialize the TOKEN/USDC pool, mint the position to `BreadPermanentLiquidityLocker`, preserve permanent-lock ownership, return/reconcile dust correctly, and satisfy the existing graduation invariants/retry protections.

The generic validator mechanically covers the dependency-identity subset. The full money-path compatibility proof remains a separate gate and must run only after dependency identity passes.

## Current verdict

`SYNTHRA_ARC_TESTNET_V3_SDK_DEPLOYMENT_IDENTITY_DISCOVERY_PASS_RPC_COMPATIBILITY_PENDING`

Consequences:

- the previous address-discovery sub-blocker is **CLEARED** by the current SDK registry output;
- `ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED` remains **OPEN** pending independent RPC compatibility proof and graduation smoke;
- `ARC_TESTNET_DEPLOYMENT_MANIFEST_NOT_READY` remains **OPEN**;
- `config/networks/arc-testnet.json` remains `UNRESOLVED_TESTNET_ADAPTER` until the RPC check passes;
- no Bread contract deployment is authorized from SDK output alone;
- no Day-9 PASS, RC tag, Day-10 start, production DEX decision, or mainnet choice is implied.
