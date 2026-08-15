# Day 9 — Public Arc Testnet Bread Lifecycle Smoke

Status: **PASS — LIVE LAUNCH / TRADE / GRADUATE / PERMANENT LOCK / CREATOR CLAIM / REPLAY REJECTION**

Date: 2026-08-11

This evidence is bounded to Arc Testnet and the explicit non-production Day-9 rehearsal economics. It does not authorize Arc mainnet, freeze production economics, select a mainnet DEX, or authorize unrestricted public money.

## Deployment under test

The canonical Bread Arc Testnet deployment was created and verified from source commit:

`db0f6ed28e4a2475f54e84efadd7cf9693701353`

Canonical deployed addresses:

```text
BreadLaunchFactory              = 0xddf400f7a376fb8a962eee6d74c1ba37efa644f7
BreadFeeEscrow                  = 0xea9bb3330e0a2c9898776c75f549d06d2a644c94
BreadPermanentLiquidityLocker   = 0xecf66a3a221d90a413d9015803417aa8d4ba97fe
GraduationCoordinator           = 0x239da83ec8294b2433848ea8c85155f41e76f60a
BreadV3GraduationAdapter        = 0xfe2378a81d655e051b53aba57271d2b4d5b5dd84
Protocol Admin Safe             = 0x9004e285521d69197cd9965c301b02161eb1d0d8
V3 Position Manager             = 0x444Cc395346428216fB6f2892eb03cB804aE4CD5
V3 Factory                      = 0x0fB6EEDA6e90E90797083861A75D15752a27f59c
Canonical Arc Testnet USDC      = 0x3600000000000000000000000000000000000000
```

Testnet-only economics used by the deployment:

```text
phantomQuote = 1000000           # 1 USDC
graduationThreshold = 10000000   # 10 USDC
launchFeeUsdc = 0
tradeFeeBps = 100
protocolFeeShareBps = 2500
maxCreatorTaxBps = 500
v3Fee = 3000
smokeQuoteIn = 11000000          # 11 USDC
```

## Interrupted Forge attempt — no Bread protocol failure claim

The first public smoke attempt used the inherited Foundry script path. Stock Foundry v1.5.0 failed during its local EVM script execution when Arc USDC reached Arc's Native Coin Control precompile at `0x1800000000000000000000000000000000000001`. The local EVM produced `StackUnderflow` before the intended Bread launch transaction could execute on Arc.

This was classified as a Foundry/Arc local-execution incompatibility, not a Bread/Synthra on-chain failure. The smoke receipt remained `PREPARED` and the recovery path was required to inspect real Arc state before any subsequent write.

A first direct-RPC recovery invocation then failed at Node module loading because the temporary operator clone did not yet have the repository's pinned `viem` dependency installed. That failure occurred before RPC client/account construction and therefore before any direct-RPC transaction submission.

The operator installed the exact frozen workspace dependency set using pnpm `11.15.1`, with the lockfile unchanged and lifecycle scripts disabled, and confirmed `VIEM_RESOLUTION_PASS`.

## Recovery execution

Operator execution checkout before the successful recovery:

`8bb27d0b6be657b3f3d935a4378e9b93fc1be290`

The existing smoke intent remained pinned to deployment/smoke intent source commit:

`db0f6ed28e4a2475f54e84efadd7cf9693701353`

The recovery runner executed with mode:

`DIRECT_ARC_RPC_WITH_REAL_NODE_SIMULATION_PER_TRANSACTION`

Each write was simulated by the real Arc RPC before signing/submission, receipt-confirmed before advancing, and reconciled against the existing `PREPARED` smoke receipt so a prior launch could not be duplicated.

The operator received:

```text
BREAD_ARC_TESTNET_SMOKE_RECOVERY_AND_FINAL_VERIFY_PASS
BREAD_ARC_TESTNET_SMOKE_PASS
BREAD_ARC_TESTNET_SMOKE_FINAL_EVIDENCE_PASS
```

`recoveredFromPreparedIntent = true`.

## Exact live lifecycle evidence

Launch:

```text
token = 0x9dc6c650929b641f93269a3b6d7d5237297d938b
curve = 0x68db37eea822d42af898b9777a96bef022a0e36d
launchTransactionHash = 0xb5542a77d767a784f6ce4dc77d3e00a50170256a1320179947d25b2c468883a5
```

All smoke write transaction hashes recorded by the recovery receipt:

```text
0x4eb708960c79262238166219a150d7c167cffc1420e79cc233b9099e32c0f561
0xb5542a77d767a784f6ce4dc77d3e00a50170256a1320179947d25b2c468883a5
0x821730481bf7d87a2b9932ac8e8a3dcba069f98d308f8a6cb27c5ff147348d79
0x55a93e4e54205a6c22850f067ffe473cf7702891ce1ba1ba318334c5b4ae6071
```

Permanent LP custody:

```text
positionManager = 0x444cc395346428216fb6f2892eb03cb804ae4cd5
positionId = 265870
nftOwner = 0xecf66a3a221d90a413d9015803417aa8d4ba97fe
```

The independent final verifier confirmed the Position Manager NFT owner is the Bread permanent liquidity locker.

Financial/recovery evidence:

```text
operatorUsdcAtResume = 19696729
operatorUsdcAfter = 9473184
creatorClaimLogCount = 1
creatorClaimRemaining = 0
graduationResidueZero = true
replayRejected = true
```

The independent verifier used no private keys.

## Invariant disposition

The live Arc Testnet lifecycle establishes the following bounded Day-5/Day-9 facts for this deployment:

- launch + initial buy executed against canonical Arc Testnet USDC;
- the launch crossed the configured testnet graduation condition;
- the canonical snapshotted V3 adapter/dependencies were used;
- a real Position Manager LP NFT exists for the graduated launch;
- the LP NFT is held by `BreadPermanentLiquidityLocker`;
- graduation accounting residue is zero after pool creation;
- creator fee credit was actually claimed (`FeeClaimed` evidence count `1`) and remaining creator credit is zero;
- replay of pool creation is rejected;
- the interrupted initial smoke did not result in a duplicate launch or duplicate liquidity position;
- private keys were not printed;
- `productionMoneyClaim = false`.

Machine-readable bounded verdict:

```text
BREAD_ARC_TESTNET_PUBLIC_LIFECYCLE_SMOKE = PASS
BREAD_ARC_TESTNET_LAUNCH_TOKEN = 0x9dc6c650929b641f93269a3b6d7d5237297d938b
BREAD_ARC_TESTNET_LAUNCH_CURVE = 0x68db37eea822d42af898b9777a96bef022a0e36d
BREAD_ARC_TESTNET_LP_POSITION_ID = 265870
BREAD_ARC_TESTNET_LP_PERMANENT_LOCK = PASS
BREAD_ARC_TESTNET_CREATOR_CLAIM = PASS
BREAD_ARC_TESTNET_GRADUATION_RECONCILIATION = PASS
BREAD_ARC_TESTNET_GRADUATION_REPLAY_REJECTION = PASS
PRODUCTION_MONEY_CLAIM = false
```

## Remaining Day-9 gates

This smoke PASS clears `BREAD_ARC_TESTNET_PUBLIC_LIFECYCLE_SMOKE_REQUIRED` only.

Day 9 remains incomplete until at least:

1. the real 2-of-3 Safe-compatible threshold signer recovery/rotation drill executes and is independently verified;
2. remaining required physical/current-device evidence is reconciled truthfully;
3. exact-head release CI/integration verification is green or otherwise source-validly resolved;
4. the final Day-9 exact-head RC gate is rerun.

No RC tag is created and Day 10 does not start from this evidence alone.
