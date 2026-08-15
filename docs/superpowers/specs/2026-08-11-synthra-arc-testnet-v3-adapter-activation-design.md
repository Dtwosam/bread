# Synthra Arc Testnet V3 Adapter Activation Design

**Status:** Approved implementation design for bounded Day-9 investigation/activation work. Synthra is a testnet candidate only; this document does not activate it and does not select any mainnet DEX.

## Goal

Use a verified Synthra V3 deployment on Arc Testnet as Bread's temporary graduation DEX only if its on-chain dependencies pass Bread's existing V3 compatibility/security gates, while preserving the Project Source requirement that a later mainnet stack can select canonical Uniswap V4, canonical Uniswap V3, or another explicitly approved Arc DEX without rewriting Bread financial business logic.

## Controlling source rules

- Graduation remains `GraduationCoordinator -> IGraduationAdapter -> selected approved adapter -> TOKEN/USDC liquidity -> permanent lock`.
- The protocol-stack version selects an approved adapter; creators cannot provide arbitrary adapter addresses.
- Every launch snapshots its adapter and graduation parameters. A later DEX selection applies only to new protocol-stack launches and must not silently mutate existing launches.
- The network manifest owns chain-specific DEX dependency addresses. DEX addresses must not be scattered through contracts, frontend, API, indexer, or business logic.
- Testnet and mainnet keep the same manifest schema and deployment/rehearsal contract. Mainnet is configuration plus validation, not a new financial implementation.
- Preferred production target remains canonical Uniswap V4 on Arc; canonical Uniswap V3 remains the documented fallback. Synthra testnet use creates no production preference or mainnet commitment.
- No DEX dependency may be activated from expectation, branding, search snippets, or an unverified frontend address. Exact deployed identity and compatibility are mandatory.

## Architecture

### Stable Bread boundary

Bread core continues to depend only on `IGraduationAdapter`. `GraduationCoordinator`, launch configuration, bonding-curve accounting, fee accounting, permanent-lock semantics, and indexer/API event meaning remain independent of the selected DEX venue.

The current `BreadV3GraduationAdapter` is the candidate execution adapter because it already exposes the DEX-neutral `IGraduationAdapter` contract while interacting with a narrowly defined Uniswap-V3-compatible Factory, Nonfungible Position Manager, and pool `slot0()` surface.

No contract or application business logic may branch on the string `Synthra`.

### Testnet selection

If and only if authoritative evidence yields an Arc Testnet Synthra V3 Factory and Nonfungible Position Manager, Bread may represent the selected testnet DEX by adapter family, not vendor identity:

- `dex.type = "UNISWAP_V3"`
- `dex.factory = <verified Arc Testnet V3 factory>`
- `dex.positionManager = <verified matching V3 position manager>`
- `dex.poolManager = null`

The Synthra/vendor provenance belongs in the DEX evidence inventory and Day-9 evidence, not in financial execution logic.

### Future mainnet selection

A future stack may select a different approved adapter/dependency set through the same network/protocol manifest boundary. Existing launches retain their snapshotted adapter/config hash. New stack versions may point at Uniswap V4, Uniswap V3, or another approved adapter after its own source, deployment-identity, security, invariant, and smoke-lifecycle gates pass.

## Activation evidence gate

Before changing `config/networks/arc-testnet.json` from `UNRESOLVED_TESTNET_ADAPTER`, all of the following must be proved:

1. Synthra is actually deployed on Arc Testnet, not merely advertised as supporting Arc.
2. Exact Factory and Nonfungible Position Manager addresses come from an authoritative Synthra/Arc deployment surface or are independently tied to the official deployment by reproducible on-chain evidence.
3. Both addresses have contract bytecode on Arc Testnet.
4. `positionManager.factory()` equals the candidate Factory.
5. The Factory exposes the V3 methods Bread requires: `feeAmountTickSpacing(uint24)` and `getPool(address,address,uint24)`.
6. The selected fee tier returns positive tick spacing.
7. The Position Manager exposes the V3 methods Bread requires: `createAndInitializePoolIfNecessary(...)` and `mint(...)` with the expected behavior/ABI shape.
8. A bounded compatibility proof shows Bread can create/initialize a TOKEN/USDC pool, mint the LP NFT directly to `BreadPermanentLiquidityLocker`, reconcile exact 6-decimal ERC-20 USDC apart from modeled dust, and preserve exactly-once/retry behavior.
9. The DEX evidence hash is non-zero and binds the exact verified deployment evidence used by the deployment candidate.

If any item is unresolved, `ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED` remains open and the canonical network manifest stays unresolved.

## Deployment portability

The current Day-5 Foundry script is V3-shaped at the adapter-construction step. This is acceptable for the current V3-only testnet candidate, but it must not become the source of DEX semantics. The durable contract is:

- all DEX addresses are supplied from the selected manifest/evidence lane;
- all V3-specific construction is bounded to the V3 adapter/deployment module;
- no Synthra-specific address or branch enters `GraduationCoordinator`, launch factory/curve, frontend trading logic, API, indexer, or shared financial types;
- a future V4/other adapter is added behind `IGraduationAdapter` and selected by a new protocol-stack manifest/version, not by modifying existing launches.

A second live adapter family is the point at which deployment orchestration must gain family dispatch. We do not invent a V4 implementation or V4 addresses before Arc publishes and verifies them.

## Verification

Activation requires source/evidence review, manifest consistency tests, adapter unit/fuzz/invariant coverage, exact dependency identity checks, clean deployment rehearsal, full launch -> buy -> sell -> claim -> graduate -> permanent-lock -> USDC reconciliation smoke proof, and affected Day-9 final-gate reruns.

## Explicit non-goals

- No Synthra mainnet commitment.
- No production economics changes.
- No change to Pons-derived lifecycle semantics.
- No migration of existing launches to a new adapter.
- No vendor-specific code in core Bread financial paths.
- No guessed Arc Testnet contract addresses.
- No Day-9 PASS, RC tag, or Day-10 authorization from this design alone.
