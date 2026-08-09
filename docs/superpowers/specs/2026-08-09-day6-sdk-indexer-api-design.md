# Bread Day 6 — Protocol SDK, Transactional Indexer, Read API & Reconciliation Design

Date: 2026-08-09  
Status: **WRITTEN DESIGN — SELF-REVIEWED — AWAITING REQUIRED USER SPEC REVIEW**  
Repository: `Dtwosam/bread`  
Verified design baseline: `8ff119dd31db32bc8f1d24048f31a07f7acf4c62`  
Day-5 durable handoff baseline: `4cc1ea7041abaa86402114321bf31e53aff8ea90`  
Frozen architecture: `DAY6_INDEXER_ARCHITECTURE = TRANSACTIONAL_EVENT_JOURNAL_WITH_SYNCHRONOUS_PROJECTIONS`

This design is the mandatory Day-6 predecessor to `superpowers:writing-plans` and to any Day-6 production TypeScript/database/API work. It extends the accepted Day-1 through Day-5 Bread system. It does not reopen accepted contract economics, curve math, FeeEscrow accounting, Factory/Launch+Buy behavior, opening protection, emergency authority, graduation semantics, adapter semantics, or permanent-lock behavior.

---

## 1. Reconciled authority and baseline

### Project Sources

This design was derived from the uploaded Bread Project Sources, especially:

- `00-bread-master-source-of-truth-v1.5`
- `02-arc-usdc-compatibility-mainnet-portability`
- `04A-product-information-architecture-user-journeys`
- `04C-page-by-page-responsive-specification`
- `04D-ux-performance-accessibility-production-gates-v1.1`
- `05A-security-threat-model-trust-boundaries-v1.1`
- `05B-permissions-admin-control-key-management-v1.4`
- `05C-financial-invariants-security-verification-plan-v1.5`
- `05D-incident-response-monitoring-recovery`
- `06A-implementation-architecture-repository-structure-v1.4`
- `06B-interfaces-data-model-indexer-runtime-contracts-v1.1`
- `06C-exact-10-day-build-order-daily-gates-v1.5`
- `06D-chatgpt-agent-execution-protocol-quality-gates-v1.5`
- `06E-continuous-system-integration-build-continuity-doctrine-v1.4`
- `06F-nested-lane-checkpoint-continuity-integration-gates-v1.4`
- `06H-cross-chat-continuity-build-state-handoff-protocol-v1.4`
- `06I-high-traffic-bot-burst-launch-stampede-scalability`
- `bread-10-day-implementation-plan-v1.5`

The uploaded `CURRENT-BUILD-STATE-v1.6` is an older workflow-position snapshot that still records the Day-5 preflight boundary. It does not contradict a protocol rule. The newer accepted repository `docs/current-build-state.yaml`, the Day-6 rollover handoff/evidence, and the user's current continuation instruction consistently record Day 5 as durably closed and Day 6 as design/preflight with no Day-6 production code started.

### GitHub

Current `main` was verified to equal exactly:

`8ff119dd31db32bc8f1d24048f31a07f7acf4c62`

Every intervening commit from the Day-5 durable handoff merge `4cc1ea7041abaa86402114321bf31e53aff8ea90` was inspected:

1. `8cd4573d7a67d93c054d9dc68d35e95b2f8aaa4d` — docs-only rollover handoff, the already-recorded bounded direct-to-main deviation.
2. `b60336d7c5e751440f1cf843667f53b7fb7a7dc7` — docs-only current-state/YAML rollover update.
3. `cdf8fadfc1940ac5d148c14badfccfc3b10bca1f` — docs-only rollover evidence.
4. `8ff119dd31db32bc8f1d24048f31a07f7acf4c62` — accepted merge.

No Day-6 production code, database schema, runtime configuration, dependency, contract, or financial semantic was introduced. PR #34 merged the rollover state and CI `31286942830` passed all four repository jobs.

### Accepted Day-5 boundary

The following remain closed and authoritative:

- `DAY_5_GRADUATION_ADAPTER_LOCK_INTEGRATED_PASS`
- `FULL_LAUNCH_TRADE_GRADUATE_LOCK_PASS`
- `INV_050_056_PASS`
- `RETRY_CANNOT_DUPLICATE_LIQUIDITY`
- `RETRY_CANNOT_DOUBLE_SPEND_SWEPT_ASSETS`

Day 6 may project those states; it may not redefine them.

---

## 2. Non-negotiable authority model

1. **Arc and the accepted Bread contracts remain financial authority.**
2. **The event journal is a reconstruction/audit primitive, not a financial ledger.**
3. **PostgreSQL is a deterministic rebuildable read projection.**
4. **Redis is disposable cache/rate/fanout coordination state.** Losing it may hurt freshness or performance but cannot change protocol meaning.
5. **The public API is read-only for protocol financial actions.** It never signs, queues, relays, custodizes, or submits user launches/trades/claims.
6. **The SDK prepares direct wallet-to-contract transactions.** It has no key custody.
7. **All protocol monetary values stay exact.** Internally they are integers/`bigint`; JSON transports base-unit/token quantities as decimal strings, never JavaScript floating-point numbers.
8. **No Day-6 implementation may guess Arc mainnet values, canonical Arc DEX addresses, Bread production economics/admin addresses, or exact-current Pons parity.**

---

## 3. Frozen architecture decision

### Approved

For each contiguous committed Arc block range:

1. discover/fetch relevant logs;
2. decode them through the canonical version-aware ABI registry;
3. perform only deterministic chain enrichment needed for immutable launch identity/snapshot data;
4. begin one PostgreSQL transaction;
5. lock the stack checkpoint row;
6. insert previously unseen canonical event-journal rows;
7. synchronously apply all affected projections in deterministic chain order;
8. advance the checkpoint only after the entire contiguous range is valid;
9. commit once;
10. only after commit, invalidate cache generations and publish shared realtime invalidations.

