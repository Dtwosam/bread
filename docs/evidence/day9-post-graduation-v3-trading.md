# Day 9 — post-graduation V3 trading evidence

Status: **IMPLEMENTATION COMPLETE / EXACT-HEAD EXECUTION VERIFICATION PENDING**

This file is deliberately not a PASS closeout. It records the current implementation and verification boundary for Bread-native trading after a launch reaches canonical `POOL_CREATED` graduation state.

## Scope

The implementation preserves the existing bonding-curve path for active launches and adds a DEX-neutral `UNISWAP_V3` route for canonically graduated launches:

- `NOT_GRADUATED` + `readyToGraduate() == false` → existing Bread curve;
- `NOT_GRADUATED` + ready, or `SWEPT` → fail closed while graduation is pending;
- `RESCUED` → fail closed;
- `POOL_CREATED` → verify the launch-snapshotted V3 adapter/config and exact TOKEN/USDC pool before quoting or preparing a swap.

No Solidity, token economics, deployment, admin authority, or graduation accounting is changed by this lane.

## Verified Arc Testnet periphery identity

The Arc Testnet network manifest carries the already-verified generic V3 periphery tuple:

- V3 factory: `0x0fB6EEDA6e90E90797083861A75D15752a27f59c`
- position manager: `0x444Cc395346428216fB6f2892eb03cB804aE4CD5`
- SwapRouter02: `0xA545bCB1Bd7985c59ea162aB1748A0803434C31b`
- QuoterV2: `0x3Ce954107b1A675826B33bF23060Dd655e3758fE`
- router ABI kind: `V3_SWAP_ROUTER_02`
- quoter ABI kind: `V3_QUOTER_V2`

Earlier live read-only proof verified both periphery contracts bind to the same V3 factory and that QuoterV2 returns positive exact-input quotes in both TOKEN/USDC directions.

## Implemented chain-authoritative route checks

`packages/protocol-sdk/src/trade-route.ts` resolves from fresh canonical state and, for `POOL_CREATED`, verifies:

1. launch token and snapshotted coordinator/adapter identity;
2. snapshotted adapter family is `UNISWAP_V3`;
3. live adapter family/coordinator/config hash match the launch snapshot;
4. adapter USDC matches canonical network USDC;
5. adapter V3 factory and position manager match the configured graduated-trading dependencies;
6. coordinator-recorded position manager matches the configured position manager;
7. SwapRouter and Quoter each report the same V3 factory;
8. coordinator `poolId` decodes to the exact pool returned by `factory.getPool(TOKEN, USDC, fee)`;
9. pool token pair and fee are exact;
10. pool live liquidity is nonzero.

Only after these checks does the resolver return `V3_POOL`.

## Implemented V3 review and signer-free builder

`packages/protocol-sdk/src/v3-trading.ts` now provides:

- fresh exact-input Quoter/QuoterV2 review;
- current `slot0` spot-price input for raw-unit price-impact calculation;
- deterministic slippage floor;
- explicit V3 venue fee;
- zero Bread curve base fee / creator tax / opening tax on the V3 review;
- exact BUY direction `USDC -> token`;
- exact SELL direction `token -> USDC`;
- exact router allowance for the input token and amount;
- zero native value;
- Router02 `exactInputSingle` shape without a deadline;
- classic V3 SwapRouter shape only with a caller-supplied positive deadline;
- no signer, private key, wallet client, or account retention in the builder.

Known packaging gate: the implementation is present in `v3-trading.ts`, and the web controller imports that module directly, but the connected GitHub safety layer blocked adding `prepareV3ExactInputTrade` to the protocol SDK root `index.ts`. The pre-existing Day-9 execution test that expects the root export must therefore remain unresolved until that export can be added through an allowed path. No lower-level Git object bypass was used.

## Implemented canonical controller lifecycle

`apps/web/lib/transactions/controller.ts` now accepts an optional full `ProtocolContext`.

With the full context present it:

