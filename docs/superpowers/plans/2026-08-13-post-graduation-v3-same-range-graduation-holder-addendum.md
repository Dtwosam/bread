# Post-Graduation V3 Indexing — Same-Range Graduation / Holder Ordering Addendum

Date: 2026-08-13
Status: IMPLEMENTATION-PLAN ADDENDUM — NO PRODUCTION CHANGE
Applies to `docs/superpowers/plans/2026-08-13-post-graduation-v3-registry-cache-isolation-addendum.md`.

## Correction

A persisted graduated-venue registry is sufficient for later ranges, but it is **not sufficient by itself for the canonical graduation range that first creates the V3 pool**.

Current `applyRange()` constructs `launchProtocolAddresses` and the holder reducer **before** `IndexerRepository.applyCanonicalRange()` executes projection reducers. The graduation transaction may transfer launch tokens into the new V3 pool before the coordinator emits/projects `GraduationCompleted`.

Therefore waiting for the graduation reducer to persist the new venue address before holder classification would be too late for an earlier same-transaction token `Transfer` to the pool.

## Required Same-Range Resolution Order

For a canonical range containing a V3 pool-created graduation:

1. perform the existing bounded Bread two-pass discovery for the full requested range;
2. normalize those Bread logs;
3. identify any canonical V3 graduation-completion candidate in the normalized Bread events;
4. using the launch's snapshotted adapter identity, resolve and verify the immutable V3 venue identity **before reducer construction**;
5. combine those verified same-range venue identities with already persisted graduated venue identities from prior ranges;
6. perform a bounded V3 venue-log discovery against only those exact verified pool addresses;
7. for every pool whose completion position is inside the requested range, start no earlier than its completion block and filter by strict canonical ordering after its own `(blockNumber, transactionIndex, logIndex)` completion position;
8. build each launch's protocol-address set including the verified V3 pool address;
9. construct reducers;
10. merge Bread canonical events with separately normalized V3 pool `Swap` events and sort the combined set by canonical `(blockNumber, transactionIndex, logIndex)` order;
11. atomically apply journal + projections + checkpoint;
12. when `GraduationCompleted` is reached by the graduation reducer, persist the already verified venue identity into rebuildable `launch_state` in that same DB transaction.

This keeps chain verification outside the DB transaction while keeping the derived venue projection atomic with the graduation event apply.

## Discovery Ownership

The existing `discoverRange()` remains the bounded Bread-contract discovery owner. Its current two passes are needed to recover token/curve logs that can occur before `LaunchCreated` in the same transaction.

Do not widen that Bread decoder into a chain-wide DEX scanner and do not force external V3 pool logs through `decodeBreadLog()`.

Instead, add a dedicated post-Bread V3 discovery helper that consumes only:

- persisted verified graduated venue identities for the selected `chainId + stackVersion + factoryAddress`;
- newly verified V3 completion identities found in the current normalized Bread range;
- the same provider-safe RPC client and existing 64-address chunk bound.

That helper may query only exact verified pool addresses and the canonical V3 `Swap` event. It must not enumerate arbitrary V3 pools, consult a DEX API as truth, or use current Router/Quoter periphery to decide historical venue identity.

### Same-block recovery

A newly created pool may receive a valid `Swap` later in the same block after Bread's completion event. Because the exact pool is not known during the initial Bread discovery call, the post-normalization V3 stage must query the completion block again for that verified pool and then filter out every log at or before the launch's own completion position.

Do not advance the lower bound to `completionBlock + 1`; that would lose valid same-block post-completion swaps.

### Replay-overlap activation rule

Whether a venue identity came from the persisted registry or was discovered in the current normalization pass does **not** decide its log-query lower bound.

Bread replay intentionally loads bounded overlap before the committed checkpoint. A pool can therefore already exist in `launch_state` while the requested overlap range begins before that pool's own graduation completion.

For each verified pool independently:

- if `graduationCompletedBlock < fromBlock`, the pool was already active for the whole requested range and may be queried from `fromBlock`;
- if `graduationCompletedBlock > toBlock`, it is not active in the requested range and must not be queried;
- if `fromBlock <= graduationCompletedBlock <= toBlock`, query beginning at `graduationCompletedBlock` and retain only logs canonically after the recorded completion transaction/log position.

This rule applies equally to persisted and newly verified venue entries. Do not treat “persisted” as synonymous with “active before replay start.”

## Holder Consequence

The holder reducer must receive the verified same-range pool address before it processes the graduation transaction's token `Transfer` events.

That permits canonical event order to remain unchanged while ensuring permanent V3 liquidity custody is classified as protocol/venue custody rather than ordinary user holder balance.

Do **not** reorder token Transfer and GraduationCompleted events merely to make holder classification easier.

Do **not** perform a second holder correction transaction after commit if the correct verified venue identity was already available from the same canonical range.

## Bounded Transaction / Block Reads

V3 user attribution uses transaction `from`, not the pool event's `sender`. Avoid one RPC transaction read per Swap when a transaction contains more than one relevant pool event.

Within one bounded range normalization:

- cache `getTransaction` results by transaction hash;
- require the returned transaction hash to equal the Swap transaction hash;
- require the returned transaction block number to equal the Swap block number when the provider supplies a canonical mined transaction;
- validate/canonicalize the returned `from` address before using it as actor evidence;
- cache block timestamp reads by block number when the required timestamp is not already available;
- reuse those immutable range-local facts across all V3 Swap events in that transaction/block;
- keep all underlying RPC calls behind the existing provider-safe pacing/retry owner.

A contradictory transaction response fails the affected range before DB commit. This is an in-memory range-local optimization/validation path only; it is not another persistence layer or authority.

## Failure Rule

If a range contains canonical V3 pool-created graduation evidence but immutable venue verification cannot complete or contradicts the snapshotted adapter / coordinator pool identity, fail closed before projection commit.

Do not:

- project the graduation while omitting the venue identity;
- classify the new pool as an ordinary holder and repair it later silently;
- use the current network's newest DEX manifest as a substitute for the launch snapshot;
- query mutable liquidity to decide canonical identity;
- silently skip V3 Swap discovery merely because the pool first became known inside the requested range;
- accept a transaction `from` from a provider response whose transaction/block identity contradicts the Swap log.

## RED Coverage Once Execution Returns

Add focused same-range tests proving:

- a launch-token Transfer to the V3 pool occurs earlier in canonical log order than `GraduationCompleted`;
- the verified pool is nevertheless already present in the holder reducer's protocol-address set;
- the resulting pool holder snapshot is marked/excluded as protocol custody on the first atomic apply;
- the same apply persists the verified V3 venue identity in `launch_state`;
- a V3 `Swap` later in the same block after `GraduationCompleted` is discovered and indexed;
- a pool log earlier than or equal to the completion position is rejected from Bread post-graduation market projections;
- a persisted pool whose replay overlap begins before its completion block is still filtered by its own completion position;
- multiple relevant Swap logs sharing one transaction cause one bounded transaction-identity read rather than one read per Swap;
- a contradictory transaction hash/block response fails before projection;
- replay does not duplicate/correct the holder snapshot or Swap projection a second time;
- contradictory venue verification prevents the whole range from committing.

The test must preserve canonical log ordering. It must not solve the fixture by moving `GraduationCompleted` ahead of the Transfer or by starting V3 discovery at the next block.

## Unchanged Gate

This addendum does not authorize production implementation before the real repository RED gate opens. PR #93 remains draft/unmerged; no live BTST write, Day-9 PASS, RC tag or Day-10 start is authorized.
