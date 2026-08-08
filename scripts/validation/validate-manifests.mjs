import { readFile } from 'node:fs/promises';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const fail = (message) => { throw new Error(message); };

const testnet = await readJson('config/networks/arc-testnet.json');
if (testnet.chainId !== 5042002) fail('Arc testnet chainId mismatch');
if (testnet.usdc?.address?.toLowerCase() !== '0x3600000000000000000000000000000000000000') fail('Arc testnet USDC mismatch');
if (testnet.usdc?.decimals !== 6) fail('Bread quote USDC must use 6 decimals');
if (testnet.nativePrecision !== 18) fail('Arc native USDC precision must remain explicitly distinct');
if (!Array.isArray(testnet.rpc) || testnet.rpc.length < 1) fail('At least one Arc testnet RPC required');
if (!Array.isArray(testnet.websocket) || testnet.websocket.length < 1) fail('At least one Arc testnet WebSocket required');

const mainnet = await readJson('config/networks/arc-mainnet.json');
if (mainnet.status !== 'AWAITING_OFFICIAL_VALUES') fail('Mainnet must remain unresolved until official publication');
if (mainnet.chainId !== null || mainnet.usdc?.address !== null) fail('Do not guess Arc mainnet values');

console.log('manifest-validation: PASS');