Journal insertion, synchronous projection application, and checkpoint advancement are one durable boundary.

### Rejected

- **Direct-to-projection indexing without a durable journal:** weaker replay/rebuild/debug evidence.
- **Asynchronous journal → projection workers for Day 6:** adds a second ordering/checkpoint/retry problem and user-visible projection lag. Asynchronous **post-commit cache/fanout effects** are allowed because they do not own canonical projection state.

---

## 4. Canonical package ownership

### `@bread/config`

Owns strict network/protocol/runtime manifest validation, `deploymentStartBlock`, address/config resolution, historical-manifest immutability, and rejection of unknown production keys. No consumer keeps a private chain/address map.

### `@bread/types`

Owns canonical identities, normalized event/domain types, API request/response types, cursor types, freshness metadata, and reconciliation-report types.

### `@bread/protocol-sdk`

Owns generated Bread ABIs, version-aware ABI registry, validated manifest → `ProtocolContext` resolution, typed transaction preparation/simulation, custom-error decoding, and canonical event decoding helpers. No React dependency and no signing surface.

### `@bread/db`

Owns Drizzle/PostgreSQL schema, migrations, indexer write repositories, API read repositories, and deterministic cursor primitives. Indexer/API may not embed competing SQL/domain interpretations.

### `@bread/indexer`

Owns Arc log discovery, dynamic launch-address discovery, deterministic transaction assembly, journal/projection application, checkpoint/replay/rebuild, reconciliation orchestration, and post-commit cache/fanout production.

### `@bread/api`

Owns Fastify read routes, request validation, pagination, response envelopes, cache read-through/single-flight, rate limiting/backpressure, and health/freshness exposure. Production API DB credentials are read-only; migration/indexer credentials are separate.

### `@bread/observability`

Owns shared structured logs/metrics/error correlation. Day-6 services extend this boundary rather than inventing private telemetry formats.

---

## 5. Canonical ABI/address pipeline

Bread ABIs are generated from exact Foundry build artifacts and checked into/consumed by the SDK only through a deterministic generation/check step. CI fails if generated ABI output drifts from the current contract artifacts.

Manual frontend/indexer ABI fragments are prohibited.

The generated registry includes inherited events/errors required by Day 6, including ERC-20 `Transfer` and relevant `OwnershipTransferred` events.

`@bread/protocol-sdk` resolves all addresses from a validated `@bread/config` network/protocol manifest. Consumers receive a `ProtocolContext` instead of importing testnet constants.

```ts
type ProtocolContext = {
  chainId: number;
  stackVersion: string;
  addresses: ProtocolAddresses;
  quoteAsset: Address;
  graduationAdapter: Address;
};
```

ABI/event decoding is stack-version aware. Unsupported stack/interface versions fail explicitly; the newest ABI is never assumed to decode historical or unknown stacks.

---

## 6. Canonical identities

06B remains exact:

- network: `chainId`;
- protocol stack: `chainId + stackVersion + factoryAddress`;
- launch: `chainId + tokenAddress`;
- curve: `curveAddress`, one-to-one with launch;
- canonical chain log / trade: `chainId + transactionHash + logIndex`;
- creator/wallet: wallet address;
- graduated pool: `chainId + adapter-defined pool identifier/address`.

Addresses are parsed/canonicalized with viem before persistence/query boundaries. Names/tickers are metadata, never keys.

Stable external event ID:

`<chainId>:<lowercaseTransactionHash>:<decimalLogIndex>`

The database keeps structured identity columns; the string is for cursors/fanout/debugging.

---

## 7. Actual accepted event surface

Day 6 consumes the existing Day-1 through Day-5 contract events rather than inventing parallel semantics.

### Factory

- `LaunchDeployerSet`
- `GraduationCoordinatorSet`
- `LaunchConfigUpdated`
- `LaunchFeeCredited`
- `LaunchCreated`
- `LaunchAndBuyExecuted`

### Bonding curve

- `CreatorFeeRecipientUpdated`
- `CurveBuy`
- `CurveBuyRefunded`
- `OpeningProtectionApplied`
- `CurveSell`
- `FeesSwept`
- `GraduationReady`
- `GraduationAutoAttemptFailed`
- `CurveGraduationReleased`

### FeeEscrow

- `AuthorizedCreditorUpdated`
- `FeeCredited`
- `FeeClaimed`

### FeePolicy

- `FeePolicyUpdated`
- `FeeSweepOperatorUpdated`

### EmergencyController

- `GuardianUpdated`
- `RestrictionModeUpdated`
- `GraduationPauseUpdated`

### GraduationCoordinator

- `GraduationSwept`
- `GraduationCompleted`
- `GraduationRescued`
- `GraduationTokenResidueLocked`
- `GraduationUsdcDustCredited`

### Permanent locker

- `CoordinatorSet`
- `PositionLocked`
- `TokenSupplyLocked`

### Launch token / inherited

- ERC-20 `Transfer` is the holder-balance source.
- `OwnershipTransferred` is indexed for relevant Ownable Bread contracts.
- ERC-20 `Approval` is a **known ignored** event for Day-6 projections; it is not treated as unknown ABI drift and creates no projection row.

### Buyback source gap

06B lists Buyback as a minimum event family when that capability exists, but the accepted Day-1 through Day-5 contract surfaces inspected for this baseline do not expose an accepted canonical Buyback event/authority that Day 6 can safely interpret. Day 6 therefore **does not invent a Buyback event, table authority, or synthetic vesting state**. A future supported stack that adds Buyback requires a versioned canonical ABI/event interpretation and its own source/conformance gate before the indexer claims to support it. Current API/UI fields that depend on unavailable Buyback data must be explicit `unavailable`/omitted according to the typed API contract rather than fabricated.

### Event disposition rule

Every log from a known Bread contract is classified by the versioned registry as one of:

