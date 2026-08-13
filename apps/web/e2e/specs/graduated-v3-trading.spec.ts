import {
  BUY_TX_HASH,
  GRADUATED_CURVE,
  GRADUATED_TOKEN,
} from '../fixtures/constants';
import {
  expect,
  setWalletTransactionHashes,
  test,
  walletSnapshot,
} from '../fixtures/browser';

const VERIFIED_V3_ROUTER = '0xA545bCB1Bd7985c59ea162aB1748A0803434C31b';
const ROUTER02_EXACT_INPUT_SINGLE_SELECTOR = '0x04e45aaf';

type SubmittedTransaction = Readonly<{
  to?: unknown;
  data?: unknown;
  value?: unknown;
}>;

function expectCanonicalV3Target(transaction: unknown) {
  const submitted = transaction as SubmittedTransaction;
  expect(typeof submitted.to).toBe('string');
  expect((submitted.to as string).toLowerCase()).toBe(VERIFIED_V3_ROUTER.toLowerCase());
  expect((submitted.to as string).toLowerCase()).not.toBe(GRADUATED_CURVE.toLowerCase());
  expect(typeof submitted.data).toBe('string');
  expect((submitted.data as string).toLowerCase()).toMatch(
    new RegExp(`^${ROUTER02_EXACT_INPUT_SINGLE_SELECTOR}`),
  );
  expect(submitted.value === undefined || submitted.value === '0x0' || submitted.value === '0x00').toBe(true);
}

test('graduated token reviews and submits exactly one canonical Router02 trade without reopening its curve', async ({
  page,
  rpcState,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Day 9 deterministic graduated trade proof is desktop Chromium.');

  await page.goto(`/token/${GRADUATED_TOKEN}`);
  await expect(page.getByRole('heading', { name: 'Graduated Bread' })).toBeVisible();

  const trade = page.getByRole('complementary', { name: 'Trade' });
  await trade.getByRole('button', { name: 'Connect wallet' }).click();
  await expect(trade.getByRole('button', { name: 'Review buy' })).toBeVisible();

  await setWalletTransactionHashes(page, [BUY_TX_HASH]);
  await trade.getByLabel('Trade amount').fill('10');
  await trade.getByRole('button', { name: 'Review buy' }).click();

  const review = trade.locator('dl.bread-trade-review');
  await expect(review.getByText('Expected output', { exact: true })).toBeVisible();
  await expect(review.getByText('Minimum output', { exact: true })).toBeVisible();
  await expect(review.getByText('V3 venue fee', { exact: true })).toBeVisible();
  await expect(review.getByText('Base fee', { exact: true })).toHaveCount(0);
  await expect(review.getByText('Creator tax', { exact: true })).toHaveCount(0);
  await expect(review.getByText('Opening buy tax', { exact: true })).toHaveCount(0);

  await trade.getByRole('button', { name: 'Buy after reviewing current values' }).click();
  await expect(trade.getByRole('status')).toContainText('CONFIRMED');

  const afterBuy = await walletSnapshot(page);
  expect(afterBuy.submittedTransactions).toHaveLength(1);
  expectCanonicalV3Target(afterBuy.submittedTransactions[0]);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Graduated Bread' })).toBeVisible();
  const afterReload = await walletSnapshot(page);
  expect(afterReload.submittedTransactions).toHaveLength(1);
  expectCanonicalV3Target(afterReload.submittedTransactions[0]);
  expect(rpcState.unknownCalls).toEqual([]);
});
