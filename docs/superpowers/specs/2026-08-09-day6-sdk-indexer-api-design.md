# Bread Day 6 — Protocol SDK, Transactional Indexer, Read API & Reconciliation Design

Date: 2026-08-09  
Status: **WRITTEN DESIGN — AWAITING REQUIRED USER SPEC REVIEW**  
Repository: `Dtwosam/bread`  
Verified design baseline: `8ff119dd31db32bc8f1d24048f31a07f7acf4c62`  
Day-5 durable handoff baseline: `4cc1ea7041abaa86402114321bf31e53aff8ea90`  
Frozen architecture decision: `DAY6_INDEXER_ARCHITECTURE = TRANSACTIONAL_EVENT_JOURNAL_WITH_SYNCHRONOUS_PROJECTIONS`

This document is the Day-6 design required before the writing-plans gate and before any Day-6 production TypeScript/database/API implementation. It extends the accepted Day-1 through Day-5 Bread stack. It does not reopen contract economics, trading math, FeeEscrow accounting, Factory/Launch+Buy behavior, opening protection, emergency authority, graduation semantics, adapter semantics, or permanent-lock behavior.

---

## 1. Source and baseline reconciliation

### 1.1 Controlling Project Sources read for this design

The design is constrained by the uploaded Project Sources, especially:

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

The uploaded `CURRENT-BUILD-STATE-v1.6` still records the earlier Day-5 preflight boundary. That workflow-position snapshot is older than the accepted Git/evidence state. It does not introduce a conflicting protocol rule. The newer repository `docs/current-build-state.yaml`, the Day-6 rollover handoff/evidence, and the user's current explicit continuation instruction consistently record Day 5 as durably closed and Day 6 as preflight/design with no Day-6 production code started.

### 1.2 GitHub baseline verification

Actual `main` was verified to be exactly:

`8ff119dd31db32bc8f1d24048f31a07f7acf4c62`

Comparison of expected `8ff119d...` to current `main` is identical.

Every commit between the Day-5 durable handoff merge `4cc1ea7041abaa86402114321bf31e53aff8ea90` and current `main` was inspected:

1. `8cd4573d7a67d93c054d9dc68d35e95b2f8aaa4d` — documentation-only Day-6 rollover handoff; this is the already-recorded bounded direct-to-main process deviation.
2. `b60336d7c5e751440f1cf843667f53b7fb7a7dc7` — documentation-only machine-readable rollover/current-state update.
3. `cdf8fadfc1940ac5d148c14badfccfc3b10bca1f` — documentation-only Day-6 rollover evidence.
4. `8ff119dd31db32bc8f1d24048f31a07f7acf4c62` — merge of the accepted Day-6 preflight rollover state.

No Day-6 database schema, SDK, indexer, API, runtime config, dependency, contract, or production code was introduced by those commits.

PR #34 merged the rollover branch. CI run `31286942830` passed all four repository jobs: bootstrap validation, infrastructure health, dependency build, and Foundry bootstrap.

### 1.3 Accepted Day-5 boundary

Day 5 remains closed with:

- `DAY_5_GRADUATION_ADAPTER_LOCK_INTEGRATED_PASS`
- `FULL_LAUNCH_TRADE_GRADUATE_LOCK_PASS`
- `INV_050_056_PASS`
- `RETRY_CANNOT_DUPLICATE_LIQUIDITY`
- `RETRY_CANNOT_DOUBLE_SPEND_SWEPT_ASSETS`

Nothing in Day 6 may reinterpret those outcomes as database-owned or API-owned financial state.

---

## 2. Non-negotiable authority model

1. **Arc is financial authority.** Onchain contracts remain authoritative for balances, tracked reserves, fees, claims, ownership, emergency state, launch snapshots, graduation state, and permanent liquidity custody.
2. **The event journal is not a financial ledger.** It is a durable reconstruction/audit primitive containing canonical onchain logs and deterministic decode metadata.
3. **PostgreSQL projections are rebuildable views.** A database row may describe chain state but never supersedes chain state.
4. **Redis is disposable coordination/cache state.** Losing Redis may reduce freshness/performance; it may never change protocol meaning.
5. **The API is read-only for protocol financial actions.** No Bread server signs, relays, queues, custodizes, or submits user trades/claims/launches.
6. **The SDK prepares direct wallet-to-contract transactions.** No private-key custody and no server-side user transaction execution.
7. **All monetary integer fields remain exact.** USDC remains 6-decimal ERC-20 accounting; API transport uses decimal strings for token/USDC/base-unit amounts rather than JavaScript floating-point numbers.
8. **No Arc mainnet value, production economics/admin value, or canonical DEX address is introduced by Day 6.** Existing release gates stay open until authoritative values are published/frozen.

---

## 3. Architecture approaches and decision

### 3.1 Approved: transactional event journal with synchronous projections

For a contiguous batch of committed Arc blocks:

1. discover/fetch all relevant canonical logs;
2. decode and validate them against the canonical ABI registry;
3. enrich only where the accepted contract event does not itself contain a required immutable projection field;
4. begin one PostgreSQL transaction;
5. lock the stack checkpoint row;
6. insert new journal rows using the canonical chain/log identity;
7. apply every projection caused by newly inserted rows, in deterministic block/transaction/log order;
8. advance the committed checkpoint only after the whole contiguous range is valid;
9. commit once;
10. only after commit, invalidate cache generations and publish shared realtime messages.

This provides one durable atomic boundary between raw event evidence, derived state, and the finalized ingestion cursor.

### 3.2 Rejected: direct-to-projection ingestion without a journal

Rejected because replay/debug/rebuild evidence is weaker, decoder drift is harder to inspect, and projection reconstruction has no durable canonical-log audit trail.

### 3.3 Rejected for Day 6: asynchronous journal then projection worker

Rejected because it creates a second ordering/checkpoint problem, introduces queue lag between journal and user-visible state, and adds failure/retry semantics not needed for the public-beta path. Asynchronous **post-commit cache/realtime effects** are allowed because they do not own canonical projection state; asynchronous financial/projection application is not.

---

## 4. Package and schema ownership

Canonical ownership is frozen as follows.

### `@bread/config`

Owns:

- strict NetworkManifest and ProtocolManifest validation;
- network/stack address/config resolution;
- `deploymentStartBlock`;
- runtime indexer/API environment schemas that are not financial semantics;
- production rejection of unknown manifest keys;
- historical manifest immutability.

