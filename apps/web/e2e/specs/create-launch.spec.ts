import { E2E_FACTORY, LAUNCH_TX_HASH, NEW_LAUNCH_TOKEN } from '../fixtures/constants';
import {
  expect,
  setWalletTransactionHashes,
  test,
  walletSnapshot,
} from '../fixtures/browser';

async function connectAndFillCreateForm(page: import('@playwright/test').Page, initialBuy = '') {
  await page.goto('/create');
  const main = page.getByRole('main');
  await expect(main.getByText('Canonical launch deployment loaded.')).toBeVisible();
  await main.getByRole('button', { name: 'Connect wallet' }).click();
  await expect(main.getByRole('button', { name: 'Connect wallet' })).toHaveCount(0);

  await main.getByLabel('Name').fill(initialBuy ? 'Atomic Bread' : 'Plain Bread');
  await main.getByLabel('Ticker').fill(initialBuy ? 'ATOM' : 'PLAIN');
  await main.getByLabel('Description').fill('Deterministic Task 10 Playwright launch.');
  await main.getByLabel('Website').fill('https://example.com/bread');
  if (initialBuy) await main.getByLabel('Initial buy').fill(initialBuy);
  await main.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(main.getByRole('heading', { name: 'Economics' })).toBeVisible();
  await main.getByLabel('Creator tax').fill('1.25');
  await main.getByRole('button', { name: 'Review' }).click();
  await expect(main.getByRole('heading', { name: 'Review launch' })).toBeVisible();
  return main;
}

for (const scenario of [
  { name: 'launch-only', initialBuy: '', finalAction: 'Launch', successName: 'Plain Bread' },
  { name: 'atomic launch-and-buy', initialBuy: '10', finalAction: 'Launch & Buy', successName: 'Atomic Bread' },
] as const) {
  test(`Create ${scenario.name} reviews canonical values and confirms from LaunchCreated`, async ({
    page,
    rpcState,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Task 4 launch proof is desktop; Task 5 owns mobile trade execution.');

    const main = await connectAndFillCreateForm(page, scenario.initialBuy);
    const primaryReview = main.locator('section.bread-launch-review > dl.bread-launch-review__values');
    for (const label of [
      'Fixed supply',
      'Quote currency',
      'Creator tax',
      'Buyback',
      'Initial buy',
      'Launch fee',
      'Graduation target',
      'Creator revenue wallet',
      'Permanent liquidity lock',
    ]) {
      await expect(primaryReview.getByText(label, { exact: true })).toBeVisible();
    }

    if (scenario.initialBuy) {
      const buyDetails = main.locator('section.bread-launch-review__initial-buy');
      await expect(buyDetails.getByRole('heading', { name: 'Launch & Buy details' })).toBeVisible();
      for (const label of ['Expected output', 'Minimum output', 'Base fee', 'Creator tax', 'Opening buy tax', 'Price impact', 'Slippage']) {
        await expect(buyDetails.getByText(label, { exact: true })).toBeVisible();
      }
    }

    await setWalletTransactionHashes(page, [LAUNCH_TX_HASH]);
    await main.getByRole('button', { name: scenario.finalAction, exact: true }).click();

    await expect(main.getByText('Confirmed', { exact: true })).toBeVisible();
    await expect(main.getByRole('heading', { name: scenario.successName, exact: true })).toBeVisible();
    await expect(main.getByText(NEW_LAUNCH_TOKEN, { exact: true })).toBeVisible();
    await expect(main.getByRole('status')).toContainText('CONFIRMED');
    const snapshot = await walletSnapshot(page);
    expect(snapshot.submittedTransactions).toHaveLength(1);
    const submitted = snapshot.submittedTransactions[0] as Readonly<{ to?: unknown; value?: unknown }>;
    expect(typeof submitted.to).toBe('string');
    expect((submitted.to as string).toLowerCase()).toBe(E2E_FACTORY.toLowerCase());
    expect(submitted.value === undefined || submitted.value === '0x0' || submitted.value === '0x00').toBe(true);
    expect(rpcState.unknownCalls).toEqual([]);
  });
}
