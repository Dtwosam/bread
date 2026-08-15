# Day 9 — Synthra Arc Testnet V3 Candidate Evidence

Status: **DEX DEPENDENCY PASS — REAL-DEPENDENCY FORK PASS — 2-OF-3 SAFE PASS — PUBLIC BREAD DEPLOYMENT VERIFY PASS — SMOKE PENDING**

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
  "feeTiers": {"100": 1, "500": 10, "3000": 60, "10000": 200}
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

## Public Bread Arc Testnet deployment proof

The operator executed the non-broadcast preflight on exact head/source commit:

`db0f6ed28e4a2475f54e84efadd7cf9693701353`

and received:

```text
BREAD_ARC_TESTNET_DEPLOYMENT_PREFLIGHT_PASS
```

The preflight verified Safe ownership, canonical Arc USDC, V3 dependencies, fee `3000` / tick spacing `60`, the fork-evidence boundary, deployer gas, and the exact stack/economics/DEX hashes, then successfully simulated `DeployDay5Graduation.s.sol` without broadcast.

The operator then executed the crash-safe deployment runner and received:

```text
BREAD_ARC_TESTNET_DEPLOYMENT_VERIFY_PASS
```

Deployment start block: `56448201`.

Verified deployed Bread stack:

```text
feePolicy             = 0x388e534b94268e231a1badf14c4678f01bfc60e3
feeEscrow             = 0xea9bb3330e0a2c9898776c75f549d06d2a644c94
emergencyController   = 0xb6879be6a83b3a6e7a7de5cb841ca1550178ba42
factory               = 0xddf400f7a376fb8a962eee6d74c1ba37efa644f7
launchDeployer        = 0x89f70023c11b368d4ce5c6e4c100d4fa176f64fd
locker                = 0xecf66a3a221d90a413d9015803417aa8d4ba97fe
coordinator           = 0x239da83ec8294b2433848ea8c85155f41e76f60a
v3GraduationAdapter   = 0xfe2378a81d655e051b53aba57271d2b4d5b5dd84
```

Verified hashes/configuration:

```text
adapterConfigHash   = 0x4069e56d708b6bc2d4b003e09e6a566299b799bc8646732a901024fcf77781c7
economicsConfigHash = 0x081b597d7b603cb67d3921f269f7940a84221524b2d9baefc4f319c9f15f9747
dexEvidenceHash     = 0xd30f72e114168ae2786f24e1375804d4ba1dd99822bbb292855597c60384ea26
Protocol Admin Safe = 0x9004e285521d69197cd9965c301b02161eb1d0d8
Guardian            = 0xdcb9cb7038ff1a282265a855754dba8695a3121c
```

The runner reported 18 public Arc Testnet transaction hashes, `broadcastPerformed = true`, `resumedFromIntent = false`, `manifestStatus = VERIFIED`, `productionMoneyClaim = false`, `productionAuthorityClaim = false`, and `privateKeysPrinted = false`.

The canonical `config/deployments/arc-testnet.day5.json` now records this exact verified stack. The existing v1 deployment manifest schema does not permit a `sourceCommit` field (`additionalProperties: false`), so the exact deployment source commit remains preserved in the permission-restricted local deployment receipt and durable PR evidence rather than changing the shared schema mid-lane.

## Remaining public lifecycle smoke

`scripts/day9/smoke-bread-arc-testnet.mjs` is the next bounded execution step. It:

- requires the verified deployment and a 12-USDC testnet balance floor;
- writes PREPARED smoke intent before broadcast;
- executes the existing Bread launch/buy/graduate/lock/creator-claim/replay smoke;
- recovers the exact token and curve from `LaunchCreated` logs;
- verifies the permanent Position Manager NFT is owned by the Bread locker;
- refuses blind duplicate smoke launches.

## Portability classification

Nothing in this lane binds Bread mainnet to Synthra.

- `IGraduationAdapter` remains the core boundary.
- Network manifests hold chain-specific dependencies.
- Synthra is testnet provenance, not a financial authority or business-logic branch.
- Arc mainnet remains independently selected/revalidated later.
- A future stack may select canonical Uniswap V4, canonical V3 or another approved adapter.
- Existing launches retain their snapshotted adapter/config hash and cannot be redirected by later configuration.

## Current verdict

`SYNTHRA_ARC_TESTNET_V3_REAL_DEPENDENCY_FORK_PASS_SAFE_2_OF_3_PASS_BREAD_PUBLIC_TESTNET_DEPLOYMENT_VERIFY_PASS_SMOKE_PENDING`

Consequences:

- Synthra dependency identity: **PASS**.
- Independent Arc RPC compatibility: **PASS**.
- Real Bread↔Synthra fork integration: **PASS**.
- Genuine chain-specific 2-of-3 Arc Testnet Safe: **PASS**.
- Bread Arc Testnet deployment preflight: **PASS**.
- Live Bread Arc Testnet core deployment + configuration/ownership verification: **PASS**.
- `ARC_TESTNET_DEPLOYMENT_MANIFEST_NOT_READY`: **CLEARED**.
- Live Bread lifecycle smoke: **NOT YET PERFORMED**.
- Safe-compatible threshold recovery drill: **OPEN**.
- remaining physical/current-device rows: **OPEN**.
- exact-head CI: **OPEN**; current GitHub Actions runs still fail at startup before job creation, and current Vercel statuses are build-rate-limit failures rather than application-test evidence.
- No Day-9 PASS, RC tag, Day-10 start, production economics decision or mainnet DEX selection.