No other package keeps a private address map or chain-specific constant set.

### `@bread/types`

Owns:

- canonical domain identities;
- normalized event/domain types;
- API request/response types and freshness envelope;
- cursor/feed/search/token/trade/holder/portfolio/creator/status transport types;
- typed reconciliation report shape.

Amounts crossing package/API boundaries use `bigint` internally and decimal strings in JSON.

### `@bread/protocol-sdk`

Owns:

- generated canonical Bread ABIs;
- ABI registry by still-supported stack/interface version;
- manifest-to-`ProtocolContext` resolution;
- typed prepared transaction builders/simulations;
- custom-error decoding;
- event decoding helpers.

No React dependency. No key custody.

### `@bread/db`

Owns:

- Drizzle/PostgreSQL schema;
- migrations;
- transactional indexer write repositories;
- API read repositories;
- deterministic cursor query primitives.

Indexer and API must not define private SQL interpretations of the same domain fields.

### `@bread/indexer`

Owns:

- Arc log discovery/fetching;
- dynamic launch-address registry construction;
- deterministic transaction event assembly/correlation;
- chain enrichment reads;
- transactional journal/projection application;
- checkpoints/overlap replay/rebuild;
- reconciliation CLI orchestration;
- post-commit cache invalidation/fanout production.

### `@bread/api`

Owns:

- Fastify read routes;
- validation, pagination, response envelopes and errors;
- cache read-through/single-flight behavior;
- rate limiting and overload behavior;
- read-only status/freshness exposure.

Production API DB credentials are read-only. Migration/indexer credentials are separate.

### `@bread/observability`

Owns shared structured logs/metrics/error correlation where already applicable. Day-6 services expose queue/backlog/checkpoint/cache/RPC/DB/reconciliation metrics through this existing boundary rather than inventing a second logging format.

---

## 5. Canonical ABI and address pipeline

### 5.1 ABI generation

Bread contract ABIs are generated from exact Foundry build artifacts. Checked-in generated SDK ABI files are allowed for package consumption, but a deterministic generation/check script must prove they match the current contract artifacts. CI fails on ABI drift.

Manual frontend/indexer copies of ABI fragments are prohibited.

The generated artifacts must include inherited events/errors needed by Day 6, including standard `Transfer` and `OwnershipTransferred` where the concrete Bread contract exposes them through inheritance.

### 5.2 Address resolution

`@bread/protocol-sdk` resolves addresses only from a validated `@bread/config` manifest/stack context. Consumers receive a `ProtocolContext`; they do not import testnet addresses directly.

The protocol context contains at least:

```ts
type ProtocolContext = {
  chainId: number;
  stackVersion: string;
  addresses: ProtocolAddresses;
  quoteAsset: Address;
  graduationAdapter: Address;
};
```

The exact `ProtocolAddresses` includes the manifest-declared current stack surfaces needed by builders/decoders: Factory, FeeEscrow, FeePolicy where present, EmergencyController, GraduationCoordinator, permanent locker, deployer, and active/snapshotted adapter context. Missing release-only values remain validation gates; they are not replaced by defaults.

### 5.3 Stack-version compatibility

The SDK ABI registry and event decoder are version-aware. A later stack may add/change an interface without rewriting history. An unsupported stack/interface produces an explicit unsupported-version error; it must not be decoded using the newest ABI by assumption.

---

## 6. Canonical domain identities

The 06B identities remain exact:

- network: `chainId`;
- protocol stack: `chainId + stackVersion + factoryAddress`;
- launch: `chainId + tokenAddress`;
- curve: `curveAddress`, linked one-to-one to launch;
- canonical chain log / trade: `chainId + transactionHash + logIndex`;
- creator/wallet: wallet address;
- graduated pool: `chainId + adapter-defined pool identifier/address`.

All EVM addresses are validated/canonicalized with viem before persistence/query boundaries. Names/tickers are metadata only and never keys.

Canonical event identity string representation for fanout/cursors/debugging is:

`<chainId>:<transactionHash-lowercase>:<logIndex-decimal>`

The database primary key remains structured columns rather than relying on the string encoding.

---

## 7. Actual Day-1 through Day-5 event contract

Day 6 consumes the events already emitted by the accepted contracts. It does not create an alternate semantic event model in the contracts.

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

### Launch token / inherited events

- ERC-20 `Transfer` is the canonical holder-balance event.
- `Approval` is not required for a Day-6 user projection and is not indexed merely because it exists.
- inherited `OwnershipTransferred` is indexed for every relevant Ownable Bread contract.

Adapter/DEX implementation logs are not required to infer Bread graduation state. `GraduationCompleted` plus locker state is Bread's accepted public outcome. External DEX logs may be reconciliation evidence but may not replace the coordinator/locker contract state.

---

## 8. Durable event journal

Additional table: `event_journal`.

It is permitted by the approved Day-6 architecture as a reconstruction/audit primitive. It is not a second financial ledger.

Each row contains at least:

- `chain_id`;
- `transaction_hash`;
- `log_index`;
- `block_number`;
- `block_hash`;
- `block_timestamp`;
- `transaction_index`;
- `contract_address`;
- `contract_role`;
- `stack_version`;
- `topic0`;
- exact raw `topics`;
- exact raw `data`;
- decoded event name;
- decoded payload;
- nullable launch token/curve context when deterministically known;
- decoder/schema version.

Primary key:

`(chain_id, transaction_hash, log_index)`

Important indexes:

- `(chain_id, block_number, transaction_index, log_index)`;
- `(chain_id, contract_address, block_number)`;
- `(chain_id, token_address, block_number)` when token context exists;
- event-name/source indexes needed by reconciliation.

Processing order is always:

`blockNumber ASC, transactionIndex ASC, logIndex ASC`.

A journal uniqueness conflict means the log has already been durably applied. The reducer must not reapply its projection effect.

Unknown event topics emitted by a known Bread protocol contract are not silently ignored in production. They indicate ABI/version drift or an unsupported stack. The affected block is not committed; the stack becomes degraded/error until the interface is reconciled.

---

## 9. Dynamic log discovery

A newly deployed launch token emits its constructor mint `Transfer` before Factory `LaunchCreated` is emitted in the same transaction. A Launch+Buy can then emit curve/token events later in that same transaction. Therefore a single precomputed address filter is insufficient.

