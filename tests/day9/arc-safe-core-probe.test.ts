import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, 'scripts/day9/check-arc-safe-core.mjs');
const CHAIN_ID = 5_042_002;
const SAFE_L2 = '0x29fcB43b46531BcA003ddC8FCB67FFE91900C762';
const SAFE_PROXY_FACTORY = '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67';

type Scenario = Readonly<{
  chainId?: number;
  safeL2Code?: string;
  safeProxyFactoryCode?: string;
}>;

const present: Required<Scenario> = {
  chainId: CHAIN_ID,
  safeL2Code: '0x6001',
  safeProxyFactoryCode: '0x6002',
};

async function startRpc(overrides: Scenario = {}) {
  const scenario = { ...present, ...overrides };
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
      id: number;
      method: string;
      params: unknown[];
    };

    let result: string;
    if (payload.method === 'eth_chainId') {
      result = `0x${scenario.chainId.toString(16)}`;
    } else if (payload.method === 'eth_getCode') {
      const address = String(payload.params[0]).toLowerCase();
      if (address === SAFE_L2.toLowerCase()) result = scenario.safeL2Code;
      else if (address === SAFE_PROXY_FACTORY.toLowerCase()) result = scenario.safeProxyFactoryCode;
      else result = '0x';
    } else {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ jsonrpc: '2.0', id: payload.id, error: { code: -32601, message: 'method not found' } }));
      return;
    }

    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ jsonrpc: '2.0', id: payload.id, result }));
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('mock RPC did not expose a TCP address');

  return {
    url: `http://127.0.0.1:${address.port}`,
    async close() {
      server.close();
      await once(server, 'close');
    },
  };
}

async function runProbe(rpcUrl: string) {
  const child = spawn(process.execPath, [SCRIPT, '--rpc-url', rpcUrl], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += String(chunk); });
  child.stderr.on('data', (chunk) => { stderr += String(chunk); });
  const [status] = (await once(child, 'close')) as [number];
  return { status, stdout: stdout.trim(), stderr: stderr.trim() };
}

async function scenarioResult(overrides: Scenario = {}) {
  const rpc = await startRpc(overrides);
  try {
    return await runProbe(rpc.url);
  } finally {
    await rpc.close();
  }
}

describe('Day 9 Arc Testnet Safe core probe', () => {
  it('classifies deterministic Safe v1.4.1 core as ready when both contracts have runtime code', async () => {
    const result = await scenarioResult();
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      status: 'SAFE_CORE_PRESENT',
      chainId: CHAIN_ID,
      safeVersion: 'v1.4.1',
      safeL2: SAFE_L2.toLowerCase(),
      safeProxyFactory: SAFE_PROXY_FACTORY.toLowerCase(),
      safeL2CodeBytes: 2,
      safeProxyFactoryCodeBytes: 2,
      officialSafeServiceSupportClaim: false,
      nextAction: 'CREATE_2_OF_3_SAFE',
    });
  });

  it('classifies missing deterministic core as requiring an official custom-network Safe deployment', async () => {
    const result = await scenarioResult({ safeProxyFactoryCode: '0x' });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: 'SAFE_CORE_NOT_PRESENT',
      chainId: CHAIN_ID,
      safeVersion: 'v1.4.1',
      safeProxyFactoryCodeBytes: 0,
      officialSafeServiceSupportClaim: false,
      nextAction: 'DEPLOY_SAFE_CORE_VIA_OFFICIAL_CUSTOM_NETWORK_PATH',
    });
  });

  it('fails closed on the wrong chain', async () => {
    const result = await scenarioResult({ chainId: CHAIN_ID + 1 });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/chain id/i);
  });
});
