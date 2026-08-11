import { setTimeout as delay } from 'node:timers/promises';

import { createPublicClient, defineChain, http, type PublicClient } from 'viem';

import type { NetworkManifest } from '../../../../packages/config/src/index.js';
import type { LogClient, RpcLog } from '../discovery.js';

export type ArcRpcLimitKind = 'RATE_LIMIT' | 'REQUEST_LIMIT';

export class ArcLogReadBudgetExceededError extends Error {
  readonly code = 'ARC_LOG_READ_BUDGET_EXCEEDED' as const;

  constructor(readonly providerCause: unknown) {
    super('Arc log read exceeded its bounded RPC attempt budget', { cause: providerCause });
    this.name = 'ArcLogReadBudgetExceededError';
  }
}

type ProviderSafeLogOptions = Readonly<{
  maxRateLimitRetries?: number;
  baseBackoffMs?: number;
  maxSplitDepth?: number;
  maxRpcAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
}>;

function nonnegativeInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer`);
  return value;
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer`);
  return value;
}

function errorChain(error: unknown): readonly unknown[] {
  const chain: unknown[] = [];
  const seen = new Set<object>();
  let current = error;

  while (current && typeof current === 'object' && chain.length < 8 && !seen.has(current)) {
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
      return [candidate.name, candidate.message, candidate.shortMessage, candidate.details]
        .filter((value): value is string => typeof value === 'string');
    })
    .join(' ')
    .toLowerCase();
}

/**
 * Distinguish provider request-frequency throttling from an eth_getLogs request
 * shape/range limit. Viem wraps both under LimitExceededRpcError/-32005, so the
 * provider detail text must win when it explicitly says the request was rate
 * limited. This keeps Bread from multiplying traffic in response to throttling.
 */
export function classifyArcRpcLimitError(error: unknown): ArcRpcLimitKind | null {
  const text = errorText(error);
  if (/(rate[ -]?limit|too many requests|http 429|status 429)/i.test(text)) return 'RATE_LIMIT';

  const limited = errorChain(error).some((entry) => {
    const candidate = entry as Record<string, unknown>;
    return candidate.code === -32005 || candidate.name === 'LimitExceededRpcError';
  });
  if (limited || /request exceeds defined limit|request limit exceeded/i.test(text)) {
    return 'REQUEST_LIMIT';
  }

  return null;
}

function blockBounds(request: Readonly<Record<string, unknown>>): Readonly<{
  fromBlock: bigint;
  toBlock: bigint;
}> | null {
  const fromBlock = request.fromBlock;
  const toBlock = request.toBlock;
  if (typeof fromBlock !== 'bigint' || typeof toBlock !== 'bigint') return null;
  if (toBlock < fromBlock) throw new Error('Arc log request range end precedes start');
  return { fromBlock, toBlock };
}

/**
 * Provider-safe read adapter for Arc eth_getLogs.
 *
 * Bread's replay overlap is an integrity property and is never reduced to fit a
 * provider. Instead:
 * - explicit rate-limit responses retry the exact same logical request with a
 *   small bounded exponential backoff;
 * - request-size/shape limits split the exact logical block interval into
 *   contiguous halves and concatenate the results in block order;
 * - an overall attempt budget prevents an unhealthy provider from multiplying
 *   work without bound.
 *
 * discoverRange remains the owner of its two-pass identity discovery and final
 * canonical dedupe/order semantics.
 */
export function createArcProviderSafeLogClient(
  raw: LogClient,
  options: ProviderSafeLogOptions = {},
): LogClient {
  const maxRateLimitRetries = nonnegativeInteger(
    options.maxRateLimitRetries ?? 4,
    'maxRateLimitRetries',
  );
  const baseBackoffMs = positiveInteger(options.baseBackoffMs ?? 500, 'baseBackoffMs');
  const maxSplitDepth = nonnegativeInteger(options.maxSplitDepth ?? 8, 'maxSplitDepth');
  const maxRpcAttempts = positiveInteger(options.maxRpcAttempts ?? 32, 'maxRpcAttempts');
  const sleep = options.sleep ?? (async (ms: number) => delay(ms));

  return {
    getLogs: async (request) => {
      let attempts = 0;

      const read = async (
        currentRequest: Readonly<Record<string, unknown>>,
        rateLimitRetry: number,
        splitDepth: number,
      ): Promise<readonly RpcLog[]> => {
        if (attempts >= maxRpcAttempts) {
          throw new ArcLogReadBudgetExceededError(
            new Error(`attempt budget ${maxRpcAttempts} exhausted before next eth_getLogs call`),
          );
        }
        attempts += 1;

        try {
          return await raw.getLogs(currentRequest);
        } catch (error) {
          const kind = classifyArcRpcLimitError(error);
          if (kind === null) throw error;

          if (kind === 'RATE_LIMIT') {
            if (rateLimitRetry >= maxRateLimitRetries || attempts >= maxRpcAttempts) {
              if (attempts >= maxRpcAttempts) throw new ArcLogReadBudgetExceededError(error);
              throw error;
            }
            await sleep(baseBackoffMs * 2 ** rateLimitRetry);
            return read(currentRequest, rateLimitRetry + 1, splitDepth);
          }

          const bounds = blockBounds(currentRequest);
          if (
            bounds === null
            || bounds.fromBlock === bounds.toBlock
            || splitDepth >= maxSplitDepth
            || attempts >= maxRpcAttempts
          ) {
            if (attempts >= maxRpcAttempts) throw new ArcLogReadBudgetExceededError(error);
            throw error;
          }

          const midpoint = bounds.fromBlock + (bounds.toBlock - bounds.fromBlock) / 2n;
          const left = await read(
            { ...currentRequest, fromBlock: bounds.fromBlock, toBlock: midpoint },
            0,
            splitDepth + 1,
          );
          const right = await read(
            { ...currentRequest, fromBlock: midpoint + 1n, toBlock: bounds.toBlock },
            0,
            splitDepth + 1,
          );
          return [...left, ...right];
        }
      };

      return read(request, 0, 0);
    },
  };
}

/**
 * Read-only Arc Testnet client for the operator LAN environment.
 *
 * No account, signer, keystore or private key is ever attached: this client
 * only reads chain state. Wallet signing stays entirely on the operator's
 * physical device.
 */
export function createArcReadClient(network: NetworkManifest): PublicClient {
  if (network.chainId === null) throw new Error('canonical network manifest has no chainId');
  const rpcUrls = network.rpc;
  if (!Array.isArray(rpcUrls) || rpcUrls.length === 0) {
    throw new Error('canonical network manifest carries no RPC endpoint');
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

  return createPublicClient({ chain, transport: http(rpcUrls[0]) }) as PublicClient;
}

export function observeHeadBlock(client: PublicClient): () => Promise<bigint> {
  return async () => client.getBlockNumber();
}