1. `INDEXED_CANONICAL` — journaled and, where applicable, projected;
2. `KNOWN_IGNORED` — understood but intentionally irrelevant to Day-6 state, e.g. ERC-20 `Approval`; no projection effect and no ABI-drift alarm;
3. `UNKNOWN` — not present in the registered stack ABI/event policy; the affected range must not commit and the stack enters a decoder/version-degraded state.

This prevents ordinary irrelevant logs from halting ingestion while still refusing silent interface drift.

Adapter/DEX implementation logs do not replace Bread graduation authority. `GraduationCompleted` plus the accepted locker state is Bread's public graduation outcome; external DEX logs may only support reconciliation/evidence.

---

## 8. Durable event journal

Additional table: `event_journal`.

It stores canonical indexed onchain event evidence, not a second financial ledger.

Minimum fields:

- `chain_id`
- `transaction_hash`
- `log_index`
- `block_number`
- `block_hash`
- `block_timestamp`
- `transaction_index`
- `contract_address`
- `contract_role`
- `stack_version`
- `topic0`
- exact raw `topics`
- exact raw `data`
- decoded event name
- decoded payload with all integer values serialized losslessly as decimal strings
- nullable launch token/curve context when deterministically known
- decoder/schema version

Primary key:

`(chain_id, transaction_hash, log_index)`

Important indexes include canonical block/log order, contract/block, token/block, and event-family indexes needed by reconciliation.

Processing order is always:

`blockNumber ASC, transactionIndex ASC, logIndex ASC`.

A journal PK conflict means that canonical event already committed. Its projection effect is not applied again.

`KNOWN_IGNORED` logs such as ERC-20 `Approval` need not be stored in the canonical Day-6 journal. `UNKNOWN` known-contract logs halt that range before checkpoint advancement.

---

## 9. Dynamic launch-log discovery

A launch token emits its constructor mint `Transfer(0x0 → curve)` before Factory `LaunchCreated` in the same transaction, and Launch+Buy may emit curve/token events later in that transaction. A precomputed address filter alone therefore misses canonical launch events.

For every bounded contiguous block range:

1. fetch Factory `LaunchCreated` logs using the manifest Factory;
2. combine already-known launch token/curve addresses with addresses discovered from those Factory logs;
3. fetch complete relevant Bread logs for core addresses plus the expanded dynamic token/curve address set using bounded address/range chunks;
4. merge/deduplicate by canonical event identity and sort by chain order;
5. fetch required block headers and deterministic immutable launch reads;
6. only then begin the DB transaction.

This captures constructor mint + same-transaction Launch+Buy activity without scanning every ERC-20 `Transfer` on Arc.

RPC address/range concurrency is bounded. Growth in launch count cannot create one subscription/request stream per browser.

---

## 10. Event normalization

Raw journal rows preserve canonical events. Normalized projections may correlate multiple logs from the same ordered transaction only where the accepted contracts intentionally split one user action across events.

### Launch

`LaunchCreated` is the primary launch identity event.

The **immutable initial supply** is derived from the launch token's constructor mint `Transfer(address(0), curve, amount)` in the same launch transaction. This avoids using a later `totalSupply()` read after burns as if it were launch supply.

Other immutable launch snapshot/enrichment fields are reconstructed from accepted immutable/snapshotted contract state and the launch transaction:

- Factory `getLaunch(token)` launch record;
- Factory `stackVersion()`;
- curve immutable/snapshotted economics getters such as quote asset, phantom quote, graduation threshold, fee-policy snapshot fields, creator tax, launch timestamp, and reserved-token state;
- token name/symbol and immutable launch metadata/context.

The constructor mint is cross-checked against the token/curve relationship and stored initial supply. A missing or contradictory constructor mint is a normalization/reconciliation failure.

Day-6 deterministic rebuild must not depend on historical archive-state reads for mutable values. Immutable/snapshotted getters may be read at the current reconciliation head because accepted contract semantics guarantee they do not rewrite existing launch snapshots.

Launch snapshot rows are write-once. Future Factory/FeePolicy changes do not mutate them.

### Buy

Canonical trade identity is the `CurveBuy` event identity.

For the current accepted curve, a buy emits:

- optional `CurveBuyRefunded`;
- `OpeningProtectionApplied`;
- `CurveBuy`.

The transaction assembler tracks unconsumed curve-local context and consumes the matching prior refund/opening-protection events when `CurveBuy` is reached for the same emitting curve/buyer/recipient.

Normalized BUY fields include:

- buyer/actor;
- recipient;
- offered quote = `spent + refund`;
- actual `spent`;
- tokens out;
- base fee;
- creator tax;
- opening-tax bps/amount;
- Launch+Buy exemption boolean;
- refund;
- net curve input = `spent - baseFee - creatorTax - openingTax`;
- deterministic post-state derived from the accepted curve transition.

For the current curve, `OpeningProtectionApplied` is mandatory for every buy. Missing or contradictory correlation blocks checkpoint advancement.

If `LaunchAndBuyExecuted` exists later in the same transaction, it cross-checks the already normalized curve trade; it is never a second trade.

### Sell

Canonical trade identity is `CurveSell`.

Normalized SELL fields include seller, recipient, tokens in, net quote out, base fee, creator tax, gross curve quote out (`quoteOut + fee + creatorTax`), zero opening tax, and deterministic post-state.

### Price/volume projection

To avoid fee asymmetry in curve execution price:

- BUY curve execution price uses `netCurveInput / tokensOut`;
- SELL curve execution price uses `grossCurveQuoteOut / tokensIn`.

User-visible traded quote volume uses:

- BUY: actual `spent`;
- SELL: gross curve quote out.

All price/candle calculations use exact integer/arbitrary-precision decimal math, never binary floating point.

### Fee credits and claims

`FeeEscrow.FeeCredited` is the only canonical event that creates indexed claim entitlement. `FeesSwept`, `LaunchFeeCredited`, and graduation dust events are attribution/audit context and cannot create a second entitlement row.