1. validates chain ID, quote asset and quote decimals against the existing execution context;
2. resolves canonical curve vs V3 route from chain state;
3. prepares the exact allowance target for that fresh route;
4. waits for allowance handling through the existing wallet adapter;
5. re-resolves the canonical route and re-reads the quote;
6. simulates the exact prepared transaction immediately before the trade-signature boundary;
7. compares the fresh review against the user-approved review;
8. returns `reviewChanged` without opening the trade wallet when values changed;
9. otherwise sends exactly one prepared transaction through the existing wallet adapter;
10. preserves the existing submitted/persisted/replaced/reload recovery semantics.

Callers without a full `ProtocolContext` retain the previous Day-7 curve-only preparation behavior.

## Wallet adapter audit

The shared browser wallet adapter is router-neutral. It consumes `transaction.allowance` exactly and sends the generic prepared `{ to, abi, functionName, args, value }` request. There is no curve-specific target or ABI assumption in the wallet layer.

## Web UI

The token trade experience now:

- obtains the review through the canonical SDK review orchestrator;
- renders `V3 venue fee` for graduated V3 reviews;
- does not render Bread curve fee / creator-tax / opening-tax rows on the V3 branch;
- passes the narrowed full protocol context into the existing trade lifecycle;
- uses the same reviewed Buy/Sell action button for curve and graduated routes;
- retains the final canonical reread/review-change guard before the wallet trade signature.

## Deterministic browser proof authored

`apps/web/e2e/specs/graduated-v3-trading.spec.ts` and the canonical RPC fixture model the checked-in Arc Testnet Bread deployment plus the verified V3 periphery. The spec requires:

- a graduated token to render a V3 review;
- BUY and SELL each to submit through configured SwapRouter02;
- Router02 calldata selector `0x04e45aaf`;
- zero native value;
- no transaction targeted to the graduated bonding curve;
- exactly two submissions before reload, one BUY and one SELL;
- zero wallet submissions in the recreated page after reload, proving confirmed trades are not rebroadcast;
- zero unhandled deterministic RPC calls.

The fixture ABI for `getLaunch` and `getGraduation` was reconciled against the generated Bread ABI. It models the exact `GraduationRecord` tuple:

`phase, sweptAt, sweptUsdc, sweptTokens, poolTokenAmount, poolId, positionManager, positionId`.

## Verification already observed earlier in this lane

Before the controller/execution expansion, the following local results were directly observed:

- canonical route resolver focused suite: PASS;
- four focused route/context/config files: `16/16` tests PASS;
- protocol SDK typecheck: PASS;
- canonical review orchestration: `17/17` focused tests PASS plus SDK typecheck PASS;
- V3 read-only web review plus existing Day-7 trade UI: `11/11` tests PASS.

These results predate the final controller, builder and browser-fixture commits and are not an exact-head substitute.

## Exact-head verification currently pending

The final affected matrix has not yet been claimed PASS.

Current runner limitations:

- GitHub Actions continues to terminate as `startup_failure` with zero jobs, so it is unavailable rather than a test failure or PASS;
- Vercel preview builds are currently rejected by the account-wide build-rate limit, including projects untouched by this change, so those failures are not usable code verdicts;
- the assistant runtime cannot execute the user's local repository directly.

Required exact-head verification still includes the affected Vitest suites, workspace/web+SDK typecheck/build, and the deterministic Chromium graduated-V3 browser spec. These will be treated as one bounded verification checkpoint rather than repeatedly asking the operator to run individual commands.

## Live-chain boundary

No new live Arc Testnet write is authorized by this document.

The existing graduated BTST proof asset remains read-only until exact-head deterministic verification is green. In particular, this lane has not submitted a post-graduation BTST BUY or SELL, created a new BTST token, retried graduation, swept funds, created another pool, deployed contracts, changed protocol authority, merged PR #93, or advanced Day 9/RC/Day 10.

## Current bounded verdict

`POST_GRADUATION_V3_TRADING_IMPLEMENTATION_COMPLETE_EXACT_HEAD_VERIFICATION_AND_LIVE_PROOF_PENDING`
