import { ACTIVE_TOKEN, BUY_TX_HASH } from '../fixtures/constants';
import {
  expect,
  setWalletTransactionHashes,
  test,
  walletSnapshot,
} from '../fixtures/browser';

test('alternate engine browse and wallet Buy smoke', async ({ page, rpcState }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('probe-'), 'Temporary alternate-engine probe only.');

  await page.goto('/explore');
  await expect(page.getByRole('heading', { name: 'Explore' })).toBeVisible();
  await expect(page.getByText('Bread Twin').first()).toBeVisible();
  expect(rpcState.requests).toEqual([]);

  await page.goto(`/token/${ACTIVE_TOKEN}`);
  const trade = page.getByRole('complementary', { name: 'Trade' });
  await trade.getByRole('button', { name: 'Connect wallet' }).click();
  await trade.getByLabel('Trade amount').fill('10');
  await trade.getByRole('button', { name: 'Review buy' }).click();
  await expect(trade.locator('dl.bread-trade-review').getByText('Minimum output', { exact: true })).toBeVisible();

  await setWalletTransactionHashes(page, [BUY_TX_HASH]);
  await trade.getByRole('button', { name: 'Buy BREAD after reviewing current values' }).click();
  await expect(trade.getByRole('status')).toContainText('CONFIRMED');
  expect((await walletSnapshot(page)).submittedTransactions).toHaveLength(1);
  expect(rpcState.unknownCalls).toEqual([]);
});
