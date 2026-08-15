import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const EXPECTED_CHAIN_ID = 5_042_002;
const SAFE_VERSION = 'v1.4.1';
const SAFE_L2 = '0x29fcB43b46531BcA003ddC8FCB67FFE91900C762';
const SAFE_PROXY_FACTORY = '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67';

function fail(message) {
  process.stderr.write(`day9-arc-safe-core: FAIL: ${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key?.startsWith('--')) fail(`unexpected argument ${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) fail(`missing value for ${key}`);
    result[key.slice(2)] = value;
    index += 1;
  }
  return result;
}

async function rpc(rpcUrl, method, params = []) {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!response.ok) fail(`${method} HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) fail(`${method}: ${JSON.stringify(body.error)}`);
  if (typeof body.result !== 'string') fail(`${method}: invalid result`);
  return body.result;
}

function codeBytes(code) {
  if (!/^0x[0-9a-fA-F]*$/.test(code) || code.length % 2 !== 0) fail('invalid runtime bytecode result');
  return (code.length - 2) / 2;
}

const args = parseArgs(process.argv.slice(2));
let rpcUrl = args['rpc-url'];
if (!rpcUrl) {
  const network = JSON.parse(readFileSync(resolve(process.cwd(), 'config/networks/arc-testnet.json'), 'utf8'));
  rpcUrl = network.rpc?.[0];
}
if (!rpcUrl) fail('Arc Testnet RPC URL is required');
try {
  new URL(rpcUrl);
} catch {
  fail('Arc Testnet RPC URL is invalid');
}

const chainIdHex = await rpc(rpcUrl, 'eth_chainId');
const chainId = Number(BigInt(chainIdHex));
if (chainId !== EXPECTED_CHAIN_ID) {
  fail(`chain id mismatch: expected ${EXPECTED_CHAIN_ID}, got ${chainId}`);
}

const [safeL2Code, safeProxyFactoryCode] = await Promise.all([
  rpc(rpcUrl, 'eth_getCode', [SAFE_L2, 'latest']),
  rpc(rpcUrl, 'eth_getCode', [SAFE_PROXY_FACTORY, 'latest']),
]);

const safeL2CodeBytes = codeBytes(safeL2Code);
const safeProxyFactoryCodeBytes = codeBytes(safeProxyFactoryCode);
const present = safeL2CodeBytes > 0 && safeProxyFactoryCodeBytes > 0;

process.stdout.write(`${JSON.stringify({
  status: present ? 'SAFE_CORE_PRESENT' : 'SAFE_CORE_NOT_PRESENT',
  chainId,
  safeVersion: SAFE_VERSION,
  safeL2: SAFE_L2.toLowerCase(),
  safeProxyFactory: SAFE_PROXY_FACTORY.toLowerCase(),
  safeL2CodeBytes,
  safeProxyFactoryCodeBytes,
  officialSafeServiceSupportClaim: false,
  nextAction: present
    ? 'CREATE_2_OF_3_SAFE'
    : 'DEPLOY_SAFE_CORE_VIA_OFFICIAL_CUSTOM_NETWORK_PATH',
}, null, 2)}\n`);
