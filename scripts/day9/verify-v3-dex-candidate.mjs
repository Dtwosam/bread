const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const WORD_RE = /^0x[0-9a-fA-F]{64}$/;
const DECIMALS_SELECTOR = '0x313ce567';
const POSITION_MANAGER_FACTORY_SELECTOR = '0xc45a0155';
const FEE_AMOUNT_TICK_SPACING_SELECTOR = '0x22afcccb';
const MAX_UINT24 = 0xffffff;
const MAX_INT24 = 0x7fffff;

function fail(message) {
  console.error(`v3-dex-candidate: FAIL: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined || value.startsWith('--')) {
      fail('arguments must be provided as --name value pairs');
    }
    const name = key.slice(2);
    if (values.has(name)) fail(`duplicate argument --${name}`);
    values.set(name, value);
  }
  return values;
}

function required(args, name) {
  const value = args.get(name);
  if (value === undefined || value.trim() === '') fail(`--${name} is required`);
  return value.trim();
}

function parsePositiveInteger(value, label, maximum = Number.MAX_SAFE_INTEGER) {
  if (!/^\d+$/.test(value)) fail(`${label} must be a positive integer`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0 || number > maximum) {
    fail(`${label} must be a positive integer${Number.isFinite(maximum) ? ` <= ${maximum}` : ''}`);
  }
  return number;
}

function normalizeAddress(value, label) {
  if (!ADDRESS_RE.test(value)) fail(`${label} must be a 20-byte EVM address`);
  return value.toLowerCase();
}

function requireWord(value, label) {
  if (!WORD_RE.test(value)) fail(`${label} returned malformed ABI data`);
  return value.toLowerCase();
}

function decodeUintWord(value, label) {
  return BigInt(requireWord(value, label));
}

function decodeAddressWord(value, label) {
  const word = requireWord(value, label);
  const address = `0x${word.slice(-40)}`;
  return normalizeAddress(address, label);
}

function encodeUint24(value) {
  return BigInt(value).toString(16).padStart(64, '0');
}

async function rpc(rpcUrl, method, params, id) {
  let response;
  try {
    response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    });
  } catch (error) {
    fail(`RPC request failed for ${method}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) fail(`RPC HTTP ${response.status} for ${method}`);
  let body;
  try {
    body = await response.json();
  } catch {
    fail(`RPC returned non-JSON response for ${method}`);
  }
  if (body?.error) fail(`RPC ${method}: ${JSON.stringify(body.error)}`);
  if (!body || body.result === undefined) fail(`RPC ${method} returned no result`);
  return body.result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rpcUrl = required(args, 'rpc-url');
  try {
    const url = new URL(rpcUrl);
    if (!['http:', 'https:'].includes(url.protocol)) fail('--rpc-url must use http or https');
  } catch {
    fail('--rpc-url must be a valid URL');
  }

  const expectedChainId = parsePositiveInteger(required(args, 'chain-id'), 'chain id');
  const usdc = normalizeAddress(required(args, 'usdc'), 'USDC');
  const factory = normalizeAddress(required(args, 'factory'), 'Factory');
  const positionManager = normalizeAddress(required(args, 'position-manager'), 'Position Manager');
  const fee = parsePositiveInteger(required(args, 'fee'), 'fee', MAX_UINT24);

  let requestId = 1;
  const call = (method, params) => rpc(rpcUrl, method, params, requestId++);

  const actualChainId = Number(BigInt(await call('eth_chainId', [])));
  if (actualChainId !== expectedChainId) {
    fail(`chain id mismatch: expected ${expectedChainId}, got ${actualChainId}`);
  }

  for (const [label, address] of [
    ['USDC', usdc],
    ['Factory', factory],
    ['Position Manager', positionManager],
  ]) {
    const code = String(await call('eth_getCode', [address, 'latest']));
    if (!/^0x[0-9a-fA-F]*$/.test(code) || code === '0x' || code === '0x0') {
      fail(`${label} has no runtime code at ${address}`);
    }
  }

  const decimalsRaw = await call('eth_call', [{ to: usdc, data: DECIMALS_SELECTOR }, 'latest']);
  const decimals = decodeUintWord(String(decimalsRaw), 'USDC decimals');
  if (decimals !== 6n) fail(`USDC must report 6 decimals, got ${decimals}`);

  const positionManagerFactoryRaw = await call(
    'eth_call',
    [{ to: positionManager, data: POSITION_MANAGER_FACTORY_SELECTOR }, 'latest'],
  );
  const positionManagerFactory = decodeAddressWord(String(positionManagerFactoryRaw), 'Position Manager factory');
  if (positionManagerFactory !== factory) {
    fail(`Position Manager factory mismatch: expected ${factory}, got ${positionManagerFactory}`);
  }

  const tickSpacingRaw = await call(
    'eth_call',
    [{ to: factory, data: `${FEE_AMOUNT_TICK_SPACING_SELECTOR}${encodeUint24(fee)}` }, 'latest'],
  );
  const tickSpacingWord = decodeUintWord(String(tickSpacingRaw), 'fee tick spacing');
  if (tickSpacingWord === 0n || tickSpacingWord > BigInt(MAX_INT24)) {
    fail(`fee tick spacing must be positive int24, got ${tickSpacingWord}`);
  }
  const tickSpacing = Number(tickSpacingWord);

  console.log(JSON.stringify({
    status: 'PASS',
    chainId: actualChainId,
    usdc,
    factory,
    positionManager,
    fee,
    tickSpacing,
  }));
}

await main();
