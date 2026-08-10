import { CLAIM_TX_HASH, E2E_WALLET } from '../fixtures/constants';
import {
  expect,
  setWalletTransactionHashes,
  test,
  walletSnapshot,
} from '../fixtures/browser';

async function connectCreator(page: import('@playwright/test').Page) {
  await page.goto('/creator');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Connect wallet' }).click();
  await expect(main.getByRole('heading', { name: 'Creator revenue' })).toBeVisible();
  return main;
}

test('creator reviews authoritative FeeEscrow claimable value and confirms one USDC claim', async ({
  page,
  rpcState,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Task 4 claim proof is desktop.');

  const main = await connectCreator(page);
  await expect(main.getByRole('paragraph').filter({ hasText: E2E_WALLET })).toBeVisible();
  await expect(main.getByText('10 USDC', { exact: true }).first()).toBeVisible();

  await main.getByRole('button', { name: 'Review claim' }).click();
  const claimValues = main.locator('.bread-creator-claim-panel dl');
  await expect(claimValues.getByText('Claimable USDC', { exact: true })).toBeVisible();
  await expect(claimValues.getByText('10 USDC', { exact: true })).toBeVisible();
  await expect(claimValues.getByText('Recipient', { exact: true })).toBeVisible();
  await expect(claimValues.getByText(E2E_WALLET, { exact: true })).toBeVisible();

  await setWalletTransactionHashes(page, [CLAIM_TX_HASH]);
  await main.getByRole('button', { name: 'Claim USDC' }).click();
  await expect(main.getByRole('status')).toContainText('CONFIRMED');
  expect((await walletSnapshot(page)).submittedTransactions).toHaveLength(1);
  expect(rpcState.unknownCalls).toEqual([]);
});

test('zero authoritative claimable USDC never creates a wallet write', async ({ page, rpcState }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Task 4 claim proof is desktop.');

  rpcState.claimable = BigInt(0);
  const main = await connectCreator(page);
  await main.getByRole('button', { name: 'Review claim' }).click();
  await expect(main.locator('.bread-creator-claim-panel dl').getByText('0 USDC', { exact: true })).toBeVisible();
  await expect(main.getByRole('button', { name: 'Claim USDC' })).toBeDisabled();
  expect((await walletSnapshot(page)).submittedTransactions).toHaveLength(0);
});