For each contiguous block range the indexer performs a deterministic two-pass discovery:

1. query Factory `LaunchCreated` logs for the range using the manifest Factory;
2. combine previously known launch token/curve addresses with token/curve addresses discovered in pass 1;
3. fetch the complete relevant Bread log set for core addresses plus the expanded dynamic token/curve address set, using bounded address/range chunks;
4. merge/deduplicate logs by canonical identity and sort by block/transaction/log order;
5. fetch required block headers/timestamps and immutable launch enrichment reads;
6. only then enter the PostgreSQL transaction.

This captures the constructor mint and same-transaction Launch+Buy events without scanning every ERC-20 `Transfer` on Arc.

Address/range RPC concurrency is bounded. A growing token list may increase the number of chunked requests but never creates one subscription or unbounded request per browser/user.

---

## 10. Event normalization and transaction assembly

Raw journal rows preserve each actual onchain event. Normalized projections may correlate multiple logs from the same transaction where the accepted contracts intentionally split one user action across several events.

All correlation is deterministic, local to one ordered transaction, and tested against the exact current event sequence.

### 10.1 Launch normalization

`LaunchCreated` is the primary launch identity event.

The current event does not contain every 06B immutable launch snapshot field. The indexer therefore performs block-scoped read enrichment against the actual deployed contracts rather than inventing values or changing the accepted Day-4/Day-5 event surface.

For each new launch it reads:

- Factory `getLaunch(token)`;
- Factory `stackVersion()`;
- curve immutable/current snapshot getters needed to reconstruct supply/economics at creation (`pairToken`, `phantomQuote`, `graduationThreshold`, fee snapshot getters, creator tax, launch timestamp, reserved token state);
- token `totalSupply`, name, symbol, `getTokenInfo`/social metadata.

Launch snapshot fields are written once. Future global config changes do not rewrite them.

### 10.2 Buy normalization

Canonical trade identity is the `CurveBuy` log identity.

For the current accepted curve, a buy emits:

- optional `CurveBuyRefunded`;
- `OpeningProtectionApplied`;
- `CurveBuy`.

These can be interleaved with ERC-20 `Transfer` logs from other addresses. The transaction assembler tracks unconsumed curve-local buy context and, when `CurveBuy` is reached, consumes the matching prior refund/opening-protection context for the same emitting curve/buyer/recipient.

The normalized BUY stores:

- actor/buyer;
- recipient;
- offered quote = `spent + refund`;
- actual spent quote;
- tokens out;
- base fee;
- creator tax;
- opening tax amount;
- opening tax bps;
- Launch+Buy exemption boolean;
- refund;
- net curve input = `spent - baseFee - creatorTax - openingTax`;
- post-state derived by applying the accepted curve accounting transition.

For the current curve, an `OpeningProtectionApplied` event is mandatory for each buy. Missing/mismatched correlation is an indexer normalization error; the block does not advance.

If `LaunchAndBuyExecuted` is present later in the transaction, it is a consistency check against the already-normalized curve trade (`token`, `curve`, `buyer`, `recipient`, offered quote, spent, refund, tokens out). It is not a second trade.

### 10.3 Sell normalization

Canonical trade identity is the `CurveSell` log identity.

The normalized SELL stores:

- seller;
- recipient;
- tokens in;
- net quote out;
- base fee;
- creator tax;
- gross curve quote out = `quoteOut + fee + creatorTax`;
- opening tax = zero;
- post-state derived by the accepted curve transition.

### 10.4 Market price and volume semantics

To avoid fee asymmetry in the chart price:

- BUY curve execution price is derived from `netCurveInput / tokensOut`;
- SELL curve execution price is derived from `grossCurveQuoteOut / tokensIn`.

User-visible traded quote volume is:

- BUY: actual `spent`;
- SELL: gross curve quote out (`quoteOut + fee + creatorTax`).

No JavaScript floating point is used for protocol amounts. Derived price/candle values use arbitrary-precision decimal/integer arithmetic and are explicitly display projections.

### 10.5 Fee credit/claim normalization

`FeeEscrow.FeeCredited` is the only canonical event that creates an indexed claim entitlement. `FeesSwept`, `LaunchFeeCredited`, and graduation dust events are attribution/audit context and must not create a second credit row.

Each `fee_credits` row stores the FeeEscrow event identity, creditor, recipient, amount, recipient balance after, total outstanding after, and derived source/token classification where deterministic.

Each `fee_claims` row comes only from `FeeEscrow.FeeClaimed` and stores recipient, amount, remaining balance, and total outstanding.

Claims consume an aggregate recipient escrow balance; they are not artificially allocated back to individual tokens.

Token/source attribution rules:

- curve creditor -> exact curve/token mapping;
- Factory creditor -> correlate the same-transaction `LaunchFeeCredited` event; classification is protocol launch fee;
- GraduationCoordinator creditor -> correlate ordered curve-release/graduation events in the same transaction to the current graduation token;
- if future code changes make attribution ambiguous, entitlement still comes from FeeEscrow but the current decoder version must not silently invent per-token revenue attribution.

### 10.6 Graduation normalization

Projection transitions follow actual contract events/state:

- `GraduationReady` -> ready/processing signal only;
- `GraduationAutoAttemptFailed` -> operational failure signal only, not a financial rollback;
- `CurveGraduationReleased` -> curve custody/release audit transition;
- `GraduationSwept` -> coordinator `SWEPT` phase and exact swept amounts;
- `GraduationCompleted` -> `POOL_CREATED`, adapter/pool/position identity and used/locked/dust amounts;
- `GraduationRescued` -> `RESCUED`;
- locker events -> permanent-lock evidence/projection.

`GraduationCompleted` never means “safe investment”; it means the accepted onchain graduation/lock path completed.

### 10.7 Holder normalization

Launch-token ERC-20 `Transfer` events update the rebuildable current holder snapshot.

- mint from zero increases recipient balance/current supply;
- ordinary transfer debits sender and credits recipient;
- burn to zero debits sender/current supply;
- zero address is never a holder;
- known protocol addresses are tagged using manifest + launch-specific curve/coordinator/locker/adapter context.

Top-10 user concentration excludes known protocol addresses, matching 04C. The raw holder view can still identify protocol-held balances.

### 10.8 Admin/security normalization

