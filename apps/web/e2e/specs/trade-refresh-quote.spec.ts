import { decodeFunctionData, encodeFunctionResult, type Abi } from 'viem';

import { breadAbiRegistry } from '../../../../packages/protocol-sdk/src/abi/generated';
import {
  ACTIVE_CURVE,
  ACTIVE_TOKEN,
  ARC_TESTNET_RPC,
  BUY_TX_HASH,
} from '../fixtures/constants';
import {
  expect,
  setWalletTransactionHashes,
  test,
  walletSnapshot,
} from '../fixtures/browser';

type RpcRequest = Readonly<{
  id?: number | string | null;
  method?: string;
  params?: readonly unknown[];
}>;

function isRpcRequest(value: unknown): value is RpcRequest {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

test('changed final canonical trade review requires Refresh Quote before wallet signing', async ({
  page,
  rpcState,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Stale-quote signing proof is desktop Chromium.');

  await page.goto(`/token/${ACTIVE_TOKEN}`);
  const trade = page.getByRole('complementary', { name: 'Trade' });
  await trade.getByRole('button', { name: 'Connect wallet' }).click();
  await trade.getByLabel('Trade amount').fill('10');
  await trade.getByRole('button', { name: 'Review buy' }).click();

  const initialBuy = trade.getByRole('button', { name: 'Buy TWIN after reviewing current values' });
  await expect(initialBuy).toBeVisible();

  await page.route(`${ARC_TESTNET_RPC}**`, async (route) => {
    const payload: unknown = route.request().postDataJSON();
    if (!isRpcRequest(payload) || payload.method !== 'eth_call') {
      await route.fallback();
      return;
    }

    const call = (payload.params?.[0] ?? {}) as Readonly<{ to?: unknown; data?: unknown }>;
    if (
      typeof call.to !== 'string'
      || call.to.toLowerCase() !== ACTIVE_CURVE.toLowerCase()
      || typeof call.data !== 'string'
    ) {
      await route.fallback();
      return;
    }

    try {
      const decoded = decodeFunctionData({
        abi: breadAbiRegistry.curve as Abi,
        data: call.data as `0x${string}`,
      } as never) as Readonly<{ functionName: string }>;
      if (decoded.functionName !== 'getReserves') {
        await route.fallback();
        return;
      }

      const result = encodeFunctionResult({
        abi: breadAbiRegistry.curve as Abi,
        functionName: 'getReserves',
        result: [BigInt('530000000'), BigInt('680000000000000000000000000')],
      } as never);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ jsonrpc: '2.0', id: payload.id ?? null, result }),
      });
    } catch {
      await route.fallback();
    }
  });

  await initialBuy.click();
  await expect(trade.getByRole('button', { name: 'Refresh Quote' })).toBeVisible();
  await expect(trade.getByText('Trade values changed during the final canonical reread. Refresh quote before signing.')).toBeVisible();
  await expect(trade.locator('dl.bread-trade-review')).toHaveCount(0);
  expect((await walletSnapshot(page)).submittedTransactions).toHaveLength(0);

  await trade.getByRole('button', { name: 'Refresh Quote' }).click();
  const refreshedBuy = trade.getByRole('button', { name: 'Buy TWIN after reviewing current values' });
  await expect(refreshedBuy).toBeVisible();
  await expect(trade.locator('dl.bread-trade-review')).toBeVisible();

  await setWalletTransactionHashes(page, [BUY_TX_HASH]);
  await refreshedBuy.click();
  await expect(trade.getByRole('status')).toContainText('CONFIRMED');
  expect((await walletSnapshot(page)).submittedTransactions).toHaveLength(1);
  expect(rpcState.unknownCalls).toEqual([]);
});
