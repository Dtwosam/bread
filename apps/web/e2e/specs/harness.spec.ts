import { ARC_TESTNET_CHAIN_ID_HEX, ARC_TESTNET_RPC } from '../fixtures/constants';
import { expect, test, walletSnapshot } from '../fixtures/browser';

test('deterministic browser fixtures exercise the real app boundaries', async ({
  page,
  indexedApiState,
  rpcState,
}) => {
  await page.goto('/explore');

  await expect(page.getByRole('heading', { name: 'Explore' })).toBeVisible();
  await expect(page.getByText('Bread Twin').first()).toBeVisible();
  expect(indexedApiState.requests.some((request) => new URL(request).pathname === '/v1/feed')).toBe(true);

  const initialWallet = await walletSnapshot(page);
  expect(initialWallet.connected).toBe(false);
  expect(initialWallet.chainIdHex).toBe(ARC_TESTNET_CHAIN_ID_HEX);
  expect(initialWallet.requests.some((request) => request.method === 'eth_accounts')).toBe(true);

  const chainId = await page.evaluate(async () => {
    const provider = (window as typeof window & {
      ethereum?: { request(input: { method: string; params?: readonly unknown[] }): Promise<unknown> };
    }).ethereum;
    if (!provider) throw new Error('Injected wallet missing.');
    return provider.request({ method: 'eth_chainId' });
  });
  expect(chainId).toBe(ARC_TESTNET_CHAIN_ID_HEX);

  const rpcResponse = await page.evaluate(async (rpcUrl) => {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
    });
    return response.json();
  }, ARC_TESTNET_RPC);
  expect(rpcResponse).toMatchObject({ result: '0x3e8' });
  expect(rpcState.requests.some((request) => request.method === 'eth_blockNumber')).toBe(true);

  const unknownRpc = await page.evaluate(async (rpcUrl) => {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'bread_unknownMethod', params: [] }),
    });
    return response.json();
  }, ARC_TESTNET_RPC);
  expect(unknownRpc.error?.message).toContain('Unhandled RPC method bread_unknownMethod');
  expect(rpcState.unknownCalls.some((entry) => entry.includes('bread_unknownMethod'))).toBe(true);
});