`admin_events` records privileged/config/recovery events including:

- ownership transfer;
- guardian changes;
- restriction changes;
- graduation pause changes;
- FeePolicy updates/sweep-operator changes;
- FeeEscrow creditor authorization;
- Factory deployer/coordinator/config changes;
- locker coordinator binding;
- graduation rescue.

Where an event only announces a version change but not the new full config (for example Factory `LaunchConfigUpdated`), a block-scoped chain read may enrich the admin record. The event remains the trigger; the chain read supplies the actual contract state at that block.

---

## 11. Arc finality and defensive integrity behavior

The Project Source references Arc deterministic finality. Current official Arc documentation was rechecked on 2026-08-09 and states that committed blocks are immediately irreversible, with no confirmation window and no normal reorganization handling requirement.

Therefore Day 6 freezes these semantics:

1. the indexer processes Arc blocks once they are returned as committed/latest chain blocks by the configured Arc RPC;
2. there is **no invented confirmation-count threshold**;
3. there is no normal rollback/reorg projection subsystem;
4. overlap replay exists for restart/crash/idempotency and missed-request recovery, not probabilistic-finality handling;
5. `indexer_checkpoints` stores the exact committed block number + hash;
6. if a previously committed checkpoint block hash ever differs from a provider response, Bread treats it as `FINALITY_OR_PROVIDER_INTEGRITY_VIOLATION` rather than silently rewriting history;
7. on that condition, checkpoint advancement stops, another configured provider is consulted, the API exposes degraded status, and recovery requires the explicit rebuild/reconciliation path before normal advancement resumes.

This defensive incident path does not contradict Arc's no-reorg model; it catches provider corruption, wrong-chain connections, or an unexpected network-level invariant violation.

---

## 12. Transactional ingestion and checkpoint rules

For each stack, one active ingestor is preferred. Correctness does not depend on a single process.

- An indexer process obtains a stack-scoped PostgreSQL advisory lease where practical to avoid redundant active writers.
- Every write batch additionally locks the stack's `indexer_checkpoints` row `FOR UPDATE`.
- Event-journal uniqueness is the final duplicate-application guard.

A batch may cover multiple contiguous blocks, but it may not skip a block range.

Before commit:

- all RPC reads for the range succeeded;
- every known-contract log decoded under the stack ABI version;
- all required same-transaction correlations/enrichments are valid;
- block ordering/parent/hash continuity for the fetched range is coherent with the starting checkpoint.

Inside one PostgreSQL transaction:

1. lock checkpoint;
2. insert all new journal rows in canonical order;
3. apply projection changes only for journal rows newly inserted in this transaction;
4. update aggregates/candles/metrics deterministically;
5. advance the checkpoint to the exact final block/hash of the contiguous applied range;
6. commit.

A crash before commit leaves neither journal rows, projections nor checkpoint advancement. A crash after commit may lose post-commit cache/realtime notifications, but the database remains correct and Redis TTL/refetch behavior heals presentation state.

---

## 13. Overlap replay

On restart/catch-up, the indexer intentionally begins before the existing checkpoint using a bounded configured overlap window.

The overlap window is an operational runtime value validated by `@bread/config`; it is not an Arc finality value and does not claim a required confirmation depth.

Rules:

- start never precedes the manifest `deploymentStartBlock`;
- journal PK conflicts do not reapply projections;
- checkpoint never regresses;
- newly discovered events after the previous checkpoint apply normally;
- repeated replay of the same exact range produces byte/logically equivalent projection state;
- no duplicate trades, fee credits, claims, admin events, holder effects, graduation outcomes, candles, rollups or metrics are created.

`OVERLAP_REPLAY_IDEMPOTENT` requires snapshot/count/hash equality before and after replay of an already-complete range.

---

## 14. PostgreSQL table contract

The Day-6 schema contains the source-defined families plus `event_journal`.

### `protocol_stacks`

Immutable/versioned stack identity and deployment evidence:

- chain id;
- stack version;
- Factory address;
- deployment start block;
- protocol/network manifest hashes;
- source commit;
- expected deployment/code hashes when available from verified deployment evidence;
- adapter family/address/config hash;
- created/registered timestamps.

Primary identity: `(chain_id, stack_version, factory_address)`.

### `launches`

Immutable launch identity/snapshot:

- chain/token/curve;
- protocol stack identity;
- original deployer;
- creator fee recipient;
- creator tax bps;
- launch/economics digest;
- config version;
- launch timestamp/block/event identity;
- quote asset;
- supply;
- phantom quote;
- graduation threshold;
- snapshotted FeePolicy values;
- coordinator;
- adapter/family/config hash;
- reserved-token baseline.

Primary identity: `(chain_id, token_address)`.

### `launch_state`

Current rebuildable state:

- tracked quote/tokens;
- quote-fee balance;
- creator-tax balance;
- derived real/virtual reserves;
- sellable tokens;
- ready/graduated state;
- graduation phase;
- swept values;
- pool/position identity;
- permanent-lock evidence;
- last applied event/checkpoint.

No field here can authorize a financial action.

### `trades`

Append-only normalized trade rows keyed by canonical `chainId + txHash + logIndex`, with exact integer amounts/taxes/refund and derived execution-price representation.

### `fee_credits`

Append-only FeeEscrow credit events only.

### `fee_claims`

Append-only FeeEscrow claim events only.

### `creator_rollups`

Rebuildable wallet-level aggregates, including created-launch count and credited/claimed revenue views. Revenue role and original-deployer role remain distinct when the launch's creator-fee recipient differs from the deployer.

### `holder_snapshots`

Current per-token/per-holder indexed balance snapshot with last source event/checkpoint and protocol-address classification. This table supports holders and portfolio reads. It is derived from launch-token Transfers and is not an authoritative wallet balance service.

### `market_candles`

Derived OHLCV buckets from normalized curve trades. Initial supported chart intervals are `1m`, `5m`, and `1h`; wider UI periods are composed from these/query aggregation rather than creating a second trade source.

Candle values use exact/arbitrary-precision arithmetic. Rebuild from trades must reproduce the same buckets.

### `token_metrics`

Current derived activity/market fields:

- spot/last curve price representation and price source;
- market-cap display projection where price is available;
- 5m/1h/24h quote volume;
- 1h/24h trade count;
- 1h/24h unique traders;
- holder counts;
- top-10 non-protocol concentration;
- graduation progress bps;
- last activity block/time;
- graduated/processing state.