`fee_credits` stores the FeeEscrow event identity, creditor, recipient, amount, recipient balance after, and total outstanding after, plus deterministic source/token attribution where available.

`fee_claims` comes only from `FeeEscrow.FeeClaimed` and stores recipient, amount, remaining balance, and total outstanding.

Claims reduce an aggregate recipient escrow balance; they are not artificially assigned back to individual tokens.

Attribution rules:

- curve creditor → exact curve/token;
- Factory creditor → same-transaction `LaunchFeeCredited` correlation;
- GraduationCoordinator creditor → ordered same-transaction graduation/curve-release context;
- if future code makes attribution ambiguous, the entitlement remains valid from FeeEscrow but per-token attribution is `unavailable` rather than guessed.

### Graduation

Projection transitions follow actual accepted events/state:

- `GraduationReady` → ready/processing signal;
- `GraduationAutoAttemptFailed` → operational failure signal, not financial rollback;
- `CurveGraduationReleased` → curve-release audit transition;
- `GraduationSwept` → coordinator `SWEPT` phase and exact swept values;
- `GraduationCompleted` → `POOL_CREATED` plus adapter/pool/position/used/locked/dust data;
- `GraduationRescued` → `RESCUED`;
- locker events → permanent-lock evidence.

`GraduationCompleted` means the accepted onchain graduation/lock path completed. It is never labeled as an investment-safety guarantee.

### Holders

Launch-token ERC-20 `Transfer` events update the rebuildable holder snapshot:

- zero → recipient: mint;
- sender → recipient: transfer;
- sender → zero: burn;
- zero address is never a holder.

Known protocol addresses are tagged from manifest + launch-specific curve/coordinator/locker/adapter context. Top-10 user concentration excludes known protocol addresses as required by 04C.

### Admin/security

`admin_events` records actual privileged/config/recovery events, including ownership transfer, guardian/restriction/graduation-pause changes, FeePolicy/sweep-operator changes, FeeEscrow creditor changes, Factory deployer/coordinator/config changes, locker coordinator binding, and graduation rescue.

A mutable config change event is recorded with the exact fields emitted by the canonical contract. Day-6 rebuild **does not require archive RPC calls to recover an un-emitted historical mutable config snapshot**. Exact per-launch economics remain available from immutable launch snapshots. If a future admin event needs a fuller historical config record, the contract/event/interface must supply reconstructable evidence or that extra field remains unavailable; the indexer cannot invent it from current state.

---

## 11. Arc finality and integrity behavior

The Project Source points to Arc deterministic finality. Current official Arc documentation was rechecked on 2026-08-09 and states that committed blocks are immediately irreversible and do not require a normal confirmation/reorg window.

Day 6 therefore freezes:

1. process Arc blocks once they are committed/current according to the configured Arc RPC;
2. no invented confirmation-count threshold;
3. no normal probabilistic-reorg rollback subsystem;
4. overlap replay exists for restart/crash/idempotency and missed-request recovery, not confirmation handling;
5. checkpoint stores exact committed block number + hash;
6. if a previously checkpointed block hash ever differs from provider evidence, classify `FINALITY_OR_PROVIDER_INTEGRITY_VIOLATION` rather than silently rewriting history;
7. stop advancement, cross-check another configured provider, expose degraded status, and require explicit rebuild/reconciliation before resuming if the inconsistency is real.

This defensive path detects provider corruption, wrong-chain connections, or an unexpected network-level invariant violation without pretending Arc normally reorgs.

---

## 12. Transactional ingestion/checkpoint rule

For each stack, one active ingestor is preferred; correctness does not depend on only one process.

- use a stack-scoped PostgreSQL advisory lease where practical;
- every write batch additionally locks the stack's `indexer_checkpoints` row `FOR UPDATE`;
- journal uniqueness is the last duplicate-effect guard.

Before entering/committing the DB transaction:

- all required RPC reads for the range succeeded;
- all relevant known-contract logs were classified/decoded;
- all required same-transaction correlations are valid;
- block/hash/parent continuity agrees with the starting checkpoint;
- the block range is contiguous.

Inside one PostgreSQL transaction:

1. lock checkpoint;
2. insert new canonical journal rows in chain order;
3. apply projection effects **only for rows newly inserted by this transaction**;
4. update rollups/candles/metrics deterministically;
5. advance checkpoint to the exact final block/hash;
6. commit.

Crash before commit leaves journal/projections/checkpoint unchanged. Crash after commit may lose cache/fanout notifications but not canonical DB state.

---

## 13. Overlap replay

Restart/catch-up intentionally begins before the existing checkpoint by a bounded configured overlap window.

The overlap size is an operational runtime value validated by `@bread/config`; it is **not** an Arc confirmation depth.

Rules:

- never start before manifest `deploymentStartBlock`;
- journal conflicts do not reapply projection effects;
- checkpoint never regresses;
- new events beyond the old checkpoint apply normally;
- replaying a completed range produces equivalent journal/projection state;
- no duplicate trades, credits, claims, admin effects, holder effects, graduation outcomes, candles, rollups, or metrics.

`OVERLAP_REPLAY_IDEMPOTENT` requires exact identity/count/state-hash equivalence before and after replay of an already-complete range.

---

## 14. PostgreSQL schema

The source-defined families remain mandatory, plus `event_journal`.

### `protocol_stacks`

Identity: `(chain_id, stack_version, factory_address)`.

Stores deployment start block, network/protocol manifest hashes, source commit, canonical quote asset, stack addresses, adapter family/address/config hash, and **expected runtime code hashes for every active/registered Bread deployment required by reconciliation**.

Expected code hashes are not optional for an active indexed stack. Test/local stacks generate/freeze them from their deployment evidence; production stacks obtain them from the verified deployment/manifest process. Missing expected hashes means the stack cannot obtain `REC-05`/`RECONCILE_PASS`; values are never guessed to fill the gap.

### `launches`

Immutable launch identity/snapshot:

