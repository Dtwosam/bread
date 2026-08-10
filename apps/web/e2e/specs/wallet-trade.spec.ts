import {
  ACTIVE_CURVE,
  ACTIVE_TOKEN,
  ARC_TESTNET_CHAIN_ID_HEX,
  BUY_TX_HASH,
  SELL_TX_HASH,
} from '../fixtures/constants';
import {
  expect,
  setWalletChainId,
  setWalletTransactionHashes,
  test,
  walletSnapshot,
} from '../fixtures/browser';

type SubmittedTransaction = Readonly<{ to?: unknown; value?: unknown }>;

function expectCanonicalCurveTarget(transaction: unknown) {
  const submitted = transaction as SubmittedTransaction;
  expect(typeof submitted.to).toBe('string');
  expect((submitted.to as string).toLowerCase()).toBe(ACTIVE_CURVE.toLowerCase());
  expect(submitted.value === undefined || submitted.value === '0x0' || submitted.value === '0x00').toBe(true);
}

test('wallet connect, wrong-network recovery, Buy and Sell use the canonical browser transaction path', async ({
  page,
  rpcState,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Task 4 transaction proof is desktop; Task 5 owns mobile execution.');

  await page.goto(`/token/${ACTIVE_TOKEN}`);
  await expect(page.getByRole('heading', { name: 'Bread Twin' })).toBeVisible();

  const trade = page.getByRole('complementary', { name: 'Trade' });
  await trade.getByRole('button', { name: 'Connect wallet' }).click();
  await expect(trade.getByRole('button', { name: 'Review buy' })).toBeVisible();
  expect((await walletSnapshot(page)).connected).toBe(true);

  await setWalletChainId(page, '0x1');
  const switchButton = trade.getByRole('button', { name: 'Switch wallet to Arc Testnet' });
  await expect(switchButton).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bread Twin' })).toBeVisible();
  await switchButton.click();
  await expect(trade.getByRole('button', { name: 'Review buy' })).toBeVisible();
  expect((await walletSnapshot(page)).chainIdHex).toBe(ARC_TESTNET_CHAIN_ID_HEX);

  await setWalletTransactionHashes(page, [BUY_TX_HASH]);
  await trade.getByLabel('Trade amount').fill('10');
  await trade.getByRole('button', { name: 'Review buy' }).click();

  const buyReview = trade.locator('dl.bread-trade-review');
  for (const label of [
    'Expected output',
    'Minimum output',
    'Base fee',
    'Creator tax',
    'Opening buy tax',
    'Price impact',
    'Slippage',
  ]) {
    await expect(buyReview.getByText(label, { exact: true })).toBeVisible();
  }
  await trade.getByRole('button', { name: 'Buy after reviewing current values' }).click();
  await expect(trade.getByRole('status')).toContainText('CONFIRMED');
  const afterBuy = await walletSnapshot(page);
  expect(afterBuy.submittedTransactions).toHaveLength(1);
  expectCanonicalCurveTarget(afterBuy.submittedTransactions[0]);

  await trade.getByRole('tab', { name: 'Sell' }).click();
  await setWalletTransactionHashes(page, [SELL_TX_HASH]);
  await trade.getByLabel('Trade amount').fill('1');
  await trade.getByRole('button', { name: 'Review sell' }).click();
  const sellReview = trade.locator('dl.bread-trade-review');
  await expect(sellReview.getByText('0.00% (sell unaffected)')).toBeVisible();
  await trade.getByRole('button', { name: 'Sell after reviewing current values' }).click();
  await expect(trade.getByRole('status')).toContainText('CONFIRMED');

  const snapshot = await walletSnapshot(page);
  expect(snapshot.submittedTransactions).toHaveLength(2);
  expectCanonicalCurveTarget(snapshot.submittedTransactions[1]);
  expect(rpcState.unknownCalls).toEqual([]);
});