For an active curve, spot price derives from the accepted constant-product reserve state with arbitrary-precision arithmetic. After graduation, Day 6 does **not** fabricate a live DEX price from the old curve. Until a separately ratified DEX-price source is indexed, the API marks the last curve value as historical/last-curve rather than current DEX market price.

### `indexer_checkpoints`

One current finalized/committed cursor per stack:

- stack identity;
- deployment start block;
- last committed block number;
- last committed block hash;
- block timestamp;
- last canonical event identity when one exists in the block/range;
- decoder/projection schema version;
- updated timestamp;
- current ingestion health state.

### `admin_events`

Append-only normalized privileged/config/recovery event history keyed by canonical event identity.

### `metadata`

Sanitized display metadata separated from financial state:

- name/symbol;
- logo/description;
- socials/links;
- sanitization/schema version;
- source block/event context.

Onchain strings are attacker-controlled display input. No HTML execution is permitted. URLs are parsed/allowlisted by scheme; API metadata processing does not perform arbitrary remote fetches.

---

## 15. Derived feed algorithms

04A requires an explicit indexer algorithm for Trending and prohibits disguised paid placement. The source does not ratify a weighted score, so Day 6 uses transparent deterministic ordering rather than a hidden weighted formula.

### New

Active/all launches ordered by:

1. launch block/time descending;
2. canonical launch event log index descending;
3. token address ascending as deterministic tie-breaker.

### Trending

Eligible launches with activity in the trailing one-hour indexed window ordered by:

1. `volume_usdc_1h` descending;
2. `unique_traders_1h` descending;
3. `trade_count_1h` descending;
4. latest activity block/log descending;
5. token address ascending.

There is no paid-placement field in organic trending order. Any future sponsored placement must be separately labeled and cannot alter this organic ordering silently.

### Near Graduation

Non-graduated launches ordered by:

1. graduation progress bps descending;
2. `volume_usdc_1h` descending;
3. launch time descending;
4. token address ascending.

Graduation progress is the exact rebuildable ratio of real tracked quote toward the snapshotted `graduationThreshold`, clamped to 0–10,000 bps. Readiness/phase still comes from accepted curve/coordinator semantics; the percentage never overrides the actual readiness flag.

### Graduated

`POOL_CREATED` launches ordered by graduation-completion block/log descending, token address tie-breaker.

A rescued launch is not represented as successfully graduated.

---

## 16. Protocol SDK transaction contract

All prepared Bread user transactions have `value = 0n` for V1 protocol financial value because ERC-20 USDC is the quote asset; native Arc balance is gas only.

Builders accept validated `ProtocolContext` + typed amounts/addresses and return the 06B `PreparedTransaction` shape plus structured preflight/simulation information.

### Buy

Target: launch curve `buy(quoteIn, minTokensOut, recipient)`.

Builder/simulation exposes:

- curve/token context;
- USDC spender/allowance requirement;
- expected output where simulation is available;
- base fee/creator tax/opening-tax context from current chain reads;
- no signing/submission.

### Sell

Target: launch curve `sell(tokensIn, minQuoteOut, recipient)`.

Exposes launch-token allowance requirement and simulation result.

### Launch

Target: Factory `launchToken(params)` using the exact accepted `IBreadLaunchFactory.LaunchParams` semantics and current `expectedEconomics` digest support.

### Launch + Buy

Target: Factory `launchTokenAndBuy(params, quoteIn, minTokensOut, recipient)`.

The SDK does not duplicate curve math to create an alternate authority. It may display/simulate expected values, but final transaction behavior is the existing Factory/curve path.

### Claim

Target: canonical FeeEscrow `claim()` or `claim(amount)` according to whether an optional exact amount is requested.

Indexed API claimable data is informational; simulation/current FeeEscrow chain state is used before signing.

### RetryGraduation

The current accepted Day-5 lifecycle has two permissionless retryable stages. `prepareRetryGraduation` reads the canonical coordinator phase:

- `NOT_GRADUATED` with a ready curve -> prepare `GraduationCoordinator.sweep(token)`;
- `SWEPT` -> prepare `GraduationCoordinator.createPool(token)`;
- `POOL_CREATED` -> return typed terminal/already-complete result, no transaction;
- `RESCUED` -> return typed terminal/rescued result, no transaction.

It never changes the snapshotted adapter/destination.

### Approval support

Builders return required asset/spender/amount allowance metadata. A small canonical ERC-20 approval helper may be exported by the SDK so the frontend does not hand-encode approvals. This helper is generic wallet preparation, not a Bread server transaction path.

### Simulation and decoding

Simulation accepts a viem `PublicClient` and account/address context; it never needs a private key.

Custom errors are decoded through the same generated ABI registry. Unknown selectors return a typed `UNKNOWN_REVERT` retaining bounded technical details rather than fabricating a human reason.

---

## 17. API response and freshness envelope

Every successful indexed response uses a shared envelope:

```ts
type IndexedResponse<T> = {
  data: T;
  meta: FreshnessMeta;
  page?: CursorPageMeta;
};
```

`FreshnessMeta` contains at least:

- `chainId`;
- current API/indexer schema version;
- indexed-through block number (decimal string);
- indexed-through block hash;
- indexed-through block timestamp;
- `servedAt`;
- `source: "bread-indexer"`;
- freshness status: `FRESH | LAGGING | REBUILDING | DEGRADED`;
- optional observed Arc head block number and derived lag blocks when the service has a current observation;
- cache state (`HIT | MISS | STALE_SAFE | BYPASS`) when applicable;
- stack version where the response is single-stack; multi-item feed entries carry their own stack version.

Serving a cached response never rewrites its indexed-through block to look newer. `servedAt` may be current; the cached checkpoint remains the checkpoint that produced the data.

`FRESH` is an operational indexer label, not a statement that the API is financial authority.

---

## 18. Required read endpoints

### `GET /v1/feed`

Query:

- `view=new|trending|graduating|graduated`;
- bounded `limit`;
- opaque deterministic cursor.

Returns token-card-ready indexed summaries and freshness metadata.

### `GET /v1/search`

Searches:

- exact canonical contract address;
- exact creator wallet;
- case-normalized ticker exact/prefix;
- case-normalized token-name prefix.