- chain/token/curve;
- stack identity;
- original deployer;
- creator fee recipient;
- creator tax bps;
- economics digest;
- config version;
- launch timestamp/block/event identity;
- quote asset;
- **initial supply from constructor mint**;
- phantom quote;
- graduation threshold;
- snapshotted fee-policy values;
- coordinator;
- adapter/family/config hash;
- reserved-token baseline.

Identity: `(chain_id, token_address)`.

### `launch_state`

Current rebuildable curve/graduation projection: tracked quote/tokens, quote-fee/creator-tax balances, derived real/virtual reserves, sellable tokens, readiness/graduated state, graduation phase/swept values, pool/position identity, permanent-lock evidence, and last applied event/checkpoint.

No field here authorizes a financial action.

### `trades`

Append-only normalized buys/sells keyed by canonical event identity with exact integer amounts, taxes, refunds, and derived execution-price representation.

### `fee_credits` / `fee_claims`

Append-only canonical FeeEscrow entitlement/claim events only.

### `creator_rollups`

Rebuildable aggregates for created launches and deterministic fee-credit/claim views. Original deployer and creator-fee recipient remain distinct identities.

### `holder_snapshots`

Current per-token/per-holder derived balances, last event/checkpoint, and protocol-address classification. It is not an authoritative wallet-balance service.

### `market_candles`

Derived OHLCV buckets from normalized curve trades. Initial stored intervals: `1m`, `5m`, `1h`; broader periods may query/aggregate these rather than creating another trade source. Rebuild from trades must reproduce equivalent buckets.

### `token_metrics`

Derived current activity/market fields including last curve price representation/source, market-cap display projection where valid, 5m/1h/24h quote volume, 1h/24h trade count, 1h/24h unique traders, holder counts, top-10 non-protocol concentration, graduation progress bps, last activity, and graduation state.

For active curves, spot display derives from accepted reserve state with exact arithmetic. After graduation, Day 6 **does not pretend the final curve price is a current DEX price**. Until a separately ratified live DEX-price source exists, the API marks the last curve value historical/last-curve or current price unavailable.

### `indexer_checkpoints`

One committed cursor per stack: deployment start block, last committed block number/hash/timestamp, last canonical event identity where present, decoder/projection schema version, updated time, and ingestion health.

### `admin_events`

Append-only normalized privileged/config/recovery events keyed by canonical event identity.

### `metadata`

Sanitized display metadata separate from financial state: name/symbol, logo/description, socials/links, sanitization version, and source context. Onchain strings are attacker-controlled display input; no HTML execution or arbitrary server-side remote fetch is permitted.

---

## 15. Deterministic feeds

04A requires an explicit Trending indexer algorithm and prohibits disguising paid placement as organic trending. No controlling source freezes a weighted ranking score, so Day 6 uses transparent deterministic ordering.

### New

1. launch block/time descending;
2. launch log index descending;
3. token address ascending tie-breaker.

### Trending

Eligible launches with activity in trailing indexed 1h, ordered by:

1. `volume_usdc_1h` descending;
2. `unique_traders_1h` descending;
3. `trade_count_1h` descending;
4. latest activity block/log descending;
5. token address ascending.

No paid-placement field changes organic ranking. Future sponsorship must be separately labeled and cannot silently alter this algorithm.

### Near Graduation

Non-graduated launches ordered by:

1. graduation progress bps descending;
2. `volume_usdc_1h` descending;
3. launch time descending;
4. token address ascending.

Progress is exact rebuildable real tracked quote / snapshotted graduation threshold, clamped to 0–10,000 bps. Actual readiness/phase still comes from the accepted contracts.

### Graduated

`POOL_CREATED` launches ordered by graduation-completion block/log descending, then token address. `RESCUED` is not represented as successfully graduated.

---

## 16. Protocol SDK transaction contract

All Bread V1 prepared financial transactions have `value = 0n` because the quote asset is ERC-20 USDC; native Arc balance is gas only.

Builders accept validated `ProtocolContext` + typed amounts/addresses and return the 06B `PreparedTransaction` shape plus typed simulation/preflight metadata.

### Buy

Prepare curve `buy(quoteIn, minTokensOut, recipient)`, exposing exact spender/allowance requirement and current-chain simulation context. The SDK may display predicted fees/taxes; it does not become pricing authority.

### Sell

Prepare curve `sell(tokensIn, minQuoteOut, recipient)` with launch-token allowance requirement and simulation.

### Launch

Prepare Factory `launchToken(params)` using the accepted `IBreadLaunchFactory.LaunchParams` and current `expectedEconomics` digest support.

### Launch + Buy

Prepare Factory `launchTokenAndBuy(params, quoteIn, minTokensOut, recipient)` using the existing Factory/curve path. The SDK must not reimplement money math as a competing execution path.

### Claim

Prepare FeeEscrow `claim()` or `claim(amount)`. Indexed claimable data is informational; current-chain FeeEscrow state/simulation is checked before signing.

### RetryGraduation

Read canonical coordinator phase:

- `NOT_GRADUATED` + ready curve → prepare `GraduationCoordinator.sweep(token)`;
- `SWEPT` → prepare `GraduationCoordinator.createPool(token)`;
- `POOL_CREATED` → typed terminal/already-complete result, no tx;
- `RESCUED` → typed terminal/rescued result, no tx.

It never changes the snapshotted adapter/destination.

### Approval helper

SDK may export a canonical generic ERC-20 approval preparation helper so the frontend does not hand-encode approvals. It still does not submit/sign.

### Error/event decoding

Simulation uses a viem `PublicClient` + account context only. Custom errors use the same generated version-aware ABI registry. Unknown selectors return typed `UNKNOWN_REVERT` with bounded technical detail rather than a fabricated human explanation.

---

## 17. API freshness envelope

Every successful indexed response uses one shared envelope:

```ts
type IndexedResponse<T> = {
  data: T;
  meta: FreshnessMeta;
  page?: CursorPageMeta;
};
```

