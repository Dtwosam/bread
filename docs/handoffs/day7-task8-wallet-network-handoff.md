# Day 7 Task 8 — Wallet / Network Integration and Recovery Convergence — Durable Handoff

Date: 2026-08-10

## Verdict

`DAY7_TASK8_WALLET_NETWORK_RECOVERY_CONVERGENCE_INTEGRATED_PASS_DURABLE`

This docs-only candidate records the Task-8 verdict. It becomes authoritative only after its exact head passes the required root/retained gates, is guarded-merged, and resulting `main` plus `docs/current-build-state.yaml` are freshly read back.

## Accepted implementation baseline

- Pre-Task-8 durable baseline: `7f560c3f218baf6c82af1ea91e60c1e0e380be66`
- Implementation PR: `#78`
- Final audited implementation head: `b7ac7a9c13a6d54bd4c2945a843783aa2157e0e3`
- Guarded squash merge on `main`: `e55d9a5ce57619938a9ffaccfc0bf27e6b78be57`
- Implementation title: `feat(day7): converge wallet and network runtime (#78)`

Fresh repository history after merge showed `e55d9a5ce57619938a9ffaccfc0bf27e6b78be57` as current `main` before this handoff branch was created.

## Source contract preserved

Task 8 converged the already-existing Task-5 through Task-7 wallet/transaction runtime against the frozen 04A–04D wallet/network UX rather than creating a second wallet subsystem.

- Browse/read surfaces remain available while disconnected or connected to the wrong network.
- Transaction actions resolve to `Connect wallet` or `Switch to Arc` rather than hiding browse content.
- One Wagmi/wallet/transaction/recovery owner remains.
- Chain/address identity comes only from canonical checked-in config manifests.
- Connector detection is not support certification; no wallet brand is advertised first-class merely because a connector appears.
- Wallet-specific option UI is lazy-loaded.
- No wallet/project credential, production value or mainnet value is invented.
- User-signed writes remain direct wallet/provider writes; no Bread transaction relay or financial mutation API is introduced.

## What Task 8 integrated

### Shared wallet composition

- Added product-level `WalletProvider`, `WalletButton`, `WalletMenu` and `NetworkSwitcher` components.
- `WalletProvider` wraps the accepted `WalletTradeProvider`; it does not create a parallel transaction/recovery runtime.
- Root desktop and mobile shells expose the shared wallet control.
- Wrong-network shell state renders `Switch to Arc` through the existing runtime switch action.

### Connector selection

- Removed silent `connectors[0]` selection.
- Shared runtime now exposes the connected account and a deduplicated list of runtime-discovered connector options.
- `connectWallet(connectorId?)` accepts an explicit connector ID; without one it resolves only the generic configured `injected` connector.
- Wagmi EIP-6963 multi-injected discovery is explicit in the canonical config.
- Network/deployment values continue to come from `config/networks/arc-testnet.json` and `config/deployments/arc-testnet.day5.json`.
- No WalletConnect dependency/project ID was silently added and no unsupported wallet brand is labeled supported/first-class.

### Responsive/accessibility behavior

- Desktop wallet options render as an anchored popover.
- Mobile wallet options render as a fixed safe-area-aware sheet above bottom navigation.
- Close control is a 44px target.
- Wallet options menu is dynamically imported.
- Connected wallets show a shortened-address trigger while retaining access to the connector menu.

### Continuity / recovery ownership

- Existing Task-5 approval, allowance, direct-write, persisted transaction and recovery code remains the owner.
- Existing Task-6 Create and Task-7 Claim transaction flows continue to consume the same runtime.
- No transaction state, recovery store, ABI/address/config authority or financial ledger was duplicated.

## TDD evidence

### Initial wallet/network RED

- Head: `fe3a25602d1eeefd9734a0cb44ff58c3c81dc640`
- Workflow: `31395489263`
- Setup/install/lockfile policy: PASS
- 23 retained wallet/Trade/Create/Claim assertions: PASS
- 4 intended Task-8 missing-owner assertions: FAIL

### Responsive wallet-surface RED

- Head: `07a40e89938aeea86613cae2e014391c510b3271`
- Workflow: `31397047562`
- 27 prior assertions: PASS
- 1 intended desktop-popover/mobile-sheet assertion: FAIL

### Connected-wallet menu reachability RED

- Head: `a9f0e8b5a6d87ce5d3997d6ebde1340bc8f74dfc`
- Workflow: `31397605487`
- 28 prior assertions: PASS
- 1 intended connected-menu reachability assertion: FAIL
- Root and all triggered retained system workflows remained PASS.

