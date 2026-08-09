export type ReadCapacityConfig = Readonly<{
  dbMaxActive: number;
  dbMaxQueued: number;
  dbQueueTimeoutMs: number;
}>;

export class ReadCapacityExceededError extends Error {
  readonly code = 'READ_CAPACITY_EXCEEDED' as const;

  constructor(message = 'Bread read capacity is temporarily saturated') {
    super(message);
    this.name = 'ReadCapacityExceededError';
  }
}

type Waiter = Readonly<{
  resolve: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}>;

export class BoundedReadGate {
  private active = 0;
  private readonly queue: Waiter[] = [];

  constructor(private readonly config: ReadCapacityConfig) {
    if (!Number.isInteger(config.dbMaxActive) || config.dbMaxActive < 1) throw new Error('dbMaxActive must be a positive integer');
    if (!Number.isInteger(config.dbMaxQueued) || config.dbMaxQueued < 0) throw new Error('dbMaxQueued must be a non-negative integer');
    if (!Number.isFinite(config.dbQueueTimeoutMs) || config.dbQueueTimeoutMs < 1) throw new Error('dbQueueTimeoutMs must be positive');
  }

  private async acquire(): Promise<void> {
    if (this.active < this.config.dbMaxActive) {
      this.active += 1;
      return;
    }
    if (this.queue.length >= this.config.dbMaxQueued) throw new ReadCapacityExceededError();

    await new Promise<void>((resolve, reject) => {
      const waiter = {} as Waiter;
      const timer = setTimeout(() => {
        const index = this.queue.indexOf(waiter);
        if (index >= 0) this.queue.splice(index, 1);
        reject(new ReadCapacityExceededError('Bread read capacity queue timed out'));
      }, this.config.dbQueueTimeoutMs);
      Object.assign(waiter, { resolve, reject, timer });
      this.queue.push(waiter);
    });
    this.active += 1;
  }

  private release(): void {
    this.active -= 1;
    const waiter = this.queue.shift();
    if (!waiter) return;
    clearTimeout(waiter.timer);
    waiter.resolve();
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await operation();
    } finally {
      this.release();
    }
  }

  snapshot(): Readonly<{ active: number; queued: number; maxActive: number; maxQueued: number }> {
    return {
      active: this.active,
      queued: this.queue.length,
      maxActive: this.config.dbMaxActive,
      maxQueued: this.config.dbMaxQueued,
    };
  }
}

export function boundRepository<T extends object>(repository: T, gate: BoundedReadGate): T {
  return new Proxy(repository, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver) as unknown;
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => gate.run(() => Promise.resolve(value.apply(target, args)));
    },
  });
}
