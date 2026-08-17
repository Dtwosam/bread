import { readFile } from 'node:fs/promises';

import { parseNetworkManifest, parseProtocolDeploymentManifest } from '@bread/config';
import {
  canonicalizeProtocolAddress,
  resolveProtocolContext,
  type PreparedBreadTransaction,
} from '@bread/protocol-sdk';
import type { Address } from '@bread/types';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Hash,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { runGraduationKeeperPass, type GraduationKeeperWallet } from './graduation-keeper.js';

type FeedPage = Readonly<{
  data: readonly Readonly<{ tokenAddress: string }>[];
  page?: Readonly<{ hasMore: boolean; nextCursor?: string }>;
}>;

const PRIVATE_KEY = /^0x[0-9a-fA-F]{64}$/;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function pollIntervalMs(): number {
  const raw = process.env.BREAD_GRADUATION_KEEPER_POLL_MS?.trim();
  if (!raw) return 15_000;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1_000 || value > 300_000) {
    throw new Error('BREAD_GRADUATION_KEEPER_POLL_MS must be an integer from 1000 to 300000');
  }
  return value;
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

async function loadCandidates(apiBaseUrl: string): Promise<readonly Address[]> {
  const candidates: Address[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;

  do {
    const url = new URL('/v1/feed', apiBaseUrl);
    url.searchParams.set('view', 'graduating');
    url.searchParams.set('lifecycle', 'processing');
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('cursor', cursor);

    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`graduation candidate feed returned HTTP ${response.status}`);
    const page = await response.json() as FeedPage;
    if (!Array.isArray(page.data)) throw new Error('graduation candidate feed returned malformed data');

    for (const item of page.data) {
      const tokenAddress = canonicalizeProtocolAddress(item.tokenAddress);
      if (seen.has(tokenAddress)) continue;
      seen.add(tokenAddress);
      candidates.push(tokenAddress);
    }
    cursor = page.page?.hasMore === true ? page.page.nextCursor : undefined;
    if (page.page?.hasMore === true && !cursor) {
      throw new Error('graduation candidate feed reported more pages without a cursor');
    }
  } while (cursor);

  return candidates;
}

async function main(): Promise<void> {
  const apiBaseUrl = requiredEnv('BREAD_API_BASE_URL');
  const networkManifestPath = requiredEnv('BREAD_NETWORK_MANIFEST_PATH');
  const deploymentManifestPath = requiredEnv('BREAD_DEPLOYMENT_MANIFEST_PATH');
  const stackVersion = requiredEnv('BREAD_STACK_VERSION');
  const privateKey = requiredEnv('BREAD_GRADUATION_KEEPER_PRIVATE_KEY');
  if (!PRIVATE_KEY.test(privateKey)) throw new Error('BREAD_GRADUATION_KEEPER_PRIVATE_KEY is malformed');

  const network = parseNetworkManifest(await readJson(networkManifestPath));
  const deployment = parseProtocolDeploymentManifest(await readJson(deploymentManifestPath));
  const context = resolveProtocolContext({ network, deployment, stackVersion });
  const rpcUrl = network.rpc[0];
  if (!rpcUrl) throw new Error('network manifest has no RPC endpoint');

  const chain = defineChain({
    id: context.chainId,
    name: network.network,
    nativeCurrency: {
      name: network.nativeGasAsset,
      symbol: network.nativeGasAsset,
      decimals: network.nativePrecision,
    },
    rpcUrls: { default: { http: network.rpc } },
    ...(network.explorer ? { blockExplorers: { default: { name: 'Explorer', url: network.explorer } } } : {}),
  });
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });
  const keeperWallet: GraduationKeeperWallet = {
    account: account.address.toLowerCase() as Address,
    sendPreparedTransaction: async (request: PreparedBreadTransaction): Promise<Hash> => walletClient.writeContract({
      address: request.to,
      abi: request.abi,
      functionName: request.functionName,
      args: request.args,
      value: request.value,
      account,
      chain,
    } as never),
  };

  const interval = pollIntervalMs();
  let stopped = false;
  const stop = () => { stopped = true; };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  console.info(JSON.stringify({
    service: 'bread-graduation-keeper',
    status: 'started',
    chainId: context.chainId,
    stackVersion: context.stackVersion,
    account: keeperWallet.account,
  }));

  while (!stopped) {
    try {
      const candidates = await loadCandidates(apiBaseUrl);
      const results = await runGraduationKeeperPass({
        client: publicClient,
        wallet: keeperWallet,
        context,
        candidates,
      });
      for (const result of results) {
        console.info(JSON.stringify({
          service: 'bread-graduation-keeper',
          tokenAddress: result.tokenAddress,
          status: result.status,
          stages: result.stages.map((stage) => stage.stage),
          ...(result.status === 'TERMINAL'
            ? { terminalStatus: result.terminalStatus }
            : { error: result.error }),
        }));
      }
    } catch (error) {
      console.error(JSON.stringify({
        service: 'bread-graduation-keeper',
        status: 'pass-failed',
        error: error instanceof Error ? error.message : 'unknown keeper failure',
      }));
    }

    if (!stopped) await new Promise((resolve) => setTimeout(resolve, interval));
  }

  console.info(JSON.stringify({ service: 'bread-graduation-keeper', status: 'stopped' }));
}

await main();
