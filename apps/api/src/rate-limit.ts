export type RateLimitPolicy = Readonly<{
  maxRequests: number;
  windowMs: number;
}>;

export type RateLimitRedis = Readonly<{
  incr: (key: string) => Promise<number>;
  pExpire: (key: string, milliseconds: number) => Promise<unknown>;
}>;

export type RateLimitResult = 'ALLOWED' | 'LIMITED' | 'UNAVAILABLE';

export class IsolatedRateLimiter {
  constructor(private readonly input: Readonly<{
    redis: RateLimitRedis;
    policies: Readonly<Record<'feed' | 'search', RateLimitPolicy>>;
    nowMs?: () => number;
  }>) {
    for (const policy of Object.values(input.policies)) {
      if (!Number.isInteger(policy.maxRequests) || policy.maxRequests < 1) throw new Error('rate-limit maxRequests must be positive');
      if (!Number.isInteger(policy.windowMs) || policy.windowMs < 1) throw new Error('rate-limit windowMs must be positive');
    }
  }

  async take(bucket: 'feed' | 'search', subject: string): Promise<RateLimitResult> {
    const policy = this.input.policies[bucket];
    const now = (this.input.nowMs ?? Date.now)();
    const window = Math.floor(now / policy.windowMs);
    const boundedSubject = subject.slice(0, 128);
    const key = `bread:rate:${bucket}:${window}:${boundedSubject}`;
    try {
      const count = await this.input.redis.incr(key);
      if (count === 1) await this.input.redis.pExpire(key, policy.windowMs + 1_000);
      return count > policy.maxRequests ? 'LIMITED' : 'ALLOWED';
    } catch {
      return 'UNAVAILABLE';
    }
  }
}
