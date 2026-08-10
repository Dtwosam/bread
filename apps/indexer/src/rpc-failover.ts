import type { LogClient, RpcLog } from './discovery.js';

export class RpcProviderCapacityError extends Error {
  readonly code = 'RPC_PROVIDER_CAPACITY_EXCEEDED' as const;
  constructor(readonly provider: string) {
    super(`RPC provider ${provider} exceeded its bounded queue`);
    this.name = 'RpcProviderCapacityError';
  }
}

export class RpcProviderCircuitOpenError extends Error {
  readonly code = 'RPC_PROVIDER_CIRCUIT_OPEN' as const;
  constructor(readonly provider: string) {
    super(`RPC provider ${provider} circuit is open`);
    this.name = 'RpcProviderCircuitOpenError';
  }
}

export class RpcFailoverExhaustedError extends Error {
  readonly code = 'RPC_FAILOVER_EXHAUSTED' as const;
  constructor(readonly causes: readonly unknown[]) {
    super('all configured RPC providers were unavailable or saturated');
    this.name = 'RpcFailoverExhaustedError';
  }
}

type RpcProvider = Readonly<{
  name: string;
  client: LogClient;
}>;

type FailoverInput = Readonly<{
  providers: readonly RpcProvider[];
  maxConcurrentPerProvider: number;
  maxQueuedPerProvider: number;
  failureThreshold: number;
  cooldownMs: number;
  nowMs?: () => number;
  shouldFailover: (error: unknown) => boolean;
}>;

type Waiter = Readonly<{
  resolve: () => void;
}>;

class BoundedProviderGate {
  private active = 0;
  private readonly queue: Waiter[] = [];

  constructor(
    private readonly provider: string,
    private readonly maxConcurrent: number,
    private readonly maxQueued: number,
  ) {}

  private async acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active += 1;
      return;
    }
    if (this.queue.length >= this.maxQueued) throw new RpcProviderCapacityError(this.provider);
    await new Promise<void>((resolve) => this.queue.push({ resolve }));
    this.active += 1;
  }

  private release(): void {
    this.active -= 1;
    const waiter = this.queue.shift();
    waiter?.resolve();
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await operation();
    } finally {
      this.release();
    }
  }
}

class ProviderState {
  private failures = 0;
  private openUntilMs = 0;
  private halfOpenProbe = false;
  readonly gate: BoundedProviderGate;

  constructor(
    readonly provider: RpcProvider,
    maxConcurrent: number,
    maxQueued: number,
    private readonly failureThreshold: number,
    private readonly cooldownMs: number,
    private readonly nowMs: () => number,
  ) {
    this.gate = new BoundedProviderGate(provider.name, maxConcurrent, maxQueued);
  }

  async getLogs(
    request: Readonly<Record<string, unknown>>,
    shouldFailover: (error: unknown) => boolean,
  ): Promise<readonly RpcLog[]> {
    return this.gate.run(async () => {
      const now = this.nowMs();
      let probe = false;
      if (this.failures >= this.failureThreshold) {
        if (now < this.openUntilMs || this.halfOpenProbe) {
          throw new RpcProviderCircuitOpenError(this.provider.name);
        }
        this.halfOpenProbe = true;
        probe = true;
      }

      try {
        const logs = await this.provider.client.getLogs(request);
        this.failures = 0;
        this.openUntilMs = 0;
        return logs;
      } catch (error) {
        if (shouldFailover(error)) {
          this.failures += 1;
          if (this.failures >= this.failureThreshold) {
            this.openUntilMs = this.nowMs() + this.cooldownMs;
          }
        }
        throw error;
      } finally {
        if (probe) this.halfOpenProbe = false;
      }
    });
  }
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer`);
  return value;
}

function nonnegativeInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer`);
  return value;
}

/**
 * 06I RPC resilience boundary for indexer reads.
 *
 * This wrapper does not choose providers, URLs, retryable error classes, or
 * network authority. The validated runtime supplies ordered LogClients and a
 * retryability policy. Bread only owns bounded concurrency/queueing and the
 * circuit-break/failover mechanics so one failed provider cannot multiply work
 * without limit.
 */
export function createBoundedRpcFailoverLogClient(input: FailoverInput): LogClient {
  if (input.providers.length < 2) throw new Error('RPC failover requires at least two configured providers');
  const names = new Set<string>();
  for (const provider of input.providers) {
    if (provider.name.length === 0) throw new Error('RPC provider name must not be empty');
    if (names.has(provider.name)) throw new Error(`duplicate RPC provider name: ${provider.name}`);
    names.add(provider.name);
  }

  const maxConcurrent = positiveInteger(input.maxConcurrentPerProvider, 'maxConcurrentPerProvider');
  const maxQueued = nonnegativeInteger(input.maxQueuedPerProvider, 'maxQueuedPerProvider');
  const failureThreshold = positiveInteger(input.failureThreshold, 'failureThreshold');
  const cooldownMs = positiveInteger(input.cooldownMs, 'cooldownMs');
  const nowMs = input.nowMs ?? Date.now;
  const states = input.providers.map((provider) => new ProviderState(
    provider,
    maxConcurrent,
    maxQueued,
    failureThreshold,
    cooldownMs,
    nowMs,
  ));

  return {
    getLogs: async (request) => {
      const causes: unknown[] = [];
      for (const state of states) {
        try {
          return await state.getLogs(request, input.shouldFailover);
        } catch (error) {
          if (error instanceof RpcProviderCircuitOpenError || error instanceof RpcProviderCapacityError) {
            causes.push(error);
            continue;
          }
          if (!input.shouldFailover(error)) throw error;
          causes.push(error);
        }
      }
      throw new RpcFailoverExhaustedError(causes);
    },
  };
}