Address-like queries may execute immediately. Text queries use the 04C approximate two-character minimum. Exact contract match outranks duplicate-name/ticker results.

No unbounded substring/offset scan is introduced for Day 6. Search has its own stricter rate-limit bucket and DB concurrency cap.

### `GET /v1/tokens/:address`

Returns immutable launch snapshot + current indexed launch state + metrics + sanitized metadata + graduation/lock status + freshness.

### `GET /v1/tokens/:address/trades`

Deterministic reverse chronological cursor by `(blockNumber, transactionIndex, logIndex)` with canonical event ID.

### `GET /v1/tokens/:address/holders`

Returns derived holder rows with protocol-address tagging and top-holder concentration metadata. It is explicitly indexed/derived, not a chain balance assertion.

### `GET /v1/portfolio/:address`

Returns indexed launch-token holdings and relevant activity for the wallet. No PnL/average entry is exposed unless cost basis is complete and reliable. External transfers make naive average-entry reconstruction unsafe, so Day 6 does not fabricate PnL.

If a graduated token lacks a live ratified DEX-price source, portfolio value for that token is marked unavailable/historical rather than pretending the final curve price is current.

### `GET /v1/creators/:address`

Returns launches created by the wallet, fee-recipient relationships, indexed credited/claimed/claimable aggregate views, and per-launch earned revenue where deterministic event attribution exists.

The API does not claim that indexed claimable amount supersedes `FeeEscrow.balanceOf` onchain.

### `GET /v1/status`

Returns no secrets. Includes:

- chain/stack identities supported;
- current checkpoint/head observation/lag;
- DB/Redis/RPC/indexer health classes;
- backlog/queue state;
- rebuild mode;
- last reconciliation verdict/time/report identity;
- cache/fanout degraded state;
- decoder/schema version.

RPC URLs, credentials, database DSNs, admin secrets, and private operational tokens are never returned.

---

## 19. Input validation, cursors and errors

### Addresses

All route/query addresses are parsed/canonicalized with viem. Invalid length/checksum/hex shape -> HTTP 400. The database never receives raw unvalidated address strings as lookup identities.

### Pagination

- cursor pagination only for feeds/trades/holders/large creator lists;
- no unbounded offset pagination;
- cursors are versioned, base64url-encoded structured sort keys;
- cursor input length and decoded fields are bounded;
- malformed/unknown cursor version -> HTTP 400;
- default/max page sizes are central constants/types, not per-route private values.

### Errors

Shared API error shape:

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

Expected classes:

- 400 invalid input/cursor;
- 404 unknown launch/resource;
- 429 endpoint-class rate limit, with bounded retry metadata;
- 503 dependency/rebuild state where serving would misrepresent availability;
- 500 unexpected internal error with no secret/raw stack exposure.

---

## 20. Cache design

Redis accelerates reads; it never owns projection state.

### Key model

Cache keys include:

- schema version;
- chain id;
- stack/feed/token identity;
- normalized query/cursor;
- a logical generation counter for invalidatable hot domains.

Logical generation keys avoid wildcard deletion:

- stack/feed generation;
- token generation;
- holder generation where separately useful.

A committed projection produces a set of affected cache domains. Only after DB commit are the corresponding Redis generations incremented/invalidated.

### Read-through and stampede control

For hot cache misses:

- one cross-instance Redis single-flight lock is attempted per normalized cache key;
- waiters use bounded jitter/wait and then read the filled cache;
- DB concurrency is capped independently so Redis failure cannot create an unbounded stampede;
- no recursive/unbounded retry loop is permitted.

### Safe stale behavior

Brief stale-but-marked responses are allowed only for non-transactional discovery/analytics surfaces such as feed/card analytics when within a configured maximum stale window.

No stale-safe mode may disguise old data as current. Portfolio/claimable/holder state and transaction-critical preparation never rely on stale cache as authority; the SDK performs current chain validation/simulation before signing.

### Redis failure

- PostgreSQL projection remains valid;
- cache is marked degraded;
- hot reads fall back through bounded local/process single-flight + DB concurrency controls;
- search may return 503 when the service cannot enforce the separate protective rate limit safely;
- no database checkpoint is rolled back because Redis failed.

---

## 21. Realtime fanout

Day 6 freezes the semantic fanout contract, not a browser-specific transport implementation.

The API/runtime may expose the chosen Day-7 transport over this contract, but the Day-6 producer/hub rules are fixed:

- one shared chain/indexer source, never one Arc subscription per browser;
- fanout is by logical channel;
- canonical message identity is the causal onchain event ID;
- publish only after the DB transaction commits;
- clients deduplicate by event ID;
- realtime payloads are invalidation hints, not financial state authority;
- clients refetch indexed state after relevant messages and after every disconnect/reconnect;
- slow-consumer queues/buffers are bounded; slow consumers are dropped/degraded rather than allowing unbounded memory growth.

Initial logical channels:

- `stack:<chainId>:<stackVersion>:feed`;
- `token:<chainId>:<tokenAddress>`;
- `wallet:<chainId>:<walletAddress>` only where needed for creator/portfolio invalidation, never for chain subscription fanout.

A fanout message contains only bounded invalidation data such as:

- event ID;
- channel;
- changed domain/kind;
- token/wallet identity when relevant;
- committed checkpoint block/hash.

It does not replicate a large token/trade payload to every subscriber. Consumers refetch and client-side requests coalesce.

If publication fails after commit, the database remains correct. Cache TTLs and reconnect/refetch recover presentation. The failure is observable and `GET /v1/status` reports degraded fanout/cache health.

---

## 22. Reconciliation command

Canonical operator surface:

`reconcile --network arc-testnet --stack <version>`

Reconciliation reads chain independently of the projection it is validating and emits a machine-readable JSON report plus a human-readable summary.

Report identity includes:

- report schema version;
- network/chain id;
- stack version/Factory;
- source commit/manifest hashes;
- deployment start block;
- checked-through block/hash;
- started/completed time;
- each check ID/status;
- explicit mismatches;
- overall `PASS | FAIL`.

### Required checks

#### REC-01 Launch event/projection completeness

Independently scan Factory `LaunchCreated` logs from deployment start through the checked block. Compare canonical identities/count/tokens against `event_journal` and `launches`.

#### REC-02 Curve tracked state

For every indexed launch, call canonical curve getters at the reconciliation block and compare:

