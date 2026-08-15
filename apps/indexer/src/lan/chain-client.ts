import { setTimeout as delay } from "node:timers/promises";

import { createPublicClient, defineChain, http, type PublicClient } from "viem";

import type { NetworkManifest } from "../../../../packages/config/src/index.js";
import type { LogClient, RpcLog } from "../discovery.js";

export type ArcRpcLimitKind = "RATE_LIMIT" | "REQUEST_LIMIT";

export class ArcLogReadBudgetExceededError extends Error {
  readonly code = "ARC_LOG_READ_BUDGET_EXCEEDED" as const;

  constructor(readonly providerCause: unknown) {
    super("Arc log read exceeded its bounded RPC attempt budget", {
      cause: providerCause,
    });
    this.name = "ArcLogReadBudgetExceededError";
  }
}

type ProviderSafeReadOptions = Readonly<{
  maxRateLimitRetries?: number;
  baseBackoffMs?: number;
  maxTransientRetries?: number;
  transientBackoffMs?: number;
  minimumIntervalMs?: number;
  maxSplitDepth?: number;
  maxRpcAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}>;

type ResolvedProviderSafeReadOptions = Readonly<{
  maxRateLimitRetries: number;
  baseBackoffMs: number;
  maxTransientRetries: number;
  transientBackoffMs: number;
  minimumIntervalMs: number;
  maxSplitDepth: number;
  maxRpcAttempts: number;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}>;

function nonnegativeInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0)
    throw new Error(`${label} must be a non-negative integer`);
  return value;
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1)
    throw new Error(`${label} must be a positive integer`);
  return value;
}

function resolveProviderSafeReadOptions(
  options: ProviderSafeReadOptions,
): ResolvedProviderSafeReadOptions {
  return {
    maxRateLimitRetries: nonnegativeInteger(
      options.maxRateLimitRetries ?? 4,
      "maxRateLimitRetries",
    ),
    // A bounded live Arc-Testnet diagnostic proved the same 512-block log
    // request succeeds when calls are spaced by three seconds. This remains a
    // retry cooldown only; it is not treated as a claimed throughput limit.
    baseBackoffMs: positiveInteger(
      options.baseBackoffMs ?? 3_000,
      "baseBackoffMs",
    ),
    // Transient transport failures retry the exact same logical read first.
    // If a bounded eth_getLogs timeout exhausts that retry budget, the log
    // reader may then split only the block interval. Generic fetch failures do
    // not become split-eligible and still fail closed after bounded retries.
    maxTransientRetries: nonnegativeInteger(
      options.maxTransientRetries ?? 2,
      "maxTransientRetries",
    ),
    transientBackoffMs: positiveInteger(
      options.transientBackoffMs ?? 1_000,
      "transientBackoffMs",
    ),
    // Arc does not publish a usable public-RPC request-rate ceiling. Serialize
    // reads and maintain a modest proactive gap so Bread does not create a
    // burst, while the bounded retry cooldown remains the fallback if Arc still
    // throttles. This is LAN acceptance tooling, not a production throughput
    // policy.
    minimumIntervalMs: nonnegativeInteger(
      options.minimumIntervalMs ?? 500,
      "minimumIntervalMs",
    ),
    maxSplitDepth: nonnegativeInteger(
      options.maxSplitDepth ?? 8,
      "maxSplitDepth",
    ),
    maxRpcAttempts: positiveInteger(
      options.maxRpcAttempts ?? 32,
      "maxRpcAttempts",
    ),
    sleep: options.sleep ?? (async (ms: number) => delay(ms)),
    now: options.now ?? Date.now,
  };
}

function errorChain(error: unknown): readonly unknown[] {
  const chain: unknown[] = [];
  const seen = new Set<object>();
  let current = error;

  while (
    current &&
    typeof current === "object" &&
    chain.length < 8 &&
    !seen.has(current)
  ) {
    seen.add(current);
    chain.push(current);
    current = (current as { cause?: unknown }).cause;
  }

  return chain;
}

function errorText(error: unknown): string {
  return errorChain(error)
    .flatMap((entry) => {
      const candidate = entry as Record<string, unknown>;
      return [
        candidate.name,
        candidate.message,
        candidate.shortMessage,
        candidate.details,
      ].filter((value): value is string => typeof value === "string");
    })
    .join(" ")
    .toLowerCase();
}

