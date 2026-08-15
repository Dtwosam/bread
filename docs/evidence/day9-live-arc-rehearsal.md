# Day 9 Live Arc Testnet Rehearsal Gate

Status: **DEX / FORK / SAFE / DEPLOYMENT / PUBLIC LIFECYCLE SMOKE PASS — REMAINING RELEASE GATES OPEN**

This evidence records the current Day-9 live-Arc decision boundary. It is not a production-money authorization, does not authorize Arc mainnet, does not freeze production economics, and does not select a mainnet DEX.

## Verified prerequisite state

- Arc Testnet chain ID: `5042002`.
- Canonical Arc Testnet USDC: `0x3600000000000000000000000000000000000000`, 6 ERC-20 decimals.
- Generic Bread DEX family for this testnet deployment: `UNISWAP_V3`.
- Verified Arc Testnet V3 Factory: `0x0fB6EEDA6e90E90797083861A75D15752a27f59c`.
- Verified Arc Testnet Position Manager: `0x444Cc395346428216fB6f2892eb03cB804aE4CD5`.
- Synthra remains provider provenance/evidence only; Bread core remains behind `IGraduationAdapter` and no mainnet DEX selection is made.
- Real-dependency fork proof: PASS at Arc block `56439192`, fee `3000` / tick spacing `60`.
- Safe v1.4.1 core present on Arc Testnet.
- Chain-specific Bread Protocol Admin Safe: `0x9004e285521d69197cd9965c301b02161eb1d0d8`, threshold `2`, owner count `3`.
- Guardian: `0xdcb9cb7038ff1a282265a855754dba8695a3121c`.
- Ephemeral deployment/smoke authority: `0x1bc5a40329b309be3ac77cb3688061b985f8d3fb`, not a Safe owner.
- No private keys are committed or printed. No official Safe service/API support claim is made for Arc.

## Bread Arc Testnet deployment verification PASS

Deployment/preflight source commit:

`db0f6ed28e4a2475f54e84efadd7cf9693701353`

The non-broadcast preflight returned `BREAD_ARC_TESTNET_DEPLOYMENT_PREFLIGHT_PASS` and verified Safe threshold/owners, canonical USDC, V3 dependencies, fee tier, deployment authority gas, stack/economics/DEX evidence hashes and a real deployment simulation with `transactionBroadcast = false`.

The subsequent controlled public Arc Testnet deployment returned:

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

Verified adapter/config state:

```text
family              = UNISWAP_V3
positionManager     = 0x444Cc395346428216fB6f2892eb03cB804aE4CD5
v3Factory           = 0x0fB6EEDA6e90E90797083861A75D15752a27f59c
v3Fee               = 3000
adapterConfigHash   = 0x4069e56d708b6bc2d4b003e09e6a566299b799bc8646732a901024fcf77781c7
economicsConfigHash = 0x081b597d7b603cb67d3921f269f7940a84221524b2d9baefc4f319c9f15f9747
dexEvidenceHash     = 0xd30f72e114168ae2786f24e1375804d4ba1dd99822bbb292855597c60384ea26
```

The canonical `config/deployments/arc-testnet.day5.json` manifest is `VERIFIED` with these exact values. The deployment runner recorded 18 Arc Testnet deployment/initialization/ownership-handoff transactions and reported `productionMoneyClaim = false`, `productionAuthorityClaim = false`, and `privateKeysPrinted = false`.

## Explicit public-testnet economics classification

These values are **testnet-only rehearsal values** and must not be promoted to production/mainnet economics:

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

Provenance: `DAY9_CONTROLLED_REHEARSAL_QUOTE_VALUES_DIVIDED_BY_10000`.

## Public Arc Testnet lifecycle smoke PASS

Dedicated evidence: `docs/evidence/day9-public-arc-lifecycle-smoke.md`.

The first inherited Forge smoke attempt did **not** establish a Bread/Synthra failure. Stock Foundry v1.5.0 failed in its local EVM when Arc USDC reached Arc's Native Coin Control precompile `0x1800000000000000000000000000000000000001`. The smoke receipt remained `PREPARED` and recovery was required to inspect real Arc state before further writes.

A first direct-RPC recovery invocation then stopped during Node module loading because the temporary clone lacked the already-pinned `viem` workspace dependency. No direct-RPC transaction could occur in that invocation.