- tracked quote;
- tracked tokens;
- quote fee balance;
- creator tax balance;
- reserves;
- reserved/sellable state;
- graduated/readiness state.

Mismatch is FAIL; there is no database-authority override.

#### REC-03 FeeEscrow solvency/projection

Onchain:

- read FeeEscrow `totalOutstanding`;
- read canonical USDC `balanceOf(FeeEscrow)`;
- require custody >= outstanding (surplus/donations are allowed).

Projection:

- reconstruct recipient balances/outstanding from `fee_credits` minus `fee_claims`;
- require projected aggregate outstanding == onchain `totalOutstanding` at the checked block.

No equality between custody and outstanding is required because surplus can exist.

#### REC-04 Graduation

Compare each indexed coordinator phase/amount/pool/position identity to `getGraduation(token)` and, for completed launches, verify permanent locker evidence (`isPositionLocked`/locked position and residue where applicable).

#### REC-05 Deployment identity/code hashes

For every manifest-required Bread deployment, verify address code exists and compare expected code hash where deployment evidence provides one. Verify chain id and canonical quote-asset identity/decimals through the existing config/deployment validation path.

No absent Arc mainnet/DEX value is guessed to make this pass.

#### REC-06 Checkpoint continuity

- stored checkpoint block/hash must equal chain;
- no journal row may be beyond checkpoint;
- an independent contiguous event scan from deployment start through checkpoint must produce the same relevant canonical event identity set as the journal;
- decoder/stack version must match the registered stack.

This independent scan is intentionally stronger than trusting one cursor row.

### Reconciliation failure

A mismatch produces `FAIL` with exact expected/actual evidence. It never rewrites chain or silently patches projection state. Recovery is rebuild/reconcile or an explicitly reviewed bug repair.

---

## 23. Delete-DB rebuild

`rebuild` starts from a blank Day-6 projection database/schema state after migrations and replays from manifest `deploymentStartBlock` through the chosen committed Arc head.

Rules:

1. never seed projection state from an old projection dump as canonical input;
2. use manifests + canonical chain logs/reads;
3. rebuild `event_journal` and all projections deterministically;
4. run full reconciliation at the rebuild target block;
5. emit a rebuild report containing counts/checkpoint/report hash/verdict;
6. only a reconciled rebuild is eligible to replace an active projection.

Production recovery should build/reconcile a replacement/shadow database or otherwise stop writer exposure rather than serving a half-rebuilt schema. The Day-6 destructive acceptance test is isolated/local/test infrastructure and cannot point at a production DSN without an explicit destructive-operation guard.

`DELETE_DB_REBUILD_PASS` requires equivalent canonical journal identity sets and equivalent externally relevant projection results at the same target block before/after deletion.

---

## 24. Failure and recovery semantics

### RPC unavailable/disagreeing

- do not advance checkpoint;
- use bounded configured provider failover;
- no infinite retry amplification;
- provider disagreement on already committed block hash -> integrity incident and stop/reconcile path.

### Unknown/invalid log decoding

- no partial block/range commit;
- checkpoint stays at previous valid block;
- expose decoder error/degraded status;
- fix canonical ABI/version support, then replay.

### Database transaction failure

- atomic rollback journal + projections + checkpoint;
- retry from prior checkpoint/overlap;
- uniqueness/idempotency prevents duplication.

### Indexer stopped

- API may continue serving the last durable projection with truthful `LAGGING`/`DEGRADED` freshness metadata;
- no chain financial behavior changes;
- on recovery, overlap replay then catch-up.

### Redis/cache/realtime unavailable

- no DB rollback;
- bounded DB fallback for eligible reads;
- explicit cache/fanout degradation;
- reconnect/refetch heals clients.

### Database unavailable

- eligible very-short stale non-financial cache may be served only if clearly marked and within stale bounds;
- otherwise 503;
- no raw-RPC fallback is introduced as a secret second API/indexer implementation.

### Reconciliation mismatch

- status becomes degraded;
- public API may continue truthful stale/indexed reads if safe, but operator acceptance/release gates fail;
- no auto-correction by comparing and choosing the database value;
- rebuild from chain and investigate root cause.

---

## 25. Capacity/backpressure design required on Day 6

Day 8 remains the full >=10,000-client integrated stress proof. Day 6 still performs the first meaningful concurrency proof and must already have the architecture needed to scale.

### API

- stateless/horizontally replicable route handlers;
- bounded PostgreSQL pool;
- bounded Redis/RPC concurrency;
- deterministic cursor/indexed queries only;
- separate search limiter/concurrency budget;
- cache-first hot feed/token reads;
- no unbounded request queue.

### Indexer

- bounded block range and address chunks;
- bounded provider concurrency;
- one canonical stack writer lease + DB correctness guards;
- no unbounded in-memory event queue;
- canonical projection application has priority over secondary enrichment;
- lag/backlog metrics always exposed.

### Realtime

- one post-commit publication per causal canonical projection event, shared to logical channel consumers;
- no browser-specific chain subscription;
- bounded slow-consumer buffer;
- clients coalesce refetches.

### Day-6 concurrency acceptance semantics

The Day-6 test must exercise all of these **at the same time**:

1. concurrent hot feed/token reads exceeding the configured DB pool size;
2. a cold-cache stampede on the same hot key;
3. an overlap replay containing already-journaled events;
4. a new committed event that updates a projection and causes post-commit cache/fanout effects;
5. multiple logical fanout consumers including a deliberately slow consumer;
6. bounded search requests under its separate limiter.

The pass condition is functional/correctness under concurrency: one durable event effect, no replay duplicates, bounded queues/pools, collapsed hot-cache misses, no per-client Arc RPC fanout, slow-consumer containment, truthful freshness, and no read errors other than intentionally enforced rate/backpressure responses. Day 8 applies the full 06I 10,000-client and p95/error-rate capacity thresholds.

---

## 26. Security/trust-boundary implications

1. Metadata is hostile display input; it never changes financial projections.
2. API input is hostile; addresses/cursors/search limits are validated before DB work.
3. Indexer RPC data is verified against expected chain/stack/address identities and checkpoint hashes.
4. Database corruption is recoverable because chain + manifests + deterministic code rebuild it.
5. Redis compromise/loss cannot create claim entitlement or transaction authority.
6. No API route holds a user private key or transaction relay capability.
7. No transaction builder takes an API-provided fee/economics value as authoritative without current-chain simulation/validation.
8. Admin/security events are indexed and observable but API/indexer cannot perform the admin action.
9. FeeEscrow entitlement is never inferred from upstream fee events when `FeeCredited` disagrees; reconciliation fails instead.
10. Donation transfers to curve/FeeEscrow are not converted into tracked reserve/claim entitlement by indexer assumptions.