/**
 * Distinguish provider request-frequency throttling from an eth_getLogs request
 * shape/range limit. Viem can wrap both under LimitExceededRpcError/-32005, so
 * explicit provider rate-limit detail must win. Bread must never respond to
 * throttling by splitting one request into more requests.
 */
export function classifyArcRpcLimitError(
  error: unknown,
): ArcRpcLimitKind | null {
  const text = errorText(error);
  if (/(rate[ -]?limit|too many requests|http 429|status 429)/i.test(text))
    return "RATE_LIMIT";

  const limited = errorChain(error).some((entry) => {
    const candidate = entry as Record<string, unknown>;
    return (
      candidate.code === -32005 || candidate.name === "LimitExceededRpcError"
    );
  });
  if (
    limited ||
    /request exceeds defined limit|request limit exceeded/i.test(text)
  ) {
    return "REQUEST_LIMIT";
  }

  return null;
}

function isArcTransientTimeoutError(error: unknown): boolean {
  const text = errorText(error);
  return /(request took too long to respond|request timed out|timed out|timeout|timeouterror)/i.test(
    text,
  );
}

function isArcTransientTransportError(error: unknown): boolean {
  return (
    isArcTransientTimeoutError(error) || /fetch failed/i.test(errorText(error))
  );
}

function blockBounds(request: Readonly<Record<string, unknown>>): Readonly<{
  fromBlock: bigint;
  toBlock: bigint;
}> | null {
  const fromBlock = request.fromBlock;
  const toBlock = request.toBlock;
  if (typeof fromBlock !== "bigint" || typeof toBlock !== "bigint") return null;
  if (toBlock < fromBlock)
    throw new Error("Arc log request range end precedes start");
  return { fromBlock, toBlock };
}

/**
 * One provider-wide serialized read gate for the LAN indexer.
 *
 * The public Arc Testnet endpoint applies request-rate controls across methods,
 * not just eth_getLogs. Normalization can intentionally issue many readContract
 * calls concurrently, so protecting getLogs alone still allows a burst. This
 * gate serializes all read-only client calls, proactively spaces starts, and
 * owns the only provider retry loops used by the LAN runtime.
 */
class ArcRpcRateGate {
  private tail: Promise<void> = Promise.resolve();
  private lastStartedAtMs: number | null = null;

  constructor(private readonly options: ResolvedProviderSafeReadOptions) {}

  private async waitForPacingWindow(): Promise<void> {
    if (this.lastStartedAtMs !== null && this.options.minimumIntervalMs > 0) {
      const elapsed = this.options.now() - this.lastStartedAtMs;
      const waitMs = Math.max(0, this.options.minimumIntervalMs - elapsed);
      if (waitMs > 0) await this.options.sleep(waitMs);
    }
    this.lastStartedAtMs = this.options.now();
  }

