import type { Locator } from '@playwright/test';

import {
  BUY_TX_HASH,
  GRADUATED_CURVE,
  GRADUATED_TOKEN,
  SELL_TX_HASH,
  V3_ROUTER,
} from '../fixtures/constants';
import {
  expect,
  setWalletTransactionHashes,
  test,
  walletSnapshot,
} from '../fixtures/browser';

const ROUTER02_EXACT_INPUT_SINGLE_SELECTOR = '0x04e45aaf';

type SubmittedTransaction = Readonly<{
  to?: unknown;
  data?: unknown;
  value?: unknown;
}>;

function expectCanonicalV3Target(transaction: unknown) {
  const submitted = transaction as SubmittedTransaction;
  expect(typeof submitted.to).toBe('string');
  expect((submitted.to as string).toLowerCase()).toBe(V3_ROUTER.toLowerCase());
  expect((submitted.to as string).toLowerCase()).not.toBe(GRADUATED_CURVE.toLowerCase());
  expect(typeof submitted.data).toBe('string');
  expect((submitted.data as string).toLowerCase()).toMatch(
    new RegExp(`^${ROUTER02_EXACT_INPUT_SINGLE_SELECTOR}`),
  );
  expect(submitted.value === undefined || submitted.value === '0x0' || submitted.value === '0x00').toBe(true);
}

async function expectV3Review(trade: Locator) {
  const review = trade.locator('dl.bread-trade-review');
  await expect(review.getByText('Expected output', { exact: true })).toBeVisible();
  await expect(review.getByText('Minimum output', { exact: true })).toBeVisible();
  await expect(review.getByText('V3 venue fee', { exact: true })).toBeVisible();
  await expect(review.getByText('Base fee', { exact: true })).toHaveCount(0);
  await expect(review.getByText('Creator tax', { exact: true })).toHaveCount(0);
  await expect(review.getByText('Opening buy tax', { exact: true })).toHaveCount(0);
}

test('graduated token buys and sells through Router02 without reopening its curve or rebroadcasting after reload', async ({
  page,
  rpcState,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Day 9 deterministic graduated trade proof is desktop Chromium.');

  await page.goto(`/token/${GRADUATED_TOKEN}`);
  await expect(page.getByRole('heading', { name: 'Bread Locked' })).toBeVisible();

  const trade = page.getByRole('complementary', { name: 'Trade' });
  await trade.getByRole('button', { name: 'Connect wallet' }).click();
  await expect(trade.getByRole('button', { name: 'Review buy' })).toBeVisible();

  await setWalletTransactionHashes(page, [BUY_TX_HASH, SELL_TX_HASH]);

  await trade.getByLabel('Trade amount').fill('10');
  await trade.getByRole('button', { name: 'Review buy' }).click();
  await expectV3Review(trade);
  await trade.getByRole('button', { name: 'Buy after reviewing current values' }).click();
  await expect(trade.getByRole('status')).toContainText('CONFIRMED');

  let wallet = await walletSnapshot(page);
  expect(wallet.submittedTransactions).toHaveLength(1);
  expectCanonicalV3Target(wallet.submittedTransactions[0]);

  await trade.getByRole('tab', { name: 'Sell' }).click();
  await trade.getByLabel('Trade amount').fill('1');
  await trade.getByRole('button', { name: 'Review sell' }).click();
  await expectV3Review(trade);
  await trade.getByRole('button', { name: 'Sell after reviewing current values' }).click();
  await expect(trade.getByRole('status')).toContainText('CONFIRMED');

  wallet = await walletSnapshot(page);
  expect(wallet.submittedTransactions).toHaveLength(2);
  for (const transaction of wallet.submittedTransactions) expectCanonicalV3Target(transaction);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Bread Locked' })).toBeVisible();
  const afterReload = await walletSnapshot(page);
  expect(afterReload.submittedTransactions).toHaveLength(0);
  expect(rpcState.unknownCalls).toEqual([]);
});