## Exact-head implementation evidence

Final implementation head: `b7ac7a9c13a6d54bd4c2945a843783aa2157e0e3`

### Task-8 dedicated workflow

- Workflow `31397869536`: PASS
- Wallet/network + retained Wallet/Trade/Create/Claim suite: **29 / 29 PASS**
- Retained Day-7 Tasks 2–4 read-route suite: **31 / 31 PASS**

### Root CI

- Root CI `31397868421`: PASS
- repository/bootstrap + Day-6 closeout validation: PASS
- full Day-6 suite: PASS
- strict shared-contract TypeScript: PASS
- source-integrity/formatting: PASS
- root typecheck: PASS
- production build: PASS
- clean-tree-after-build: PASS
- Foundry compile/generated-ABI/tests: PASS
- PostgreSQL/Redis infrastructure + integration: PASS

### Retained exact-head workflows

- Day-7 Task 1 `31397868056`: PASS
- Day-7 Task 2 `31397867975`: PASS
- Day-7 Task 5 `31397867928`: PASS
- Day-7 Task 6 `31397867965`: PASS
- Day-7 Task 7 `31397867935`: PASS
- Retained Day-6 Task 5 `31397868098`: PASS
- Retained Day-6 Task 6 `31397868315`: PASS
- Retained Day-6 Task 7 `31397868047`: PASS
- Retained Day-6 Task 8 `31397867994`: PASS
- Retained Day-6 Task 9 `31397868011`: PASS
- Retained Day-6 Task 10 `31397868087`: PASS
- Day-7 Tasks 3–4 route regressions were executed directly within Task-8 workflow `31397869536`.

## Source / design / security audit verdict

PASS for Task-8 scope.

Verified before merge:

- one wallet/runtime/recovery owner;
- no second transaction lifecycle or recovery store;
- no `/v1` financial mutation, server signing, relay, queue or custody authority;
- no financial-formula or protocol-semantic change;
- no ABI/address/config authority duplication;
- `connectors[0]` absent;
- connector selection explicit and deduplicated;
- browse routes independent of wallet connection state;
- wrong-network actions expose `Switch to Arc`;
- network identity remains manifest-sourced;
- no embedded wallet/project credential;
- no hard-coded supported/first-class wallet brands;
- wallet options UI lazy-loaded;
- desktop/mobile wallet surface follows frozen responsive/accessibility direction;
- connected-state menu regression permanently covered;
- Task-5 approval/recovery semantics unchanged;
- all existing release/mainnet blockers unchanged.

## External / release blockers — unchanged

- `CURRENT_PONS_FACTORY_SOURCE_PARITY`
- `PONS_V2_RUNTIME_REFERENCE`
- `BREAD_PRODUCTION_ECONOMICS_CONFIG`
- `PONS_AUDIT_FINDINGS`
- `ARC_MAINNET_VALUES`

Task 8 does not claim exact-current Pons parity, production economics finality, completed Pons audits, Arc mainnet publication, canonical Arc DEX deployment or first-class branded-wallet support without the required evidence.

## Next safe lane after durable merge

**Day 7 Task 9 — Responsive, accessibility, performance and frontend-security convergence.**

Task 9 must consume the integrated Tasks 1–8 web product and close the frozen 04B–04D production gates without feature invention. It must start with source-conformance RED tests from the eventual Task-8 durable merge, then repair only demonstrated responsive/accessibility/performance/frontend-security gaps. Day-7 Task 10 remains the later Playwright primary-journey and integrated Day-7 closeout lane.

## Do not do

- Do not start Task 9 until this handoff is exact-head green, guarded-merged and actual `main` is freshly verified.
- Do not add a second wallet provider/runtime/state/recovery system.
- Do not silently add WalletConnect credentials/dependencies or claim branded wallet support without required evidence.
- Do not invent production economics, Arc mainnet values or canonical Arc DEX addresses.
- Do not route user transactions through Bread servers.
- Do not reopen accepted Day-6 or Day-7 Tasks 1–8 absent a demonstrated regression, genuine source conflict or newly ratified source change.

## Durability condition

This handoff is complete only when:

1. `docs/current-build-state.yaml` advances additively from v1.44 to v1.45;
2. exact handoff head passes root + Day-7 Tasks 1–8 + retained Day-6 Tasks 5–10;
3. handoff PR is guarded-merged with expected-head protection;
4. resulting `main`, v1.45 and this handoff are freshly read back;
5. only then may Task 9 begin.