After installing the exact frozen dependency set (`pnpm 11.15.1`, frozen lockfile, lifecycle scripts disabled), the operator executed the recovery runner from checkout head `8bb27d0b6be657b3f3d935a4378e9b93fc1be290`. The existing smoke intent remained source-pinned to `db0f6ed28e4a2475f54e84efadd7cf9693701353`.

Execution mode:

`DIRECT_ARC_RPC_WITH_REAL_NODE_SIMULATION_PER_TRANSACTION`

Result:

```text
BREAD_ARC_TESTNET_SMOKE_RECOVERY_AND_FINAL_VERIFY_PASS
BREAD_ARC_TESTNET_SMOKE_PASS
BREAD_ARC_TESTNET_SMOKE_FINAL_EVIDENCE_PASS
```

Exact live launch evidence:

```text
token = 0x9dc6c650929b641f93269a3b6d7d5237297d938b
curve = 0x68db37eea822d42af898b9777a96bef022a0e36d
launchTransactionHash = 0xb5542a77d767a784f6ce4dc77d3e00a50170256a1320179947d25b2c468883a5
```

Smoke write transaction hashes:

```text
0x4eb708960c79262238166219a150d7c167cffc1420e79cc233b9099e32c0f561
0xb5542a77d767a784f6ce4dc77d3e00a50170256a1320179947d25b2c468883a5
0x821730481bf7d87a2b9932ac8e8a3dcba069f98d308f8a6cb27c5ff147348d79
0x55a93e4e54205a6c22850f067ffe473cf7702891ce1ba1ba318334c5b4ae6071
```

Permanent LP evidence:

```text
positionManager = 0x444cc395346428216fb6f2892eb03cb804ae4cd5
positionId = 265870
nftOwner = 0xecf66a3a221d90a413d9015803417aa8d4ba97fe
```

Independent final verification also proved:

```text
creatorClaimLogCount = 1
creatorClaimRemaining = 0
graduationResidueZero = true
replayRejected = true
```

Operator USDC evidence:

```text
operatorUsdcAtResume = 19696729
operatorUsdcAfter = 9473184
```

The independent verifier used no private keys. The recovery reported `recoveredFromPreparedIntent = true`, so the original interrupted smoke did not result in a duplicate launch or duplicate liquidity position.

## Machine-readable disposition

```text
LIVE_ARC_TESTNET_REHEARSAL = PUBLIC_LIFECYCLE_SMOKE_PASS_REMAINING_RELEASE_GATES_OPEN
ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED = CLEARED_FOR_ARC_TESTNET
DAY9_SAFE_2_OF_3_AUTHORITY = PASS
ARC_TESTNET_DEPLOYMENT_MANIFEST_NOT_READY = CLEARED
BREAD_ARC_TESTNET_DEPLOYMENT_PREFLIGHT = PASS
BREAD_ARC_TESTNET_DEPLOYMENT = PASS
BREAD_ARC_TESTNET_DEPLOYMENT_VERIFY = PASS
BREAD_ARC_TESTNET_PUBLIC_LIFECYCLE_SMOKE = PASS
BREAD_ARC_TESTNET_LAUNCH_TOKEN = 0x9dc6c650929b641f93269a3b6d7d5237297d938b
BREAD_ARC_TESTNET_LP_POSITION_ID = 265870
BREAD_ARC_TESTNET_LP_PERMANENT_LOCK = PASS
BREAD_ARC_TESTNET_CREATOR_CLAIM = PASS
BREAD_ARC_TESTNET_GRADUATION_RECONCILIATION = PASS
BREAD_ARC_TESTNET_GRADUATION_REPLAY_REJECTION = PASS
CANONICAL_ARC_TESTNET_DEPLOYMENT_CLAIM = true
PRODUCTION_MONEY_CLAIM = false
```

## Remaining Day-9 gates

The public lifecycle smoke gate is cleared. Day 9 is still incomplete because these non-waived gates remain:

1. real Safe-compatible 2-of-3 threshold signer recovery/rotation execution;
2. remaining physical/current-device matrix reconciliation;
3. exact-head release CI/integration verification;
4. final Day-9 RC verdict rerun after the affected gates pass.

No Day-9 PASS, RC tag, Day-10 start, production economics decision or Arc-mainnet DEX selection is claimed.