`FreshnessMeta` includes at least:

- `chainId`;
- API/indexer schema version;
- indexed-through block number as decimal string;
- indexed-through block hash;
- indexed-through block timestamp;
- `servedAt`;
- `source: "bread-indexer"`;
- `status: "FRESH" | "LAGGING" | "REBUILDING" | "DEGRADED"`;
- optional observed Arc head + derived lag blocks;
- cache state where applicable;
- stack version for single-stack responses, while multi-stack feed items carry their own stack identity.

A cached response keeps the checkpoint that produced it; only `servedAt` changes. Cache cannot make old data look newly indexed.

`FRESH` is an operational freshness label, never a statement that the API is financial authority.

---

## 18. Required public read API

### `GET /v1/feed`

`view=new|trending|graduating|graduated`, bounded limit, opaque deterministic cursor. Returns token-card-ready indexed summaries + freshness.

### `GET /v1/search`

Searches exact contract, exact creator wallet, normalized ticker exact/prefix, and normalized name prefix. Address-like queries may run immediately; text queries use the 04C approximate two-character threshold. Exact contract match outranks duplicate-name/ticker results. No unbounded substring/offset scan.

Search has a separate stricter rate-limit/concurrency budget from cached feed reads.

### `GET /v1/tokens/:address`

Immutable launch snapshot + current indexed state + metrics + sanitized metadata + graduation/lock state + freshness.

### `GET /v1/tokens/:address/trades`

Reverse chronological deterministic cursor over `(blockNumber, transactionIndex, logIndex)` and canonical event ID.

### `GET /v1/tokens/:address/holders`

Derived holder balances with protocol-address tagging and concentration metadata. Clearly indexed/derived, not chain balance authority.

### `GET /v1/portfolio/:address`

Indexed launch-token holdings/activity. No PnL/average entry unless cost basis is complete/reliable. External transfers make naive cost basis unsafe, so Day 6 does not fabricate it. Graduated tokens without a ratified live DEX-price source expose price/value as unavailable or explicitly historical.

### `GET /v1/creators/:address`

Launches created, fee-recipient relationships, indexed credited/claimed/claimable aggregates, and per-launch earned revenue only where event attribution is deterministic. Indexed claimable does not supersede onchain `FeeEscrow.balanceOf`.

### `GET /v1/status`

No secrets. Returns supported chain/stack identities, checkpoint/head/lag, DB/Redis/RPC/indexer health classes, backlog/queue state, rebuild mode, last reconciliation verdict/report identity, cache/fanout degradation, and decoder/schema version. Never returns RPC credentials/URLs with secrets, DSNs, admin secrets, or private tokens.

---

## 19. Validation, cursors and API errors

### Addresses

All route/query addresses are parsed/canonicalized with viem before DB work. Invalid address shape/checksum → 400.

### Pagination

- cursor pagination for feeds/trades/holders/large creator lists;
- no unbounded offsets;
- versioned base64url structured sort-key cursor;
- bounded cursor length/decoded fields;
- malformed/unknown cursor version → 400;
- page defaults/maxima are shared canonical constants/types.

### Error shape

```ts
type ApiError = {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: Record<string, string | number | boolean>;
  };
};
```

Expected classes: 400 input, 404 unknown resource, 429 endpoint-class rate limit, 503 dependency/rebuild state where serving would misrepresent availability, 500 bounded internal error without secret/raw-stack leakage.

---

## 20. Cache design

Redis accelerates reads only.

Cache keys include schema version, chain/stack/token/feed identity, normalized query/cursor, and logical generation counters.

Committed projection changes produce affected cache domains. **Only after DB commit** are their Redis generations invalidated/incremented.

### Stampede control

For a hot cache miss:

- attempt one cross-instance Redis single-flight lock per normalized key;
- waiters use bounded jitter/wait then read the filled cache;
- DB concurrency has an independent cap so Redis failure cannot create an unbounded stampede;
- no recursive/unbounded retry loops.

### Safe stale behavior

Brief stale-but-marked responses are allowed only for non-transactional discovery/secondary analytics within a configured stale window. Portfolio/claimable/holder displays never treat stale cache as financial authority; transaction preparation always validates/simulates current chain state before signing.

### Redis failure

DB projections remain valid; cache becomes degraded; eligible hot reads use bounded process-level single-flight + DB concurrency controls. Search may return 503 if its protective limiter cannot be enforced safely. Redis failure never rolls back a committed checkpoint.

---

## 21. Realtime fanout semantics

Day 6 freezes the semantic contract; Day 7 may choose the browser transport that consumes it.

Rules:

- one shared indexer/chain source, never one Arc subscription per browser;
- fanout by logical channel;
- causal event ID is stable for dedupe;
- publish only after DB commit;
- realtime payload is an invalidation hint, not financial authority;
- client refetches after relevant message and after disconnect/reconnect;
- slow-consumer buffers are bounded; slow clients are disconnected/degraded rather than causing unbounded memory growth.

Initial logical channels:

- `stack:<chainId>:<stackVersion>:feed`
- `token:<chainId>:<tokenAddress>`
- `wallet:<chainId>:<walletAddress>` where useful for portfolio/creator invalidation

Messages are bounded: event ID, channel, change kind/domain, affected identity, committed checkpoint block/hash. They do not broadcast full large trade/token objects to every client.

A post-commit publication failure leaves DB state correct; TTL/reconnect/refetch heals presentation and `/v1/status` reports degraded fanout/cache health.

---

## 22. Reconciliation

Canonical operator command:

`reconcile --network arc-testnet --stack <version>`

The command independently reads chain evidence and emits machine-readable JSON plus human summary containing report version, chain/stack/Factory, source commit/manifest hashes, deployment start block, checked-through block/hash, timing, individual check status/evidence, explicit mismatches, and overall `PASS | FAIL`.

### REC-01 — Launch completeness