  run<T>(operation: () => Promise<T>): Promise<T> {
    const execute = async (): Promise<T> => {
      let rateLimitRetries = 0;
      let transientRetries = 0;

      for (;;) {
        await this.waitForPacingWindow();
        try {
          return await operation();
        } catch (error) {
          if (classifyArcRpcLimitError(error) === "RATE_LIMIT") {
            if (rateLimitRetries >= this.options.maxRateLimitRetries)
              throw error;
            await this.options.sleep(
              this.options.baseBackoffMs * 2 ** rateLimitRetries,
            );
            rateLimitRetries += 1;
            continue;
          }

          if (isArcTransientTransportError(error)) {
            if (transientRetries >= this.options.maxTransientRetries)
              throw error;
            await this.options.sleep(
              this.options.transientBackoffMs * 2 ** transientRetries,
            );
            transientRetries += 1;
            continue;
          }

          throw error;
        }
      }
    };

    const result = this.tail.then(execute, execute);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

function createProviderSafeLogReader(
  raw: LogClient,
  gate: ArcRpcRateGate,
  options: ResolvedProviderSafeReadOptions,
): LogClient {
  return {
    getLogs: async (request) => {
      let attempts = 0;

      const read = async (
        currentRequest: Readonly<Record<string, unknown>>,
        splitDepth: number,
      ): Promise<readonly RpcLog[]> => {
        if (attempts >= options.maxRpcAttempts) {
          throw new ArcLogReadBudgetExceededError(
            new Error(
              `attempt budget ${options.maxRpcAttempts} exhausted before next eth_getLogs call`,
            ),
          );
        }
        attempts += 1;

        try {
          return await gate.run(() => raw.getLogs(currentRequest));
        } catch (error) {
          const kind = classifyArcRpcLimitError(error);
          const timeoutAfterRetries =
            kind === null && isArcTransientTimeoutError(error);
          if (kind !== "REQUEST_LIMIT" && !timeoutAfterRetries) throw error;

          const bounds = blockBounds(currentRequest);
          if (
            bounds === null ||
            bounds.fromBlock === bounds.toBlock ||
            splitDepth >= options.maxSplitDepth ||
            attempts >= options.maxRpcAttempts
          ) {
            if (attempts >= options.maxRpcAttempts)
              throw new ArcLogReadBudgetExceededError(error);
            throw error;
          }

          const midpoint =
            bounds.fromBlock + (bounds.toBlock - bounds.fromBlock) / 2n;
          const left = await read(
            {
              ...currentRequest,
              fromBlock: bounds.fromBlock,
              toBlock: midpoint,
            },
            splitDepth + 1,
          );
          const right = await read(
            {
              ...currentRequest,
              fromBlock: midpoint + 1n,
              toBlock: bounds.toBlock,
            },
            splitDepth + 1,
          );
          return [...left, ...right];
        }
      };

      return read(request, 0);
    },
  };
}

/**
 * Focused eth_getLogs adapter retained for tests and narrow callers. Provider
 * retries are serialized by the same gate model used by the full read client;
 * genuine request-shape limits and exhausted bounded timeouts may split an
 * exact logical block interval.
 */
export function createArcProviderSafeLogClient(
  raw: LogClient,
  options: ProviderSafeReadOptions = {},
): LogClient {
  const resolved = resolveProviderSafeReadOptions(options);
  const gate = new ArcRpcRateGate(resolved);
  return createProviderSafeLogReader(raw, gate, resolved);
}

/**
 * Wrap every read-only PublicClient method behind one serialized provider gate.
 *
 * A Proxy is used deliberately so normalization's readContract calls, replay's
 * getBlock calls, head observation and eth_getLogs all share the same throttle
 * state without duplicating a second chain-read interface. Method calls retain
 * the original viem client as `this`.
 */
export function createArcProviderSafeReadClient<T extends object>(
  raw: T,
  options: ProviderSafeReadOptions = {},
): T {
  const resolved = resolveProviderSafeReadOptions(options);
  const gate = new ArcRpcRateGate(resolved);
  const logReader = createProviderSafeLogReader(
    raw as unknown as LogClient,
    gate,
    resolved,
  );

  return new Proxy(raw, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") return value;

      if (property === "getLogs") {
        return (request: Readonly<Record<string, unknown>>) =>
          logReader.getLogs(request);
      }

      return (...args: readonly unknown[]) =>
        gate.run(() => Reflect.apply(value, target, args) as Promise<unknown>);
    },
  }) as T;
}

/**
 * Read-only Arc Testnet client for the operator LAN environment.
 *
 * No account, signer, keystore or private key is ever attached: this client
 * only reads chain state. Wallet signing stays entirely on the operator's
 * physical device. Viem transport retries are disabled here because the
 * provider-wide Bread gate above is the sole retry owner for this runtime.
 */
export function createArcReadClient(network: NetworkManifest): PublicClient {
  if (network.chainId === null)
    throw new Error("canonical network manifest has no chainId");
  const rpcUrls = network.rpc;
  if (!Array.isArray(rpcUrls) || rpcUrls.length === 0) {
    throw new Error("canonical network manifest carries no RPC endpoint");
  }

  const chain = defineChain({
    id: network.chainId,
    name: network.network,
    nativeCurrency: {
      name: network.nativeGasAsset,
      symbol: network.nativeGasAsset,
      decimals: network.nativePrecision,
    },
    rpcUrls: { default: { http: rpcUrls } },
    testnet: true,
  });

  return createPublicClient({
    chain,
    transport: http(rpcUrls[0], { retryCount: 0 }),
  }) as PublicClient;
}

export function observeHeadBlock(client: PublicClient): () => Promise<bigint> {
  return async () => client.getBlockNumber();
}
