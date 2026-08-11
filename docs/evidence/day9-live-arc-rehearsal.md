# Day 9 Live Arc Testnet Rehearsal Gate

Status: **DEX/FORK/SAFE/DEPLOYMENT VERIFY PASS — PUBLIC LIFECYCLE SMOKE PENDING**

This evidence records the current Day-9 live-Arc decision boundary. It is not a production-money authorization and it does not authorize Arc mainnet.

## Verified prerequisite state

- Arc Testnet network identity is reconciled to chain ID `5042002`, canonical 6-decimal USDC, and the current `rpc.testnet.arc.network` / `wss://rpc.testnet.arc.network` endpoints.
- The Arc Testnet network manifest selects the generic `UNISWAP_V3` dependency family using the independently verified Synthra-compatible Factory `0x0fB6EEDA6e90E90797083861A75D15752a27f59c` and Position Manager `0x444Cc395346428216fB6f2892eb03cB804aE4CD5`.
- Current Synthra SDK identity discovery, independent Arc RPC dependency checks, and the real-dependency Bread fork proof all PASS. The fork proof executed at Arc block `56439192` with V3 fee `3000`, exercising real pool creation/liquidity mint/permanent-lock ownership without a live Arc broadcast.
- Safe v1.4.1 core contracts are present on Arc Testnet at `SafeL2 = 0x29fcB43b46531BcA003ddC8FCB67FFE91900C762` and `SafeProxyFactory = 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67`.
- A chain-specific 2-of-3 Safe has been created and independently read back at `0x9004e285521d69197cd9965c301b02161eb1d0d8`, version `1.4.1`, threshold `2`, with three distinct test-only owners. The separate Guardian is `0xdcb9cb7038ff1a282265a855754dba8695a3121c` and the separate ephemeral deployment authority is `0x1bc5a40329b309be3ac77cb3688061b985f8d3fb`.
- No private keys were printed or committed. Safe service/API support for Arc is not claimed.

## Bread Arc Testnet deployment verification PASS

The operator executed the source-pinned deployment path on exact source commit:

`db0f6ed28e4a2475f54e84efadd7cf9693701353`

The non-broadcast preflight passed first and proved:

- deployment authority native balance `19994209193160000000` wei;
- Safe v1.4.1 threshold `2` and the expected three owners;
- canonical Arc Testnet USDC code/decimals;
- V3 Factory/Position Manager code and fee `3000` with tick spacing `60`;
- fork-evidence block `56439192`;
- stack version `0xc862a0ec7e5eb592f1a77b4971552b79f65528b1f1addf97fdfc42b8f774e063`;
- economics config hash `0x081b597d7b603cb67d3921f269f7940a84221524b2d9baefc4f319c9f15f9747`;
- DEX evidence hash `0xd30f72e114168ae2786f24e1375804d4ba1dd99822bbb292855597c60384ea26`;
- real deployment simulation PASS with `transactionBroadcast = false`.

The subsequent controlled public Arc Testnet deployment then returned:

`BREAD_ARC_TESTNET_DEPLOYMENT_VERIFY_PASS`

Deployment start block: `56448201`.

Verified deployed contracts:

```text
BreadFeePolicy                  = 0x388e534b94268e231a1badf14c4678f01bfc60e3
BreadFeeEscrow                  = 0xea9bb3330e0a2c9898776c75f549d06d2a644c94
BreadEmergencyController        = 0xb6879be6a83b3a6e7a7de5cb841ca1550178ba42
BreadLaunchFactory              = 0xddf400f7a376fb8a962eee6d74c1ba37efa644f7
BreadLaunchDeployer             = 0x89f70023c11b368d4ce5c6e4c100d4fa176f64fd
BreadPermanentLiquidityLocker   = 0xecf66a3a221d90a413d9015803417aa8d4ba97fe
GraduationCoordinator           = 0x239da83ec8294b2433848ea8c85155f41e76f60a
BreadV3GraduationAdapter        = 0xfe2378a81d655e051b53aba57271d2b4d5b5dd84
```

Verified adapter/dependency state:

```text
family            = UNISWAP_V3
positionManager   = 0x444Cc395346428216fB6f2892eb03cB804aE4CD5
v3Factory         = 0x0fB6EEDA6e90E90797083861A75D15752a27f59c
v3Fee             = 3000
adapterConfigHash = 0x4069e56d708b6bc2d4b003e09e6a566299b799bc8646732a901024fcf77781c7
```

Verified authority state:

```text
Protocol Admin Safe = 0x9004e285521d69197cd9965c301b02161eb1d0d8
Guardian            = 0xdcb9cb7038ff1a282265a855754dba8695a3121c
```

The canonical `config/deployments/arc-testnet.day5.json` manifest is now `VERIFIED` and records these exact addresses/hashes/start block. The runner reported `broadcastPerformed = true`, `resumedFromIntent = false`, `productionMoneyClaim = false`, `productionAuthorityClaim = false`, and `privateKeysPrinted = false`.

The local durable deployment receipt remains outside the repository at:

`~/.config/bread/day9-arc-testnet-bread-deployment.json`

