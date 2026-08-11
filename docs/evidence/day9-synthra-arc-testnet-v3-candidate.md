# Day 9 — Synthra Arc Testnet V3 Candidate Evidence

Status: **CURRENT SDK DEPLOYMENT IDENTITIES RESOLVED — INDEPENDENT ARC RPC DEPENDENCY COMPATIBILITY PASS — REAL-DEPENDENCY FORK PROOF PREPARED / EXECUTION PENDING**

Checked: 2026-08-11
Baseline: `c21b49a1f8edaaad999e461edb0ce602071bda5c`
Candidate role: Arc Testnet-only graduation DEX dependency behind Bread's existing `IGraduationAdapter` boundary.

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

5. The same official Synthra guidance defines Arc USDC as `0x3600000000000000000000000000000000000000` with 6 decimals, matching Bread's ratified Arc Testnet quote-asset configuration.
6. Bread has a vendor-neutral `BreadV3GraduationAdapter` implementing `IGraduationAdapter` against the required V3-compatible Factory / Position Manager ABI. Synthra does not become a Bread protocol authority or a new core adapter family.
7. Bread has a vendor-neutral pre-activation validator at `scripts/day9/verify-v3-dex-candidate.mjs`. It accepts only RPC/chain/USDC/Factory/Position-Manager/fee inputs and contains no Synthra-specific branch or address.

## Independent Arc RPC compatibility evidence

On 2026-08-11, after the SDK lookup, the operator executed a separate **read-only** JSON-RPC identity check against `https://rpc.testnet.arc.network`. No wallet connection, signature or transaction was involved.

Observed result:

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

This independently establishes the dependency-identity subset required by the Project Sources:

- Arc chain ID is exactly `5042002`;
- canonical Bread ERC-20 USDC has runtime code and reports exactly 6 decimals;
- the SDK-derived Factory has runtime bytecode;
- the SDK-derived Position Manager has runtime bytecode;
- `positionManager.factory()` equals the SDK-derived Factory;
- all four checked standard V3 fee tiers are enabled with positive tick spacing;
- the existing Day-9 controlled rehearsal fee `3000` is supported on this deployment with tick spacing `60`.

The `3000` value remains a **testnet/rehearsal value**, inherited from Bread's existing Day-9 controlled-fixture baseline. This evidence does not select or approve a production/mainnet LP fee tier.

## Manifest activation classification

The independently verified dependency identity satisfies the Project Source rule requiring official/current DEX deployment evidence plus compatibility checks before network-manifest activation.

`config/networks/arc-testnet.json` therefore identifies the current testnet dependency family as `UNISWAP_V3` with:

- `positionManager = 0x444Cc395346428216fB6f2892eb03cB804aE4CD5`
- `factory = 0x0fB6EEDA6e90E90797083861A75D15752a27f59c`
- `poolManager = null`

The string `Synthra` remains provenance/evidence metadata only and does **not** enter the financial core, coordinator, adapter family enum, API/indexer financial truth or frontend transaction semantics.

## Portability classification

This Arc Testnet activation does not bind Bread mainnet to Synthra.

A future mainnet protocol-stack version may independently select canonical Uniswap V4, canonical Uniswap V3, or another approved adapter after its own deployment/security gate. Existing launches retain their snapshotted adapter and graduation config hash; later stack/config changes cannot move an existing launch to another DEX destination.

## Real-dependency fork proof prepared

The repository now contains a fork-only integration proof:

- `contracts/test/fork/ArcV3DependencyFork.t.sol`
- `scripts/day9/run-arc-v3-fork-proof.mjs`

The runner reads the canonical Arc Testnet network manifest instead of duplicating Bread dependency addresses. It pins a current Arc Testnet block, reruns the vendor-neutral dependency validator, discovers an existing Synthra SYN/USDC pool only as a local-fork USDC donor, then runs Foundry against the real Arc Factory / Position Manager and canonical USDC.

The fork test is designed to prove, without broadcasting any Arc transaction or requiring a private key:

- `BreadV3GraduationAdapter` constructs successfully against the real dependencies;
- a fresh TOKEN/USDC pool can be created/initialized at the adapter-computed opening price;
- the real Position Manager accepts the full-range V3 mint call;
- the LP NFT is minted directly to `BreadPermanentLiquidityLocker`;
- the locker can register the position by verifying `ownerOf(positionId)`;
- USDC/token used amounts plus explicit dust reconcile exactly to the supplied amounts;
- adapter token balances return to zero;
- Position Manager allowances are cleared after execution.

The pinned official Uniswap V3 reference implementation uses ordinary ERC-721 `_mint(params.recipient, ...)` for position creation rather than `_safeMint`; therefore the Bread locker does not require a general ERC-721 receive callback merely to receive a standard V3 position. The real Synthra deployed behavior is still treated as unproven until this fork test executes successfully.

## What remains before Bread may treat the DEX lane as fully integrated

Dependency identity is PASS. The next mandatory step is executing the prepared fork proof. If the fork passes, proceed to the remaining Bread-specific graduation/retry/invariant proofs and then a controlled real Arc Testnet Bread deployment using test-only approved values and safe testnet authorities.

A real deployment must still prove:

- deploy/wire a test-only Bread protocol stack through the existing deployment scripts and manifest schema;
- use the canonical 6-decimal Arc ERC-20 USDC quote asset;
- use the verified V3 Factory / Position Manager dependencies;
- use an explicit test-only V3 fee (the existing Day-9 controlled baseline uses `3000`);
- create/initialize the TOKEN/USDC pool through `BreadV3GraduationAdapter`;
- mint the LP NFT directly to `BreadPermanentLiquidityLocker`;
- prove pool identity/opening price and permanent-lock ownership;
- reconcile all used USDC/tokens and explicit dust;
- prove failed external progression/retry cannot duplicate the pool/liquidity or double-spend swept assets;
- satisfy INV-050 through INV-056 and the existing smoke/verification gates.

No mainnet economics, admin, recipient, DEX address or production fee value is authorized by this testnet evidence.

## Current verdict

`SYNTHRA_ARC_TESTNET_V3_DEPENDENCY_PASS_FORK_PROOF_PREPARED_EXECUTION_PENDING`

Consequences:

- Synthra Arc Testnet address discovery: **PASS**.
- Independent Arc RPC dependency identity: **PASS**.
- V3 `3000` test/rehearsal fee availability: **PASS** (`tickSpacing = 60`).
- Arc Testnet network-manifest DEX dependency activation: **PASS / RECORDED**.
- Real-dependency fork integration: **PREPARED / EXECUTION PENDING**.
- `ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED`: dependency-evidence sub-blocker **CLEARED**; full Bread integration evidence/hash remains pending.
- `ARC_TESTNET_DEPLOYMENT_MANIFEST_NOT_READY`: remains **OPEN** until Bread's own testnet contracts are actually deployed, verified and recorded.
- No Day-9 PASS or RC tag yet.
- Day 10 remains stopped.
- No production/mainnet DEX choice is implied.
