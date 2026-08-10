import { describe, expect, it, vi } from 'vitest';

import {
  BoundedReadGate,
  ReadCapacityExceededError,
} from '../../apps/api/src/capacity';
import { BoundedRealtimeFanout } from '../../apps/indexer/src/fanout';

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

describe('Day 8 failure injection — bounded infrastructure owners', () => {
  it('rejects read work beyond active + queued capacity without unbounded accumulation', async () => {
    const gate = new BoundedReadGate({
      dbMaxActive: 1,
      dbMaxQueued: 1,
      dbQueueTimeoutMs: 1_000,
    });
    const hold = deferred<void>();
    const firstStarted = deferred<void>();
    const secondStarted = deferred<void>();

    const first = gate.run(async () => {
      firstStarted.resolve();
      await hold.promise;
      return 'first';
    });
    await firstStarted.promise;

    const second = gate.run(async () => {
      secondStarted.resolve();
      return 'second';
    });

    await vi.waitFor(() => {
      expect(gate.snapshot()).toMatchObject({ active: 1, queued: 1, maxActive: 1, maxQueued: 1 });
    });

    await expect(gate.run(async () => 'overflow')).rejects.toBeInstanceOf(ReadCapacityExceededError);
    expect(gate.snapshot()).toMatchObject({ active: 1, queued: 1 });

    hold.resolve();
    await expect(first).resolves.toBe('first');
    await secondStarted.promise;
    await expect(second).resolves.toBe('second');
    expect(gate.snapshot()).toMatchObject({ active: 0, queued: 0 });
  });

  it('expires a queued read under DB pressure and recovers capacity after the active request finishes', async () => {
    const gate = new BoundedReadGate({
      dbMaxActive: 1,
      dbMaxQueued: 1,
      dbQueueTimeoutMs: 20,
    });
    const hold = deferred<void>();
    const firstStarted = deferred<void>();

    const first = gate.run(async () => {
      firstStarted.resolve();
      await hold.promise;
    });
    await firstStarted.promise;

    await expect(gate.run(async () => 'timed-out')).rejects.toMatchObject({
      code: 'READ_CAPACITY_EXCEEDED',
      message: 'Bread read capacity queue timed out',
    });
    expect(gate.snapshot()).toMatchObject({ active: 1, queued: 0 });

    hold.resolve();
    await first;
    await expect(gate.run(async () => 'recovered')).resolves.toBe('recovered');
    expect(gate.snapshot()).toMatchObject({ active: 0, queued: 0 });
  });

  it('drops a slow realtime consumer at the pending-message cap instead of growing its queue', async () => {
    const fanout = new BoundedRealtimeFanout<{ channel: string; sequence: number }>({
      maxPendingPerSubscriber: 1,
      maxSubscribers: 4,
    });
    const release = deferred<void>();
    const handler = vi.fn(async () => {
      await release.promise;
    });

    fanout.subscribe('token:hot', handler);
    await fanout.publish({ channel: 'token:hot', sequence: 1 });
    expect(fanout.snapshot()).toMatchObject({
      subscribers: 1,
      slowConsumerDrops: 0,
      maxObservedPending: 1,
    });

    await fanout.publish({ channel: 'token:hot', sequence: 2 });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(fanout.snapshot()).toMatchObject({
      subscribers: 0,
      slowConsumerDrops: 1,
      maxObservedPending: 1,
    });

    release.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(fanout.snapshot()).toMatchObject({ subscribers: 0, slowConsumerDrops: 1 });
  });

  it('removes throwing realtime consumers and enforces the subscriber ceiling', async () => {
    const fanout = new BoundedRealtimeFanout<{ channel: string }>({
      maxPendingPerSubscriber: 2,
      maxSubscribers: 2,
    });

    fanout.subscribe('feed', async () => {
      throw new Error('consumer failed');
    });
    fanout.subscribe('feed', async () => undefined);
    expect(() => fanout.subscribe('feed', async () => undefined)).toThrow('fanout subscriber capacity exceeded');

    await fanout.publish({ channel: 'feed' });
    await Promise.resolve();
    await Promise.resolve();
    expect(fanout.snapshot().subscribers).toBeLessThanOrEqual(1);
  });
});