### Deployment transactions

The deployment/initialization/ownership-handoff sequence recorded 18 Arc Testnet transaction hashes:

```text
0x8ec6fa9422705922ecda4b5b4259635e50b789cc1892df30fc92b829045220a5
0xfddd8b8bc2db5057c8768ae47ddd6b06be07a81f2ff5b7a9e2f948dfbe0b07d8
0xb6bb9c7b6e24013a1da73b4e3b40867a260bab0b7f96c10828477491117fe34e
0x06324642ee1c1838700ff66a3fdca1ce0d07a581c34e81e33ad7c01cb63416df
0xb42180c7ab51955d5bfdbd50027a8ae0178ecab9d8abd21c27aad75280dc087b
0xd18eb71a4f3c4c25fb38905e933e761d4aef79735dc41f265c0a51bfad391bf0
0xc3b52c0062df7a08dc7714e8020b1da51fb9b396fd1a9aad45c213de3c7d1644
0x358c1504ab7cfda034cf1d22bf2fae1843e418c9c3aecc426d8169476e8628fa
0x02244fcf372ed5d8f4759d21a0d9ce11b8540b7ad93deca4ee2e9dcfb9bad91f
0x709587972cc843a51754507d1ef80fbaad2a82890dfa49df4e98c9f9747f589a
0x710d4e294f0473f1f21a7ea53726afa11d6d7d13eda048cf16c4d654f0fbaf54
0x689b5c90eb1320e50c25b84fa9ccd6e20aff6f4237d47db543994bc6970f410b
0xde433f8097a5d5a53bd82915e19c5ffdbe0982db0d7954aae8e7e3f196cc1ea6
0x1aa41d3641ecf96cf72ed2ffa9545045ae665e65517844d3ee226d9c856efcaf
0xdc6c62f189f1f770745f40a0d0ddffcece1aa7139d70c1afad7a95a28aa53b79
0x99a88c25c595af2356ca019729fbb0844ba27e6a344871567c0a65de46d59490
0x921694a19bc384f5db526736612079953eefb52aa1053b0411370d441b8cbba4
0xb6de083252f346ea4734e6665bbae3b5a72f811d3026566fe2757f2990b79e77
```

## Explicit public-testnet economics classification

The Project Sources permit explicit test-only values for testnet integration when a real production value is not required. Public/mainnet production economics remain separately gated.

For the public Arc Testnet rehearsal only, Bread preserves the controlled Day-9 rehearsal supply/fee shape and scales the quote-side fixture values by `10,000` so the lifecycle smoke fits a faucet-funded environment:

```text
supply = 1000000000000000000000000
phantomQuote = 1000000           # 1 USDC
graduationThreshold = 10000000   # 10 USDC
launchFeeUsdc = 0
tradeFeeBps = 100
protocolFeeShareBps = 2500
maxCreatorTaxBps = 500
v3Fee = 3000
smokeQuoteIn = 11000000          # 11 USDC
smokeFundingFloor = 12000000     # 12 USDC
```

Provenance:
`DAY9_CONTROLLED_REHEARSAL_QUOTE_VALUES_DIVIDED_BY_10000`

These are **non-production testnet values**. They do not freeze or approve public/mainnet Bread economics.

## Remaining public-testnet lifecycle gate

`scripts/day9/smoke-bread-arc-testnet.mjs` remains a separate transaction boundary. It:

- requires the verified deployment and at least 12 testnet USDC on the smoke operator;
- records a smoke intent before broadcast and refuses blind duplicate launches;
- executes the existing launch/buy/graduation/permanent-lock/creator-claim/replay smoke;
- records the exact token, curve, permanent LP position and transaction hashes.

Secret material remains only in the operator's local permission-restricted file and must not be pasted into chat or committed.

## Machine-readable disposition

```text
LIVE_ARC_TESTNET_REHEARSAL = BREAD_DEPLOYMENT_VERIFY_PASS_SMOKE_PENDING
LIVE_ARC_TESTNET_REHEARSAL_AUTHORIZED_FOR_BREAD_BROADCAST = true
ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED = CLEARED_FOR_ARC_TESTNET
DAY9_SAFE_2_OF_3_AUTHORITY = PASS
ARC_TESTNET_DEPLOYMENT_MANIFEST_NOT_READY = CLEARED
BREAD_ARC_TESTNET_DEPLOYMENT_PREFLIGHT = PASS
BREAD_ARC_TESTNET_DEPLOYMENT = PASS
BREAD_ARC_TESTNET_DEPLOYMENT_VERIFY = PASS
LIVE_ARC_SMOKE_BROADCAST = NOT_PERFORMED
CANONICAL_ARC_TESTNET_DEPLOYMENT_CLAIM = true
PRODUCTION_MONEY_CLAIM = false
```

The next allowed external execution is the **separately gated Bread Arc Testnet lifecycle smoke**. A smoke PASS still does not authorize Arc mainnet or production economics.

Day 9 remains incomplete after deployment PASS until the public lifecycle smoke, Safe-compatible threshold recovery drill, required physical/current-device evidence, and exact-head CI/release gates also pass.
