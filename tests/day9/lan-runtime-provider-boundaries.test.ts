import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  classifyArcRpcLimitError,
  createArcProviderSafeLogClient,
  createArcProviderSafeReadClient,
} from '../../apps/indexer/src/lan/chain-client.js';
import type { LogClient, RpcLog } from '../../apps/indexer/src/discovery.js';

const root = resolve(import.meta.dirname, '../..');

function limitError(details?: string): Error & { code: number; details?: string } {
  const error = new Error('Request exceeds defined limit.') as Error & {
    code: number;
    details?: string;
  };
  error.code = -32005;
  if (details) error.details = details;
  return error;
}

function logAt(blockNumber: bigint): RpcLog {
  const hex = blockNumber.toString(16).padStart(64, '0');
  return {
    address: '0xddf400f7a376fb8a962eee6d74c1ba37efa644f7',
    blockNumber,
    blockHash: `0x${hex}`,
    transactionHash: `0x${hex}`,
    transactionIndex: 0,
    logIndex: 0,
    topics: [],
    data: '0x',
  } as RpcLog;
}

describe('Day 9 LAN provider/runtime regressions', () => {
  it('classifies provider rate throttling before generic -32005 request limits', () => {
    expect(classifyArcRpcLimitError(limitError('rate limit exceeded'))).toBe('RATE_LIMIT');
    expect(classifyArcRpcLimitError(limitError())).toBe('REQUEST_LIMIT');
  });

  it('retries rate throttling without changing the 512-block logical range', async () => {
    const seen: Array<readonly [bigint, bigint]> = [];
    const delays: number[] = [];
    let attempts = 0;
    const raw: LogClient = {
      getLogs: async (request) => {
        const fromBlock = request.fromBlock as bigint;
        const toBlock = request.toBlock as bigint;
        seen.push([fromBlock, toBlock]);
        attempts += 1;
        if (attempts < 3) throw limitError('rate limit exceeded');
        return [logAt(fromBlock)];
      },
    };

    const client = createArcProviderSafeLogClient(raw, {
      maxRateLimitRetries: 3,
      baseBackoffMs: 10,
      maxRpcAttempts: 8,
      sleep: async (ms) => {
        delays.push(ms);
      },
    });

    const logs = await client.getLogs({ fromBlock: 100n, toBlock: 611n, address: [] });

    expect(logs).toHaveLength(1);
    expect(seen).toEqual([
      [100n, 611n],
      [100n, 611n],
      [100n, 611n],
    ]);
    expect(delays).toEqual([10, 20]);
  });

  it('splits only genuine request-size limited ranges into contiguous subranges', async () => {
    const successful: Array<readonly [bigint, bigint]> = [];
    const raw: LogClient = {
      getLogs: async (request) => {
        const fromBlock = request.fromBlock as bigint;
        const toBlock = request.toBlock as bigint;
        const span = toBlock - fromBlock + 1n;
        if (span > 128n) throw limitError();
        successful.push([fromBlock, toBlock]);
        return [logAt(fromBlock), logAt(toBlock)];
      },
    };

    const client = createArcProviderSafeLogClient(raw, {
      maxRateLimitRetries: 0,
      maxSplitDepth: 8,
      maxRpcAttempts: 32,
      sleep: async () => undefined,
    });

    const logs = await client.getLogs({ fromBlock: 1n, toBlock: 512n, address: [] });

    expect(successful).toEqual([
      [1n, 128n],
      [129n, 256n],
      [257n, 384n],
      [385n, 512n],
    ]);
    expect(logs.map((log) => log.blockNumber)).toEqual([
      1n,
      128n,
      129n,
      256n,
      257n,
      384n,
      385n,
      512n,
    ]);
  });

  it('serializes all Arc read methods behind one rate-limit retry owner', async () => {
    const delays: number[] = [];
    const order: string[] = [];
    let active = 0;
    let maxActive = 0;
    let blockAttempts = 0;

    const enter = async <T>(label: string, result: T, rateLimit = false): Promise<T> => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      order.push(`${label}:start`);
      await Promise.resolve();
      try {
        if (rateLimit) throw limitError('rate limit exceeded');
        order.push(`${label}:success`);
        return result;
      } finally {
        active -= 1;
      }
    };

    const raw = {
      getBlockNumber: async () => enter('head', 900n),
      getBlock: async () => {
        blockAttempts += 1;
        return enter('block', { hash: '0xabc', timestamp: 1n }, blockAttempts === 1);
      },
      readContract: async () => enter('contract', 'ok'),
      getLogs: async () => enter('logs', [] as readonly RpcLog[]),
    };

    const client = createArcProviderSafeReadClient(raw, {
      maxRateLimitRetries: 2,
      baseBackoffMs: 10,
      sleep: async (ms) => {
        delays.push(ms);
      },
    });

    const [head, block, contract] = await Promise.all([
      client.getBlockNumber(),
      client.getBlock(),
      client.readContract(),
    ]);

    expect(head).toBe(900n);
    expect(block.hash).toBe('0xabc');
    expect(contract).toBe('ok');
    expect(blockAttempts).toBe(2);
    expect(delays).toEqual([10]);
    expect(maxActive).toBe(1);
    expect(order).toEqual([
      'head:start',
      'head:success',
      'block:start',
      'block:start',
      'block:success',
      'contract:start',
      'contract:success',
    ]);
  });

  it('pins one retry owner and wires the full LAN read client through it', () => {
    const chainClient = readFileSync(
      resolve(root, 'apps/indexer/src/lan/chain-client.ts'),
      'utf8',
    );
    const runner = readFileSync(
      resolve(root, 'apps/indexer/src/lan/indexer-runner.ts'),
      'utf8',
    );

    expect(chainClient).toContain("http(rpcUrls[0], { retryCount: 0 })");
    expect(runner).toContain('createArcProviderSafeReadClient(rawClient)');
    expect(runner).not.toContain('createArcProviderSafeLogClient(client');
    expect(runner).toContain('discoverRange(\n        client as never,');
    expect(runner).toContain('client: client as never');
  });

  it('plain Node resolves the exact TypeScript helpers used by the operator orchestrator', () => {
    const orchestrator = readFileSync(
      resolve(root, 'scripts/day9/lan/run-lan-acceptance.mjs'),
      'utf8',
    );
    expect(orchestrator).toContain("import('./process-lifecycle.mts')");
    expect(orchestrator).toContain("import('./origin-proxy.mts')");
    expect(orchestrator).not.toContain("import('./process-lifecycle.mjs')");
    expect(orchestrator).not.toContain("import('./origin-proxy.mjs')");

    const lifecycle = pathToFileURL(resolve(root, 'scripts/day9/lan/process-lifecycle.mts')).href;
    const proxy = pathToFileURL(resolve(root, 'scripts/day9/lan/origin-proxy.mts')).href;
    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', `await import(${JSON.stringify(lifecycle)}); await import(${JSON.stringify(proxy)});`],
      { cwd: root, encoding: 'utf8' },
    );

    expect(result.status, result.stderr || result.stdout).toBe(0);
  });
});
