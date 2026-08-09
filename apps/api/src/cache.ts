export type CacheRedis = Readonly<{
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<unknown>;
  incr: (key: string) => Promise<number>;
}>;

export type CacheReadResult<T> = Readonly<{
  value: T;
  cache: 'HIT' | 'MISS' | 'BYPASS';
}>;

const MAX_CHANNEL_LENGTH = 256;
const MAX_KEY_LENGTH = 512;

function boundedPart(value: string, max: number, label: string): string {
  if (value.length === 0 || value.length > max) throw new Error(`${label} is empty or exceeds its bounded length`);
  return value;
}

export class BreadCache {
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(private readonly input: Readonly<{
    redis: CacheRedis;
    schemaVersion: string;
  }>) {
    boundedPart(input.schemaVersion, 64, 'cache schema version');
  }

  private generationKey(channel: string): string {
    return `bread:generation:${this.input.schemaVersion}:${boundedPart(channel, MAX_CHANNEL_LENGTH, 'cache channel')}`;
  }

  private valueKey(channel: string, generation: string, key: string): string {
    return `bread:cache:${this.input.schemaVersion}:${channel}:g${generation}:${boundedPart(key, MAX_KEY_LENGTH, 'cache key')}`;
  }

  private async generation(channel: string): Promise<string | null> {
    try {
      return (await this.input.redis.get(this.generationKey(channel))) ?? '0';
    } catch {
      return null;
    }
  }

  async invalidate(channel: string): Promise<Readonly<{ status: 'INVALIDATED' | 'UNAVAILABLE'; generation?: number }>> {
    try {
      const generation = await this.input.redis.incr(this.generationKey(channel));
      return { status: 'INVALIDATED', generation };
    } catch {
      return { status: 'UNAVAILABLE' };
    }
  }

  async getOrLoad<T>(input: Readonly<{
    channel: string;
    key: string;
    load: () => Promise<T>;
  }>): Promise<CacheReadResult<T>> {
    const channel = boundedPart(input.channel, MAX_CHANNEL_LENGTH, 'cache channel');
    const generation = await this.generation(channel);
    if (generation === null) {
      return { value: await input.load(), cache: 'BYPASS' };
    }

    const cacheKey = this.valueKey(channel, generation, input.key);
    try {
      const cached = await this.input.redis.get(cacheKey);
      if (cached !== null) return { value: JSON.parse(cached) as T, cache: 'HIT' };
    } catch {
      // Redis is an availability accelerator only. Fall through to the DB-backed loader.
    }

    const existing = this.inFlight.get(cacheKey) as Promise<T> | undefined;
    if (existing) return { value: await existing, cache: 'MISS' };

    const promise = input.load();
    this.inFlight.set(cacheKey, promise);
    try {
      const value = await promise;
      try {
        await this.input.redis.set(cacheKey, JSON.stringify(value));
      } catch {
        // A cache write failure cannot block the authoritative PostgreSQL read result.
      }
      return { value, cache: 'MISS' };
    } finally {
      if (this.inFlight.get(cacheKey) === promise) this.inFlight.delete(cacheKey);
    }
  }
}