---

## 27. Day-6 TDD/integration acceptance contract

Implementation must be decomposed by the later writing-plans workflow into small RED -> GREEN lanes. The design gate requires these final proofs:

### SDK/type contract

- generated ABI drift check PASS;
- manifest/address resolution tests PASS;
- Buy/Sell/Launch/Launch+Buy/Claim/RetryGraduation builder encoding tests PASS;
- simulation/custom-error decode tests PASS;
- no key custody/server submission surface.

### DB/indexer

- migration/schema tests PASS;
- exact journal identity/ordering tests PASS;
- same-transaction buy/refund/opening-tax normalization tests PASS;
- launch discovery captures constructor Transfer + same-transaction Launch+Buy events;
- fee credit entitlement is derived only from FeeEscrow;
- graduation phase/event normalization PASS;
- holder Transfer rebuild PASS;
- checkpoint atomicity failure injection PASS;
- `OVERLAP_REPLAY_IDEMPOTENT` PASS;
- `DELETE_DB_REBUILD_PASS` PASS.

### API/cache/fanout

- all eight required routes schema tests PASS;
- address/cursor/page bounds PASS;
- search separate rate limit PASS;
- `API_FRESHNESS_METADATA_PRESENT` PASS for every indexed endpoint;
- cache single-flight/invalidation-after-commit tests PASS;
- disconnect/dedupe/refetch semantic fixture PASS;
- first meaningful concurrent read/replay/cache/fanout test PASS.

### Reconciliation

- launch count/event identity check PASS;
- curve state check PASS;
- FeeEscrow custody/outstanding/projected ledger check PASS;
- graduation/locker state check PASS;
- deployment/code-hash check PASS where verified expected hashes exist;
- checkpoint continuity check PASS;
- explicit mismatch fixtures FAIL with useful reports;
- `RECONCILE_PASS` on the accepted integration fixture/environment.

### Regression

Every accepted Day-6 lane runs its focused tests plus affected shared/build/contract regressions. Final Day-6 head runs full repository CI. No Day-6 PASS exists while a prior accepted Day-1–Day-5 regression is red.

---

## 28. Required vertical wiring order

The implementation plan must preserve this dependency direction:

`actual Solidity interfaces/events`
→ `generated ABI registry`
→ `@bread/types + @bread/protocol-sdk`
→ `@bread/db schema/repositories`
→ `@bread/indexer journal + reducers`
→ `@bread/api read contract`
→ `Day-7 web consumers`

No lane may introduce a private replacement interface while waiting for another lane.

For a future consumer not yet implemented (Day-7 web), Day 6 must leave executable API/SDK fixtures/contract tests as the frozen handoff.

---

## 29. Explicit non-goals / prohibited shortcuts

Day 6 does **not**:

- change accepted Solidity financial behavior;
- add a server trade/claim/launch relay;
- add private-key custody;
- make PostgreSQL, Redis, the event journal, indexer or API a protocol authority;
- invent Arc mainnet addresses;
- invent canonical Arc DEX deployment addresses;
- freeze unresolved Bread production economics/admin addresses;
- claim exact current-live Pons source/runtime parity;
- claim Pons/Bread audit-clean status;
- index arbitrary external DEX state as current Bread price without a ratified source;
- expose PnL/average entry from incomplete transfer history assumptions;
- implement one chain subscription per browser;
- add asynchronous journal-to-projection workers;
- skip the written spec review gate;
- start production Day-6 code before the detailed writing-plans output is approved for execution by the workflow.

---

## 30. Resolved design questions / remaining gates

### Resolved by Source + accepted architecture + current contract inspection

- persistence architecture: transactional journal + synchronous projections;
- canonical journal/trade identity;
- deterministic event order;
- actual event sources and same-transaction buy correlation;
- launch snapshot enrichment from chain rather than contract-event redesign;
- Arc finality behavior: committed block is final, no guessed confirmation depth;
- integrity response to impossible checkpoint-hash drift;
- checkpoint transaction boundary;
- overlap replay semantics;
- package/schema ownership;
- FeeEscrow entitlement authority;
- holder derivation source;
- graduation phase source;
- API freshness shape and non-authority language;
- cache invalidation timing;
- realtime logical-channel/dedup/refetch semantics;
- deterministic feed order including explicit organic Trending algorithm;
- rebuild/reconciliation semantics;
- failure/degraded behavior;
- first Day-6 concurrency proof scope.

### Deliberately still external/release-gated, with no Day-6 guess

- `BREAD_PRODUCTION_ECONOMICS_CONFIG`;
- Arc mainnet manifest values;
- canonical Arc V4/V3 deployment activation;
- future live DEX price indexing source for graduated tokens;
- unresolved exact-current Pons parity claims;
- future Pons audit findings / Bread independent release review.

None of those external gates blocks Day-6 local/test implementation of the frozen SDK/indexer/API architecture.

---

## 31. Written-spec review gate

This file must be reviewed as the written Day-6 design before `superpowers:writing-plans` is invoked.

Required review questions:

1. Does any statement conflict with the uploaded Source Pack or accepted Day-1–Day-5 behavior?
2. Does any projection accidentally become financial authority?
3. Does any normalized event duplicate an existing onchain ledger/event meaning?
4. Are same-transaction buy/refund/opening-tax and graduation/fee-credit correlations deterministic under the actual contracts?
5. Is Arc finality handled without an invented confirmation model?
6. Are cache/realtime effects strictly post-commit and disposable?
7. Can delete-DB rebuild/reconciliation prove the whole application view from chain again?
8. Are Day-6 scale/backpressure requirements started now rather than deferred to Day 8?
9. Are unresolved production/mainnet values still explicit gates instead of placeholders/defaults?
10. Is the next implementation boundary small enough for RED -> GREEN lanes and continuous vertical wiring?

Only after this written spec passes the required user review may the writing-plans workflow produce the detailed implementation plan. Production Day-6 implementation remains blocked until that plan gate is complete.