Independently scan Factory `LaunchCreated` from deployment start through the checked block. Compare event identities/count/tokens with `event_journal` + `launches`.

### REC-02 — Curve state

For every launch, compare onchain canonical curve getters with indexed tracked quote/tokens, quote-fee/creator-tax balances, reserves, reserved/sellable state, and graduated/readiness state.

Any mismatch is FAIL; DB never overrides chain.

### REC-03 — FeeEscrow solvency/projection

Onchain:

- read `totalOutstanding`;
- read canonical USDC `balanceOf(FeeEscrow)`;
- require custody >= outstanding; surplus/donations are allowed.

Projection:

- reconstruct outstanding from `fee_credits - fee_claims`;
- require projected aggregate outstanding == onchain `totalOutstanding` at checked block.

Custody does not have to equal outstanding because surplus may exist.

### REC-04 — Graduation/lock

Compare indexed coordinator phase/amount/pool/position fields with `getGraduation(token)`. For completed launches verify permanent-lock evidence through locker getters.

### REC-05 — Deployment identity/code hashes

For every required registered stack deployment:

- address has code;
- actual runtime code hash equals the expected code hash frozen in stack deployment evidence/manifest;
- chain id and canonical quote asset identity/decimals pass existing config validation.

A missing expected code hash is itself FAIL for an active/registered stack. No production/mainnet value is guessed to make this pass.

### REC-06 — Checkpoint continuity

- checkpoint block/hash equals chain;
- no journal row lies beyond checkpoint;
- an independent contiguous scan from deployment start through checkpoint yields the same relevant canonical event identity set as the journal;
- decoder/stack version matches registered stack.

Reconciliation failure produces explicit expected/actual evidence. It never silently patches projection state.

---

## 23. Delete-DB rebuild

Rebuild starts from an empty Day-6 projection database after migrations and replays from manifest `deploymentStartBlock` through a chosen committed Arc head.

Rules:

1. old projection dumps are never canonical input;
2. inputs are manifests + canonical chain logs/accepted immutable reads;
3. rebuild journal + all projections deterministically;
4. run full reconciliation at the rebuild target;
5. emit rebuild report with identity/count/checkpoint/report hash/verdict;
6. only a reconciled rebuild may replace an active projection.

Production recovery builds/reconciles a replacement/shadow database or otherwise removes partially rebuilt state from public serving. The destructive acceptance test uses isolated/local/test infrastructure and is guarded so it cannot target a production DSN by accident.

`DELETE_DB_REBUILD_PASS` requires the same canonical event-identity set and equivalent externally relevant projection outputs at the same target block before/after deletion.

---

## 24. Failure/recovery semantics

### RPC unavailable

No checkpoint advancement. Use bounded configured provider failover and bounded retry/backoff. No retry amplification.

### Previously checkpointed hash mismatch

Classify integrity/finality incident, stop, cross-check another provider, expose degraded state, then rebuild/reconcile before resuming if real.

### Unknown event/version drift

No partial block/range commit. Keep prior checkpoint, report decoder/version degradation, repair canonical ABI policy, replay.

### DB transaction failure

Atomic rollback of journal + projections + checkpoint; retry from prior checkpoint/overlap.

### Indexer stopped

API may serve last durable projection with truthful `LAGGING`/`DEGRADED` metadata. Chain finance is unaffected. On restart: overlap replay → catch-up.

### Redis/cache/fanout unavailable

No DB rollback. Eligible reads use bounded DB fallback; report degradation; clients heal through refetch.

### DB unavailable

Only very short stale non-financial cache may be served if clearly marked and within stale limits; otherwise 503. No hidden raw-RPC API fallback becomes a second implementation.

### Reconciliation mismatch

Release/acceptance gate fails. Public indexed reads may remain available only with truthful degraded state where safe. Recovery is root-cause repair + rebuild/reconcile, never “choose the DB value.”

---

## 25. Day-6 scale/backpressure

Day 8 remains the full >=10,000 concurrent-client stress proof. Day 6 must already exercise the architecture meaningfully.

### API

- horizontally replicable stateless handlers;
- bounded PostgreSQL pool;
- bounded Redis/RPC concurrency;
- indexed/cursor queries only;
- separate search limiter/concurrency budget;
- cache-first feed/token reads;
- no unbounded request queue.

### Indexer

- bounded block range/address chunks/provider concurrency;
- stack writer lease + DB correctness guards;
- no unbounded event queue;
- canonical projection application outranks secondary enrichment;
- lag/backlog metrics exposed.

### Realtime

- one post-commit invalidation per causal canonical change into shared logical channels;
- no per-browser chain subscription;
- bounded slow-consumer buffer;
- client refetch coalescing.

### First meaningful Day-6 concurrency test

Exercise together:

1. concurrent hot feed/token reads exceeding configured DB pool size;
2. cold-cache stampede for one hot key;
3. overlap replay containing already-journaled events;
4. a newly committed event causing projection + post-commit cache/fanout effects;
5. multiple logical fanout consumers including a deliberately slow one;
6. bounded search traffic under its separate limiter.

Pass means: one durable event effect, zero replay duplicates, bounded queues/pools, collapsed cache misses, no per-client Arc RPC fanout, slow-consumer containment, truthful freshness, and only intentional rate/backpressure errors. Day 8 later applies the full 06I 10,000-client/p95/error-rate stress gate.

---

## 26. Security/trust boundaries

1. Metadata is hostile display input and cannot alter financial projections.
2. API input is hostile; addresses/cursors/search bounds are validated before DB work.
3. RPC evidence is checked against configured chain/stack/address/checkpoint identity.
4. PostgreSQL corruption is recoverable from chain + manifests + deterministic code.
5. Redis compromise/loss cannot create claim entitlement or transaction authority.
6. No API route holds user keys or transaction-relay capability.
7. SDK transaction preparation does not trust indexed fee/economics data where current-chain simulation/validation is required.
8. Admin events are observable but API/indexer cannot perform the admin action.
9. FeeEscrow entitlement comes only from FeeEscrow canonical events/state; upstream fee events never override disagreement.
10. Donations cannot become tracked reserve/claim entitlement through indexer assumptions.

