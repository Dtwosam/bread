# Day 9 Live Arc Testnet Rehearsal Gate

Status: **DEX DEPENDENCY/FORK PASS — PUBLIC BREAD DEPLOYMENT STILL BLOCKED BY DEPLOYMENT/AUTHORITY PREREQUISITES**

This evidence records the Day-9 live-Arc decision boundary. It is not itself deployment evidence and does not authorize a transaction broadcast.

## Verified prerequisite state

- Arc Testnet network identity is reconciled to chain ID `5042002`, canonical 6-decimal USDC, and the current `rpc.testnet.arc.network` / `wss://rpc.testnet.arc.network` endpoints.
- Synthra's current Arc SDK deployment identity is resolved and independently verified on Arc RPC.
- The canonical Arc Testnet network manifest now records the generic `UNISWAP_V3` family with the verified Synthra-compatible Factory and Nonfungible Position Manager.
- The real-dependency Bread/Synthra fork integration passed at Arc fork block `56439192` on operator-executed branch head `fe7bf6fcd33d2f23530dda54f18d29823cb9ce72`.
- The passing fork exercised the real Factory/Position Manager, canonical Arc USDC contract path, `BreadV3GraduationAdapter`, pool creation, liquidity mint, direct permanent-lock ownership, accounting/dust reconciliation and allowance cleanup.
- No live Arc transaction was broadcast and no private key was required for the fork proof.
- `config/deployments/arc-testnet.day5.json` still has no deployed Bread core/adapter addresses and no canonical testnet authority/economics hashes. That is now the primary live-deployment blocker.
- The Safe-compatible threshold recovery drill remains a separate environment blocker. No single EOA is being promoted as production-complete admin authority.
- No deployer/smoke private key value is recorded in repository evidence, committed to manifests, pasted into chat or authorized by this document.

## Machine-readable disposition

```text
LIVE_ARC_TESTNET_DEX_DEPENDENCY = PASS
LIVE_ARC_TESTNET_REAL_DEPENDENCY_FORK = PASS
LIVE_ARC_TESTNET_PUBLIC_BREAD_DEPLOYMENT = BLOCKED_DEPLOYMENT_MANIFEST_AND_AUTHORITY_INPUTS
LIVE_ARC_TESTNET_SMOKE = NOT_AUTHORIZED_BEFORE_DEPLOYMENT_VERIFY
ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED = CLEARED_FOR_DEPENDENCY_AND_FORK_COMPATIBILITY
ARC_TESTNET_DEPLOYMENT_MANIFEST_NOT_READY = OPEN
DAY9_RECOVERY_DRILL_BLOCKED_MULTISIG_ENVIRONMENT = OPEN
LIVE_ARC_DEPLOY_BROADCAST = NOT_PERFORMED
LIVE_ARC_SMOKE_BROADCAST = NOT_PERFORMED
CANONICAL_ARC_DEPLOYMENT_CLAIM = false
PRODUCTION_MONEY_CLAIM = false
```

## Gate-boundary correction

The original Day-9 readiness implementation coupled DEX evidence to a completed Bread deployment manifest. Once independent DEX evidence became real, that created a circular gate: a completed deployment was required before the system could recognize the evidence needed to authorize deployment.

The candidate branch now separates those concerns:

1. network/source inventory + independent RPC/fork proof establish the selected DEX dependency evidence;
2. the future Bread deployment manifest must separately prove that the deployed adapter and dependencies match that verified network evidence;
3. public-testnet deployment and post-deploy smoke remain distinct authorization stages.

No DEX, economics, authority or mainnet value is inferred by this correction.

## Remaining public-testnet prerequisites

Before a clean public Arc Testnet Bread deployment can be treated as canonical Day-9 evidence, the execution environment must provide real testnet-only inputs without committing secrets:

- a deployment key held only in the operator environment;
- a contract-based Protocol Admin appropriate for the rehearsal, with the separate Day-9 Safe-compatible threshold drill still mandatory before Day-9 closeout;
- a Guardian address consistent with the ratified authority model;
- an explicit testnet fee-recipient address;
- an explicit testnet-only economics configuration/hash derived from already-rehearsed values or another ratified testnet configuration, never silently promoted to production economics;
- a DEX evidence hash tied to the verified Arc Testnet dependency evidence;
- the verified Arc Testnet V3 Factory / Position Manager and test-only fee `3000`;
- sufficient testnet-only gas/USDC for the deployment and smoke lifecycle.

After deployment, `config/deployments/arc-testnet.day5.json` must be populated from actual broadcast/readback evidence, then `configure-graduation.mjs`, `verify-graduation-deployment.mjs` and the smoke lifecycle must pass before any canonical deployment claim.

## Safety/truthfulness boundary

- No private key or mnemonic may be printed, committed, pasted into chat, or written into a canonical manifest.
- No Arc mainnet values are selected by this lane.
- No production economics claim is created by the testnet rehearsal.
- No Day-9 PASS, RC tag or Day-10 start is authorized while deployment, multisig-recovery, physical-device or exact-head CI gates remain open.
