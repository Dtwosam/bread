import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, 'scripts/day9/verify-v3-dex-candidate.mjs');
const CHAIN_ID = 5_042_002;
const USDC = '0x1111111111111111111111111111111111111111';
const FACTORY = '0x2222222222222222222222222222222222222222';
const POSITION_MANAGER = '0x3333333333333333333333333333333333333333';
const OTHER_FACTORY = '0x4444444444444444444444444444444444444444';
const FEE = 3000;

const DECIMALS_SELECTOR = '0x313ce567';
const POSITION_MANAGER_FACTORY_SELECTOR = '0xc45a0155';
const FEE_AMOUNT_TICK_SPACING_SELECTOR = '0x22afcccb';

function word(value: bigint | number): `0x${string}` {
  return `0x${BigInt(value).toString(16).padStart(64, '0')}`;
}

function addressWord(address: string): `0x${string}` {
  return `0x${address.slice(2).toLowerCase().padStart(64, '0')}`;
}

type Scenario = Readonly<{
  chainId?: number;
  usdcCode?: string;
  factoryCode?: string;
  positionManagerCode?: string;
  usdcDecimals?: number;
  positionManagerFactory?: string;
  tickSpacing?: number;
}>;

const compatible: Required<Scenario> = {
  chainId: CHAIN_ID,
  usdcCode: '0x6001',
  factoryCode: '0x6002',
  positionManagerCode: '0x6003',
  usdcDecimals: 6,
  positionManagerFactory: FACTORY,
  tickSpacing: 60,
};

async function startRpc(overrides: Scenario = {}) {
  const scenario = { ...compatible, ...overrides };
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
      if (address === USDC.toLowerCase()) result = scenario.usdcCode;
      else if (address === FACTORY.toLowerCase()) result = scenario.factoryCode;
      else if (address === POSITION_MANAGER.toLowerCase()) result = scenario.positionManagerCode;
      else result = '0x';
    } else if (payload.method === 'eth_call') {
      const call = payload.params[0] as { to: string; data: string };
      const to = call.to.toLowerCase();
      const data = call.data.toLowerCase();
      if (to === USDC.toLowerCase() && data === DECIMALS_SELECTOR) {
        result = word(scenario.usdcDecimals);
      } else if (to === POSITION_MANAGER.toLowerCase() && data === POSITION_MANAGER_FACTORY_SELECTOR) {
        result = addressWord(scenario.positionManagerFactory);
      } else if (
        to === FACTORY.toLowerCase() &&
        data.startsWith(FEE_AMOUNT_TICK_SPACING_SELECTOR) &&
        data === `${FEE_AMOUNT_TICK_SPACING_SELECTOR}${BigInt(FEE).toString(16).padStart(64, '0')}`
      ) {
        result = word(scenario.tickSpacing);
      } else {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ jsonrpc: '2.0', id: payload.id, error: { code: -32602, message: 'unexpected eth_call' } }));
        return;
      }
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

async function runValidator(rpcUrl: string) {
  const child = spawn(
    process.execPath,
    [
      SCRIPT,
      '--rpc-url',
      rpcUrl,
      '--chain-id',
      String(CHAIN_ID),
      '--usdc',
      USDC,
      '--factory',
      FACTORY,
      '--position-manager',
      POSITION_MANAGER,
      '--fee',
      String(FEE),
    ],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
  );

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
    return await runValidator(rpc.url);
  } finally {
    await rpc.close();
  }
}

describe('Day 9 portable V3 DEX candidate validation', () => {
  it('passes only a matching V3 dependency set and emits deterministic identity evidence', async () => {
    const result = await scenarioResult();
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      status: 'PASS',
      chainId: CHAIN_ID,
      usdc: USDC.toLowerCase(),
      factory: FACTORY.toLowerCase(),
      positionManager: POSITION_MANAGER.toLowerCase(),
      fee: FEE,
      tickSpacing: compatible.tickSpacing,
    });
  });

  it('rejects the wrong chain id', async () => {
    const result = await scenarioResult({ chainId: CHAIN_ID + 1 });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/chain id/i);
  });

  it('rejects a factory without runtime bytecode', async () => {
    const result = await scenarioResult({ factoryCode: '0x' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/factory.*code/i);
  });

  it('rejects a position manager without runtime bytecode', async () => {
    const result = await scenarioResult({ positionManagerCode: '0x' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/position manager.*code/i);
  });

  it('rejects a position manager wired to a different factory', async () => {
    const result = await scenarioResult({ positionManagerFactory: OTHER_FACTORY });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/position manager.*factory/i);
  });

  it('rejects a fee tier with zero tick spacing', async () => {
    const result = await scenarioResult({ tickSpacing: 0 });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/tick spacing/i);
  });

  it('rejects a quote token that is not 6-decimal ERC-20 USDC', async () => {
    const result = await scenarioResult({ usdcDecimals: 18 });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/6 decimals/i);
  });
});
