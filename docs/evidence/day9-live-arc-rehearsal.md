# Day 9 Live Arc Testnet Rehearsal Gate

Status: **BLOCKED — REAL EXTERNAL PREREQUISITES UNRESOLVED**

This evidence records the Day-9 live-Arc decision boundary. It is not deployment evidence and it does not authorize a transaction broadcast.

## Verified prerequisite state

- Arc Testnet network identity is reconciled to the current official read surface: chain ID `5042002`, canonical 6-decimal USDC, and the current `rpc.testnet.arc.network` / `wss://rpc.testnet.arc.network` endpoints.
- The canonical Arc Testnet network manifest still has an unresolved DEX boundary. No canonical Uniswap V3/V4 deployment has been activated or inferred.
- `config/deployments/arc-testnet.day5.json` remains `BLOCKED_UNTIL_VERIFIED_DEX_AND_PRODUCTION_CONFIG`; core deployment addresses, adapter configuration/evidence hashes, economics hash, Protocol Admin, and Guardian are not populated with verified canonical values.
- The controlled Day-9 local rehearsal proves Bread deployment/configure/verify/smoke mechanics only. It is explicitly non-canonical and non-production.
- The Safe-compatible threshold recovery drill remains an environment blocker. No single EOA is being promoted as production-complete admin authority.
- No deployer/smoke private key value is recorded in this repository evidence, committed to manifests, or authorized for use by this gate.

## Machine-readable disposition

```text
LIVE_ARC_TESTNET_REHEARSAL = BLOCKED_REAL_EXTERNAL_PREREQUISITES
LIVE_ARC_TESTNET_REHEARSAL_AUTHORIZED = false
ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED = OPEN
ARC_TESTNET_DEPLOYMENT_MANIFEST_NOT_READY = OPEN
LIVE_ARC_DEPLOY_BROADCAST = NOT_PERFORMED
LIVE_ARC_SMOKE_BROADCAST = NOT_PERFORMED
CANONICAL_ARC_DEPLOYMENT_CLAIM = false
PRODUCTION_MONEY_CLAIM = false
```

The executable gate is `scripts/day9/check-live-arc-rehearsal.mts`. It is read-only and must return `authorized: false` while the current canonical manifests remain unresolved. The Day-9 Lane-7 workflow also proves that the existing Day-5 configure command refuses canonical Arc Testnet configuration with `ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED`.

If the external prerequisites become real later, this evidence must be replaced from a fresh exact candidate head after independently verified DEX/deployment evidence and multisig-compatible authority inputs are present. Secure operator/GitHub secrets may then be injected by the execution environment, but secret values must never be printed, committed, pasted into chat, or stored in manifests.
