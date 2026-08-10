import {
  ACTIVE_TOKEN,
  ARC_TESTNET_CHAIN_ID,
  BUY_TX_HASH,
} from '../fixtures/constants';
import {
  expect,
  setWalletTransactionHashes,
  test,
  walletSnapshot,
} from '../fixtures/browser';

const STORAGE_KEY = 'bread:submitted-transactions:v1';

async function seedRecoverableBuy(page: import('@playwright/test').Page, status: 'SUBMITTED' | 'CONFIRMING' | 'UNKNOWN' = 'CONFIRMING') {
  await page.evaluate(
    ({ key, chainId, hash, tokenAddress, transactionStatus }) => {
      window.localStorage.setItem(
        key,
        JSON.stringify([
          {
            chainId,
            hash,
            action: 'BUY',
            tokenAddress,
            submittedAt: '2026-08-10T17:50:00.000Z',
            status: transactionStatus,
          },
        ]),
      );
    },
    {
      key: STORAGE_KEY,
      chainId: ARC_TESTNET_CHAIN_ID,
      hash: BUY_TX_HASH,
      tokenAddress: ACTIVE_TOKEN,
      transactionStatus: status,
    },
  );
}

test('pending Buy stays single-submit while confirmation remains unresolved', async ({
  page,
  rpcState,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Task 4 recovery proof is desktop.');

  await page.goto(`/token/${ACTIVE_TOKEN}`);
  const trade = page.getByRole('complementary', { name: 'Trade' });
  await trade.getByRole('button', { name: 'Connect wallet' }).click();
  await trade.getByLabel('Trade amount').fill('10');
  await trade.getByRole('button', { name: 'Review buy' }).click();

  rpcState.receiptMode = 'PENDING';
  await setWalletTransactionHashes(page, [BUY_TX_HASH]);
  await trade.getByRole('button', { name: 'Buy after reviewing current values' }).click();

  await expect(trade.getByRole('status')).toContainText('CONFIRMING');
  await expect(trade.getByRole('status')).toContainText(BUY_TX_HASH);
  await expect(trade.getByLabel('Trade amount')).toBeDisabled();
  await expect(trade.getByRole('tab', { name: 'Buy' })).toBeDisabled();
  await expect(trade.getByRole('tab', { name: 'Sell' })).toBeDisabled();
  expect((await walletSnapshot(page)).submittedTransactions).toHaveLength(1);
});

test('refresh restores a pending Buy and a later recovery pass confirms it without a second wallet write', async ({
  page,
  rpcState,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Task 4 recovery proof is desktop.');

  rpcState.receiptMode = 'PENDING';
  await page.goto(`/token/${ACTIVE_TOKEN}`);
  await seedRecoverableBuy(page);

  await page.reload();
  let trade = page.getByRole('complementary', { name: 'Trade' });
  await expect(trade.getByRole('status')).toContainText('CONFIRMING');
  await expect(trade.getByRole('status')).toContainText(BUY_TX_HASH);
  await expect(trade.getByLabel('Trade amount')).toBeDisabled();
  await expect(trade.getByRole('button', { name: 'Connect wallet' })).toBeDisabled();
  await expect(trade.getByRole('tab', { name: 'Buy' })).toBeDisabled();
  await expect(trade.getByRole('tab', { name: 'Sell' })).toBeDisabled();
  expect((await walletSnapshot(page)).submittedTransactions).toHaveLength(0);

  // Bread intentionally persists UNKNOWN/CONFIRMING for a later recovery pass;
  // a failed polling attempt is not kept alive forever. Model the later pass by
  // making the receipt available and reloading the app.
  rpcState.receiptMode = 'SUCCESS';
  await page.reload();
  trade = page.getByRole('complementary', { name: 'Trade' });
  await expect(trade.getByRole('status')).toContainText('CONFIRMED', { timeout: 15_000 });
  await expect(trade.getByRole('status')).toContainText(BUY_TX_HASH);
  expect((await walletSnapshot(page)).submittedTransactions).toHaveLength(0);
});

test('receipt transport failure surfaces Unknown and preserves the saved hash for later recovery', async ({
  page,
  rpcState,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Task 4 recovery proof is desktop.');

  rpcState.receiptMode = 'ERROR';
  await page.goto(`/token/${ACTIVE_TOKEN}`);
  await seedRecoverableBuy(page, 'UNKNOWN');

  await page.reload();
  const trade = page.getByRole('complementary', { name: 'Trade' });
  const status = trade.getByRole('status');
  await expect(status).toContainText('UNKNOWN', { timeout: 15_000 });
  await expect(status).toContainText('Confirmation is unknown. The transaction hash is saved for recovery.');
  await expect(status).toContainText(BUY_TX_HASH);
  await expect(trade.getByLabel('Trade amount')).toBeDisabled();
  expect((await walletSnapshot(page)).submittedTransactions).toHaveLength(0);
  expect(rpcState.unknownCalls.some((entry) => entry.includes('Deterministic receipt transport failure.'))).toBe(true);
});
