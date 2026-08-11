# Day 9 — Synthra Arc Testnet V3 Candidate Evidence

Status: **CANDIDATE CONFIRMED ON ARC TESTNET — EXACT DEPLOYMENT IDENTITY UNRESOLVED — ACTIVATION BLOCKED**

Checked: 2026-08-11
Baseline: `c21b49a1f8edaaad999e461edb0ce602071bda5c`
Candidate role: Arc Testnet-only graduation DEX candidate behind Bread's existing `IGraduationAdapter` boundary.

## What is established

1. Arc's own community surface describes Synthra as an all-in-one decentralized trading platform on **Arc Testnet** with spot swaps and concentrated liquidity.
   - Source: `https://community.arc.io/public/events/builder-spotlight-synthra-spot-concentrated-liquidity-and-perpetual-markets-on-arc-p22y3ym3ce`
2. Synthra's official documentation describes spot execution as **Synthra V3 concentrated liquidity** and describes Arc as its primary execution chain.
   - Source: `https://docs.synthra.org/`
3. Synthra publishes V3-named package surfaces including `@synthra-swap/v3-core`, `@synthra-swap/v3-periphery`, and `@synthra-swap/v3-sdk`. These are useful source/ABI research inputs but do not by themselves prove which exact contracts are the current Arc Testnet deployment.
4. Bread already has an inactive-by-default `BreadV3GraduationAdapter` implementing `IGraduationAdapter` against a narrow V3-compatible Factory / Position Manager ABI. Its existence does not authorize network activation.

## What is not yet established

The bounded research performed on 2026-08-11 did **not** yet produce an authoritative, independently verified Arc Testnet pair for:

- V3 Factory;
- Nonfungible Position Manager;
- selected fee tier.

Search-engine snippets, another network's Synthra deployment, a copied chain list, or an arbitrary address observed in a frontend are insufficient for Bread's financial activation gate.

No candidate address is recorded here because the Project Sources prohibit inventing or promoting unresolved DEX dependencies.

## Portability classification

Synthra is **not** a new Bread protocol authority and is **not** a new core adapter family.

If its Arc Testnet deployment proves compatible, Bread will classify the execution family as `UNISWAP_V3` and place the verified Factory / Position Manager addresses in the Arc Testnet network/deployment manifests. The string `Synthra` remains provenance/evidence metadata only; it must not enter `GraduationCoordinator`, bonding-curve accounting, fee accounting, API/indexer financial truth, or frontend transaction semantics.

A future mainnet protocol-stack version may independently select canonical Uniswap V4, canonical Uniswap V3, or another approved adapter. Existing launches retain their snapshotted adapter and graduation config hash.

## Mandatory compatibility checks before activation

The candidate remains blocked until a reproducible Arc Testnet check proves all of the following:

- RPC chain ID is exactly `5042002`;
- canonical Bread ERC-20 USDC is `0x3600000000000000000000000000000000000000` and reports `decimals() == 6`;
- Factory has runtime bytecode;
- Position Manager has runtime bytecode;
- `positionManager.factory()` equals the candidate Factory;
- `factory.feeAmountTickSpacing(selectedFee)` returns positive tick spacing;
- the V3 ABI behavior required by `BreadV3GraduationAdapter` is compatible;
- a real Bread testnet graduation can create/initialize the TOKEN/USDC pool, mint the position to `BreadPermanentLiquidityLocker`, preserve permanent-lock ownership, return/reconcile dust correctly, and satisfy the existing graduation invariants/retry protections.

## Current verdict

`SYNTHRA_ARC_TESTNET_V3_CANDIDATE_DISCOVERY_PASS_DEPLOYMENT_IDENTITY_BLOCKED`

Consequences:

- `ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED` remains **OPEN**.
- `ARC_TESTNET_DEPLOYMENT_MANIFEST_NOT_READY` remains **OPEN**.
- `config/networks/arc-testnet.json` remains `UNRESOLVED_TESTNET_ADAPTER`.
- No Bread contract deployment is authorized from this evidence alone.
- No Day-9 PASS, RC tag, Day-10 start, production DEX decision, or mainnet choice is implied.