---

## 27. Required Day-6 proof contract

### Shared types/SDK

- generated ABI drift check PASS;
- manifest/address resolution PASS;
- Buy/Sell/Launch/Launch+Buy/Claim/RetryGraduation encoding PASS;
- simulation/custom-error decode PASS;
- no signing/key-custody/server-submit surface.

### DB/indexer

- migration/schema PASS;
- journal identity/order PASS;
- dynamic launch discovery captures constructor mint + same-tx Launch+Buy activity;
- buy/refund/opening-tax normalization PASS;
- initial supply from constructor mint PASS;
- fee entitlement derived only from FeeEscrow PASS;
- graduation normalization PASS;
- holder Transfer rebuild PASS;
- admin events reconstruct without required archive-RPC mutable-state dependency;
- checkpoint atomicity failure-injection PASS;
- `OVERLAP_REPLAY_IDEMPOTENT` PASS;
- `DELETE_DB_REBUILD_PASS` PASS.

### API/cache/fanout

- all eight required route schemas PASS;
- address/cursor/page bounds PASS;
- separate search rate limit PASS;
- `API_FRESHNESS_METADATA_PRESENT` on every indexed endpoint;
- cache single-flight + post-commit invalidation PASS;
- realtime dedupe/disconnect/refetch semantics PASS;
- `FIRST_MEANINGFUL_CONCURRENT_READ_REPLAY_CACHE_FANOUT_TESTS_PASS`.

### Reconciliation

- REC-01 through REC-06 PASS on accepted integration fixture/environment;
- mismatch fixtures produce explicit FAIL reports;
- `RECONCILE_PASS` only when no required expected code hash/evidence is missing.

### Regression

Every lane runs focused + adjacent regressions. Final Day-6 head runs full exact-head repository CI. A prior Day-1–Day-5 regression failure blocks Day-6 PASS.

---

## 28. Required vertical wiring order

`actual Solidity interfaces/events`
→ `generated ABI registry`
→ `@bread/types + @bread/protocol-sdk`
→ `@bread/db`
→ `@bread/indexer`
→ `@bread/api`
→ `Day-7 web consumers`

No lane may create a private substitute interface while waiting for another layer. Day 6 leaves executable API/SDK fixtures/contract tests as the frozen handoff for the not-yet-built Day-7 consumer.

---

## 29. Explicit non-goals

Day 6 does **not**:

- change accepted Solidity financial behavior;
- add a server trade/claim/launch relay;
- add private-key custody;
- make PostgreSQL/Redis/journal/indexer/API financial authority;
- invent Arc mainnet/canonical DEX values;
- freeze unresolved Bread production economics/admin addresses;
- claim exact current-live Pons parity or audit-clean status;
- invent a Buyback event/state absent from the accepted current contract surface;
- claim a current DEX price after graduation without a ratified DEX-price source;
- expose fabricated PnL/average entry from incomplete cost basis;
- add one chain subscription per browser;
- add asynchronous journal-to-projection workers;
- rely on archive RPC for deterministic rebuild of mutable un-emitted config history;
- skip the written-spec review gate;
- start production Day-6 code before the writing-plans gate.

---

## 30. Remaining external/release gates

These remain deliberately unresolved and are **not** Day-6 guesses:

- `BREAD_PRODUCTION_ECONOMICS_CONFIG`;
- Arc mainnet manifest values;
- canonical Arc V4/V3 activation evidence;
- future live DEX-price indexing source for graduated tokens;
- exact-current Pons parity claims;
- future Pons audit findings and Bread independent release review.

They do not block local/test Day-6 implementation of this frozen architecture.

---

## 31. Self-review result

Self-review checked placeholders, contradictions, scope, authority leakage, reconstruction dependencies, and ambiguity.

Corrections made before requesting user review:

1. **Initial supply:** changed from a later `totalSupply()` enrichment assumption to the immutable constructor mint `Transfer(0 → curve)` in the launch transaction.
2. **Event drift policy:** separated `INDEXED_CANONICAL`, `KNOWN_IGNORED` (e.g. `Approval`), and truly `UNKNOWN` events so ordinary irrelevant logs do not falsely halt ingestion.
3. **Historical mutable config:** removed archive-RPC reads as a deterministic rebuild requirement; mutable admin history is recorded only from reconstructable canonical evidence.
4. **Deployment code hashes:** made expected runtime hashes mandatory for any active/registered stack to obtain REC-05/RECONCILE PASS.
5. **Buyback:** made the current absence of an accepted Buyback event surface explicit; Day 6 will not synthesize one because 06B lists the family abstractly.
6. **Integer serialization:** decoded event integers and API protocol amounts remain lossless decimal strings at JSON boundaries.

No `TODO`, `TBD`, unresolved placeholder value, guessed production address/economics value, or deferred financial-authority decision remains in this design.

---

## 32. Written-spec review gate

The next step is the required **user review of this written spec**. Production Day-6 implementation remains blocked.

Review criteria:

1. no conflict with the uploaded Source Pack or accepted Day-1–Day-5 behavior;
2. no database/cache/API financial authority;
3. no duplicated claim/trade/graduation semantics;
4. deterministic same-transaction normalization against the actual contracts;
5. Arc finality handled without guessed confirmation counts;
6. cache/realtime strictly post-commit and disposable;
7. delete-DB rebuild/reconciliation can reconstruct the application view from chain;
8. Day-6 scale work begins now rather than Day 8;
9. unresolved production/mainnet values remain explicit external gates;
10. implementation can be decomposed into small continuously integrated RED → GREEN lanes.

Only after the user approves this written design may `superpowers:writing-plans` be invoked to create the detailed Day-6 implementation plan. Only after that plan gate may Day-6 production implementation begin.
