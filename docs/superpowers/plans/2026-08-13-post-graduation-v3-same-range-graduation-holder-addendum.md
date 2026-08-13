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

1. discover/normalize Bread logs for the full bounded range;
2. identify any canonical V3 graduation-completion candidate in those normalized Bread events;
3. using the launch's snapshotted adapter identity, resolve and verify the immutable V3 venue identity **before reducer construction**;
4. combine those verified same-range venue identities with already persisted graduated venue identities from prior ranges;
5. build each launch's protocol-address set including the verified V3 pool address;
6. construct reducers;
7. merge Bread canonical events with separately discovered V3 pool `Swap` events in canonical order;
8. atomically apply journal + projections + checkpoint;
9. when `GraduationCompleted` is reached by the graduation reducer, persist the already verified venue identity into rebuildable `launch_state` in that same DB transaction.

This keeps chain verification outside the DB transaction while keeping the derived venue projection atomic with the graduation event apply.

## Holder Consequence

The holder reducer must receive the verified same-range pool address before it processes the graduation transaction's token `Transfer` events.

That permits canonical event order to remain unchanged while ensuring permanent V3 liquidity custody is classified as protocol/venue custody rather than ordinary user holder balance.

Do **not** reorder token Transfer and GraduationCompleted events merely to make holder classification easier.

Do **not** perform a second holder correction transaction after commit if the correct verified venue identity was already available from the same canonical range.

## Failure Rule

If a range contains canonical V3 pool-created graduation evidence but immutable venue verification cannot complete or contradicts the snapshotted adapter / coordinator pool identity, fail closed before projection commit.

Do not:

- project the graduation while omitting the venue identity;
- classify the new pool as an ordinary holder and repair it later silently;
- use the current network's newest DEX manifest as a substitute for the launch snapshot;
- query mutable liquidity to decide canonical identity.

## RED Coverage Once Execution Returns

Add a focused same-range test proving:

- a launch-token Transfer to the V3 pool occurs earlier in canonical log order than `GraduationCompleted`;
- the verified pool is nevertheless already present in the holder reducer's protocol-address set;
- the resulting pool holder snapshot is marked/excluded as protocol custody on the first atomic apply;
- the same apply persists the verified V3 venue identity in `launch_state`;
- replay does not duplicate/correct the holder snapshot a second time;
- contradictory venue verification prevents the whole range from committing.

The test must preserve canonical log ordering. It must not solve the fixture by moving `GraduationCompleted` ahead of the Transfer.

## Unchanged Gate

This addendum does not authorize production implementation before the real repository RED gate opens. PR #93 remains draft/unmerged; no live BTST write, Day-9 PASS, RC tag or Day-10 start is authorized.
