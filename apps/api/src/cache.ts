import { projectionCacheGenerationKey } from "../../../packages/types/src/index.js";

export type CacheRedisSetOptions = Readonly<{
  NX?: boolean;
  PX?: number;
}>;

export type CacheRedis = Readonly<{
  get: (key: string) => Promise<string | null>;
  set: (
    key: string,
    value: string,
    options?: CacheRedisSetOptions,
  ) => Promise<unknown>;
  incr: (key: string) => Promise<number>;
  eval: (
    script: string,
    input: Readonly<{ keys: readonly string[]; arguments: readonly string[] }>,
  ) => Promise<unknown>;
}>;

export type CacheReadResult<T> = Readonly<{
  value: T;
  cache: "HIT" | "MISS" | "BYPASS";
}>;

export class CacheUnavailableError extends Error {
  readonly code = "CACHE_UNAVAILABLE" as const;

  constructor(message: string) {
    super(message);
    this.name = "CacheUnavailableError";
  }
}

const MAX_CHANNEL_LENGTH = 256;
const MAX_KEY_LENGTH = 512;
const PAYLOAD_TTL_MS = 30_000;
const LOCK_TTL_MS = 2_000;
const WAIT_ATTEMPTS = 12;
const WAIT_BASE_MS = 8;
const WAIT_JITTER_MS = 6;
const RELEASE_LOCK_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

let lockSequence = 0;

function boundedPart(value: string, max: number, label: string): string {
  if (value.length === 0 || value.length > max)
    throw new Error(`${label} is empty or exceeds its bounded length`);
  return value;
}

function lockToken(): string {
  lockSequence += 1;
  return `${Date.now().toString(36)}:${lockSequence.toString(36)}:${Math.random().toString(36).slice(2)}`;
}

function sleepBounded(): Promise<void> {
  const jitter = Math.floor(Math.random() * (WAIT_JITTER_MS + 1));
  return new Promise((resolve) => setTimeout(resolve, WAIT_BASE_MS + jitter));
}

type RemoteWaitResult<T> =
  | Readonly<{ status: "HIT"; value: T }>
  | Readonly<{ status: "MISS" }>
  | Readonly<{ status: "UNAVAILABLE" }>;

export class BreadCache {
  private readonly inFlight = new Map<
    string,
    Promise<CacheReadResult<unknown>>
  >();

  constructor(
    private readonly input: Readonly<{
      redis: CacheRedis;
      schemaVersion: string;
    }>,
  ) {
    boundedPart(input.schemaVersion, 64, "cache schema version");
  }

  private generationKey(channel: string): string {
    return projectionCacheGenerationKey({
      schemaVersion: this.input.schemaVersion,
      channel: boundedPart(channel, MAX_CHANNEL_LENGTH, "cache channel"),
    });
  }

  private valueKey(channel: string, generation: string, key: string): string {
    return `bread:cache:${this.input.schemaVersion}:${channel}:g${generation}:${boundedPart(key, MAX_KEY_LENGTH, "cache key")}`;
  }

  private lockKey(cacheKey: string): string {
    return `bread:lock:${cacheKey.slice("bread:cache:".length)}`;
  }

  private async generation(channel: string): Promise<string | null> {
    try {
      return (await this.input.redis.get(this.generationKey(channel))) ?? "0";
    } catch {
      return null;
    }
  }

  private async singleFlight<T>(
    key: string,
    operation: () => Promise<CacheReadResult<T>>,
  ): Promise<CacheReadResult<T>> {
    const existing = this.inFlight.get(key) as
      Promise<CacheReadResult<T>> | undefined;
    if (existing) return existing;

    const promise = operation();
    this.inFlight.set(key, promise as Promise<CacheReadResult<unknown>>);
    try {
      return await promise;
    } finally {
      if (this.inFlight.get(key) === promise) this.inFlight.delete(key);
    }
  }

  private async readPayload<T>(cacheKey: string): Promise<RemoteWaitResult<T>> {
    try {
      const cached = await this.input.redis.get(cacheKey);
      if (cached === null) return { status: "MISS" };
      return { status: "HIT", value: JSON.parse(cached) as T };
    } catch {
      return { status: "UNAVAILABLE" };
    }
  }

