# Day 9 Live Arc Testnet Rehearsal Gate

Status: **DEX/FORK/SAFE AUTHORITY PASS — BREAD DEPLOYMENT PREFLIGHT READY — NO BREAD BROADCAST YET**

This evidence records the current Day-9 live-Arc decision boundary. It is not a production-money authorization and it does not authorize Arc mainnet.

## Verified prerequisite state

- Arc Testnet network identity is reconciled to chain ID `5042002`, canonical 6-decimal USDC, and the current `rpc.testnet.arc.network` / `wss://rpc.testnet.arc.network` endpoints.
- The Arc Testnet network manifest now selects the generic `UNISWAP_V3` dependency family using the independently verified Synthra-compatible Factory `0x0fB6EEDA6e90E90797083861A75D15752a27f59c` and Position Manager `0x444Cc395346428216fB6f2892eb03cB804aE4CD5`.
- Current Synthra SDK identity discovery, independent Arc RPC dependency checks, and the real-dependency Bread fork proof all PASS. The fork proof executed at Arc block `56439192` with V3 fee `3000`, exercising real pool creation/liquidity mint/permanent-lock ownership without a live Arc broadcast.
- Safe v1.4.1 core contracts are present on Arc Testnet at `SafeL2 = 0x29fcB43b46531BcA003ddC8FCB67FFE91900C762` and `SafeProxyFactory = 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67`.
- A chain-specific 2-of-3 Safe has been created and independently read back at `0x9004e285521d69197cd9965c301b02161eb1d0d8`, version `1.4.1`, threshold `2`, with three distinct test-only owners. The separate Guardian is `0xdcb9cb7038ff1a282265a855754dba8695a3121c` and the separate ephemeral deployment authority is `0x1bc5a40329b309be3ac77cb3688061b985f8d3fb`.
- The Safe creation transaction was a public Arc Testnet transaction; no private keys were printed or committed. Safe service/API support for Arc is not claimed.
- `config/deployments/arc-testnet.day5.json` is still not a deployed Bread manifest. No Bread core contract or Bread smoke launch has been broadcast yet.

## Explicit public-testnet economics classification

The Project Sources permit explicit test-only values for testnet integration when a real production value is not required. Public/mainnet production economics remain separately gated.

For the public Arc Testnet rehearsal only, Bread preserves the controlled Day-9 rehearsal supply/fee shape and scales the quote-side fixture values by `10,000` so the lifecycle smoke fits a faucet-funded environment:

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

These are **non-production testnet values**. They do not freeze or approve public/mainnet Bread economics.

## Prepared safety gates

- `scripts/day9/preflight-bread-arc-testnet-deployment.mjs`
  - read-only/on-chain checks plus non-broadcast Forge simulation;
  - verifies Safe, Guardian/deployer separation, canonical USDC, V3 dependencies, fee tier, fork evidence, deployer key identity and native testnet gas;
  - derives the stack/economics/DEX evidence hashes into the permission-restricted local operator file;
  - never broadcasts a Bread transaction.
- `scripts/day9/deploy-bread-arc-testnet.mjs`
  - writes an exact source-commit `PREPARED` receipt before any broadcast;
  - refuses ambiguous/unattributed prior deployments;
  - broadcasts the existing production deployment script only after the preflight passes;
  - records exact CREATE addresses, builds the canonical deployment manifest, runs configure/verify, and marks the manifest `VERIFIED` only after readback succeeds.
- `scripts/day9/smoke-bread-arc-testnet.mjs`
  - is separate from deployment;
  - requires a verified deployment and at least 12 testnet USDC on the smoke operator;
  - records a smoke intent before broadcast and refuses blind duplicate launches;
  - executes the existing launch/buy/graduation/lock/creator-claim/replay smoke;
  - records the exact token, curve, permanent LP position and transaction hashes.

Secret material remains only in the operator's local permission-restricted file and must not be pasted into chat or committed.

## Machine-readable disposition

```text
LIVE_ARC_TESTNET_REHEARSAL = BREAD_DEPLOYMENT_PREFLIGHT_READY
LIVE_ARC_TESTNET_REHEARSAL_AUTHORIZED_FOR_BREAD_BROADCAST = false
ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED = CLEARED_FOR_ARC_TESTNET
DAY9_SAFE_2_OF_3_AUTHORITY = PASS
ARC_TESTNET_DEPLOYMENT_MANIFEST_NOT_READY = OPEN
BREAD_ARC_TESTNET_DEPLOYMENT_PREFLIGHT = PENDING_EXTERNAL_EXECUTION
LIVE_ARC_BREAD_DEPLOY_BROADCAST = NOT_PERFORMED
LIVE_ARC_SMOKE_BROADCAST = NOT_PERFORMED
CANONICAL_ARC_TESTNET_DEPLOYMENT_CLAIM = false
PRODUCTION_MONEY_CLAIM = false
```

The next allowed external execution is the **non-broadcast Bread Arc Testnet deployment preflight**. A successful preflight is evidence only; the subsequent Bread broadcast remains a separate explicit scripted step.

Day 9 still remains incomplete after a future deployment/smoke PASS until the Safe-compatible threshold recovery drill, required physical/current-device evidence, and exact-head CI/release gates also pass.
