# Day 9 — Synthra Arc Testnet V3 Candidate Evidence

Status: **DEX DEPENDENCY PASS — REAL-DEPENDENCY FORK PASS — 2-OF-3 SAFE PASS — PUBLIC BREAD DEPLOYMENT PREFLIGHT READY**

Checked: 2026-08-11
Baseline: `c21b49a1f8edaaad999e461edb0ce602071bda5c`
Candidate role: Arc Testnet-only graduation DEX dependency behind Bread's existing `IGraduationAdapter` boundary.

## Verified Synthra / Arc V3 dependency state

Current Synthra SDK deployment discovery for `ChainId.ARC` returned:

- Factory: `0x0fB6EEDA6e90E90797083861A75D15752a27f59c`
- Nonfungible Position Manager: `0x444Cc395346428216fB6f2892eb03cB804aE4CD5`
- Arc chain ID: `5042002`

Independent operator-executed read-only Arc RPC evidence proved:

```json
{
  "chainId": 5042002,
  "factoryCodeBytes": 24564,
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

Bread's canonical Arc Testnet network manifest therefore records only the generic `UNISWAP_V3` family plus the verified Factory / Position Manager. Synthra remains provenance/evidence metadata only.

## Real-dependency Bread integration proof

The operator executed `scripts/day9/run-arc-v3-fork-proof.mjs` against Arc fork block `56439192` and received:

```text
DAY9_ARC_V3_FORK_PROOF_PASS
```

The fork proof used the real Synthra Factory / Position Manager and canonical Arc USDC contract path. Stock Foundry does not implement Arc's Native Coin Control / Native Coin Authority precompiles, so fork-only shims emulate only those Arc primitives; the shims preserve real forked blocklist storage and are never deployed to Arc.

The PASS proved:

- Bread's V3 adapter constructs against the real dependencies;
- a fresh TOKEN/USDC pool can be created and initialized;
- the real Position Manager accepts the liquidity mint;
- the position NFT is minted directly to `BreadPermanentLiquidityLocker`;
- position ownership/registration is permanent-lock compatible;
- USDC/token used amounts plus explicit dust reconcile;
- adapter balances return to zero and allowances are cleared.

No live Arc transaction or private key was required by this fork proof.

## Safe authority proof

A read-only Arc probe proved Safe v1.4.1 core is present at:

- SafeL2: `0x29fcB43b46531BcA003ddC8FCB67FFE91900C762`
- SafeProxyFactory: `0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67`

The operator then generated five separate test-only identities locally with secret material stored only in a permission-restricted file outside the repository. Public identities are:

- deployment authority: `0x1bc5a40329b309be3ac77cb3688061b985f8d3fb`
- Guardian: `0xdcb9cb7038ff1a282265a855754dba8695a3121c`
- Safe owner 1: `0x2473795adf14b131ca76580acb4ecdff7ac08011`
- Safe owner 2: `0x5c277c90ff2608c4c65445498d63c77264998bb2`
- Safe owner 3: `0xf7755a64cc76051839968b367400f3215cef8d48`

After testnet faucet funding the deployment authority, the operator executed the chain-specific Safe creation and received:

```text
DAY9_ARC_SAFE_2_OF_3_PASS
```

Verified Safe:

- address: `0x9004e285521d69197cd9965c301b02161eb1d0d8`
- version: `1.4.1`
- threshold: `2`
- owner count: `3`
- chain-specific proxy: `true`
- Safe proxy runtime bytes reported: `171`
- Guardian remains separate from Safe owners and deployment authority;
- deployment authority is not a Safe owner;
- testnet protocol-fee recipient is the Safe, not the deployment EOA;
- private keys printed: `false`;
- production authority claim: `false`.

No official Safe service/API support claim is made for Arc; this evidence concerns the on-chain Safe contracts only.

## Public Arc Testnet economics classification

The controlling Project Sources permit explicit test-only values for testnet integration where production values are not required. They may not be silently promoted into production/public-mainnet configuration.

Bread's public Arc Testnet rehearsal preserves the controlled Day-9 supply/fee shape and divides only the quote-side fixture values by `10,000` so the full graduation smoke is faucet-sized:

```text
supply = 1000000000000000000000000
phantomQuote = 1000000          # 1 USDC
graduationThreshold = 10000000 # 10 USDC
launchFeeUsdc = 0
tradeFeeBps = 100
protocolFeeShareBps = 2500
maxCreatorTaxBps = 500
v3Fee = 3000
smokeQuoteIn = 11000000         # 11 USDC
smokeFundingFloor = 12000000    # 12 USDC
```

Provenance:
`DAY9_CONTROLLED_REHEARSAL_QUOTE_VALUES_DIVIDED_BY_10000`

The curve's graduation condition remains the production implementation (`sellableTokens() == 0`); no production curve logic or fee math is modified by the testnet scaling.

## Deployment tooling prepared

The following execution path is now prepared:

1. `scripts/day9/preflight-bread-arc-testnet-deployment.mjs`
   - verifies Arc identity, Safe threshold/owners, Guardian/deployer separation, canonical USDC, V3 dependencies, fee tier, fork evidence, deployer key identity and native gas;
   - derives exact stack/economics/DEX evidence hashes;
   - runs `DeployDay5Graduation.s.sol` without `--broadcast`;
   - prints no private keys and sends no transaction.
2. `scripts/day9/deploy-bread-arc-testnet.mjs`
   - writes a permission-restricted PREPARED receipt containing the exact source commit before any broadcast;
   - refuses ambiguous prior broadcast/deployment state;
   - uses the existing Bread production deployment script;
   - reads back exact CREATE addresses, writes the existing v1 deployment-manifest schema, executes configure/verify, and marks the manifest VERIFIED only after successful on-chain readback;
   - is resumable without blind duplicate deployment.
3. `scripts/day9/smoke-bread-arc-testnet.mjs`
   - requires a VERIFIED deployment and a 12-USDC testnet balance floor;
   - writes PREPARED smoke intent before broadcast;
   - executes the existing Bread launch/buy/graduate/lock/creator-claim/replay smoke;
   - recovers the exact token and curve from `LaunchCreated` logs;
   - verifies the permanent Position Manager NFT is owned by the Bread locker;
   - refuses blind duplicate smoke launches.

The existing v1 deployment manifest schema does not permit a `sourceCommit` field (`additionalProperties: false`), so source commit identity is preserved in the permission-restricted deployment receipt and durable PR evidence rather than silently changing the shared manifest schema during this lane.

## Portability classification

Nothing in this lane binds Bread mainnet to Synthra.

- `IGraduationAdapter` remains the core boundary.
- Network manifests hold chain-specific dependencies.
- Synthra is testnet provenance, not a financial authority or business-logic branch.
- Arc mainnet remains independently selected/revalidated later.
- A future stack may select canonical Uniswap V4, canonical V3 or another approved adapter.
- Existing launches retain their snapshotted adapter/config hash and cannot be redirected by later configuration.

## Current verdict

`SYNTHRA_ARC_TESTNET_V3_REAL_DEPENDENCY_FORK_PASS_SAFE_2_OF_3_PASS_BREAD_PUBLIC_TESTNET_DEPLOYMENT_PREFLIGHT_READY`

Consequences:

- Synthra dependency identity: **PASS**.
- Independent Arc RPC compatibility: **PASS**.
- Real Bread↔Synthra fork integration: **PASS**.
- Genuine chain-specific 2-of-3 Arc Testnet Safe: **PASS**.
- Bread Arc Testnet deployment preflight tooling: **READY / EXTERNAL EXECUTION PENDING**.
- Live Bread Arc Testnet core deployment: **NOT YET PERFORMED**.
- Live Bread lifecycle smoke: **NOT YET PERFORMED**.
- `ARC_TESTNET_DEPLOYMENT_MANIFEST_NOT_READY`: **OPEN** until deployment/verify succeeds.
- Safe-compatible threshold recovery drill: **OPEN**.
- remaining physical/current-device rows: **OPEN**.
- exact-head CI: **OPEN**; current GitHub Actions runs still fail at startup before job creation, and current Vercel statuses are build-rate-limit failures rather than application-test evidence.
- No Day-9 PASS, RC tag, Day-10 start, production economics decision or mainnet DEX selection.