  private async waitForRemoteFill<T>(
    cacheKey: string,
  ): Promise<RemoteWaitResult<T>> {
    for (let attempt = 0; attempt < WAIT_ATTEMPTS; attempt += 1) {
      await sleepBounded();
      const result = await this.readPayload<T>(cacheKey);
      if (result.status !== "MISS") return result;
    }
    return { status: "MISS" };
  }

  private async releaseLock(key: string, token: string): Promise<void> {
    try {
      await this.input.redis.eval(RELEASE_LOCK_SCRIPT, {
        keys: [key],
        arguments: [token],
      });
    } catch {
      // The lock has a bounded TTL. Release failure is cache degradation only
      // and cannot invalidate the authoritative DB result already obtained.
    }
  }

  private async distributedLoad<T>(
    input: Readonly<{
      cacheKey: string;
      load: () => Promise<T>;
    }>,
  ): Promise<CacheReadResult<T>> {
    const key = this.lockKey(input.cacheKey);
    const token = lockToken();
    let acquired: boolean;
    try {
      acquired =
        (await this.input.redis.set(key, token, {
          NX: true,
          PX: LOCK_TTL_MS,
        })) === "OK";
    } catch {
      return { value: await input.load(), cache: "BYPASS" };
    }

    if (!acquired) {
      const waited = await this.waitForRemoteFill<T>(input.cacheKey);
      if (waited.status === "HIT") return { value: waited.value, cache: "HIT" };
      if (waited.status === "UNAVAILABLE")
        return { value: await input.load(), cache: "BYPASS" };
      // The remote owner exceeded our bounded wait. Fall back to the DB-backed
      // loader; Task 9 adds the independent DB concurrency budget around reads.
      return { value: await input.load(), cache: "MISS" };
    }

    try {
      // Close the race between the initial miss and lock acquisition.
      const afterLock = await this.readPayload<T>(input.cacheKey);
      if (afterLock.status === "HIT")
        return { value: afterLock.value, cache: "HIT" };

      const value = await input.load();
      try {
        await this.input.redis.set(input.cacheKey, JSON.stringify(value), {
          PX: PAYLOAD_TTL_MS,
        });
      } catch {
        // Cache serialization/write failure cannot block the authoritative DB result.
      }
      return {
        value,
        cache: afterLock.status === "UNAVAILABLE" ? "BYPASS" : "MISS",
      };
    } finally {
      await this.releaseLock(key, token);
    }
  }

  async invalidate(
    channel: string,
  ): Promise<Readonly<{ status: "INVALIDATED"; generation: number }>> {
    try {
      const generation = await this.input.redis.incr(
        this.generationKey(channel),
      );
      return { status: "INVALIDATED", generation };
    } catch {
      throw new CacheUnavailableError(
        "Redis cache generation invalidation is unavailable",
      );
    }
  }

  async getOrLoad<T>(
    input: Readonly<{
      channel: string;
      key: string;
      load: () => Promise<T>;
    }>,
  ): Promise<CacheReadResult<T>> {
    const channel = boundedPart(
      input.channel,
      MAX_CHANNEL_LENGTH,
      "cache channel",
    );
    const boundedKey = boundedPart(input.key, MAX_KEY_LENGTH, "cache key");
    const generation = await this.generation(channel);
    if (generation === null) {
      const bypassKey = `bread:bypass:${this.input.schemaVersion}:${channel}:${boundedKey}`;
      return this.singleFlight(bypassKey, async () => ({
        value: await input.load(),
        cache: "BYPASS" as const,
      }));
    }

    const cacheKey = this.valueKey(channel, generation, boundedKey);
    const cached = await this.readPayload<T>(cacheKey);
    if (cached.status === "HIT") return { value: cached.value, cache: "HIT" };
    if (cached.status === "UNAVAILABLE") {
      return this.singleFlight(cacheKey, async () => ({
        value: await input.load(),
        cache: "BYPASS" as const,
      }));
    }

    return this.singleFlight(cacheKey, () =>
      this.distributedLoad({ cacheKey, load: input.load }),
    );
  }
}
