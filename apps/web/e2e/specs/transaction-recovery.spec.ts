import {
  ACTIVE_TOKEN,
  ARC_TESTNET_CHAIN_ID,
  BUY_TX_HASH,
} from '../fixtures/constants';
import {
  expect,
  test,
  walletSnapshot,
} from '../fixtures/browser';

const STORAGE_KEY = 'bread:submitted-transactions:v1';

test('refresh restores a pending Buy visibly and keeps duplicate submission locked', async ({
  page,
  rpcState,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Task 4 recovery proof is desktop.');

  rpcState.receiptMode = 'PENDING';
  await page.goto(`/token/${ACTIVE_TOKEN}`);
  await page.evaluate(
    ({ key, chainId, hash, tokenAddress }) => {
      window.localStorage.setItem(
        key,
        JSON.stringify([
          {
            chainId,
            hash,
            action: 'BUY',
            tokenAddress,
            submittedAt: '2026-08-10T17:50:00.000Z',
            status: 'CONFIRMING',
          },
        ]),
      );
    },
    {
      key: STORAGE_KEY,
      chainId: ARC_TESTNET_CHAIN_ID,
      hash: BUY_TX_HASH,
      tokenAddress: ACTIVE_TOKEN,
    },
  );

  await page.reload();
  const trade = page.getByRole('complementary', { name: 'Trade' });
  await expect(trade.getByRole('status')).toContainText('CONFIRMING');
  await expect(trade.getByRole('status')).toContainText(BUY_TX_HASH);

  await trade.getByRole('button', { name: 'Connect wallet' }).click();
  await expect(trade.getByLabel('Trade amount')).toBeDisabled();
  await expect(trade.getByRole('button', { name: 'Review buy' })).toBeDisabled();
  expect((await walletSnapshot(page)).submittedTransactions).toHaveLength(0);
});
