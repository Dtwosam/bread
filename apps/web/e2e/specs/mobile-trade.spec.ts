import { ACTIVE_TOKEN, BUY_TX_HASH } from '../fixtures/constants';
import {
  expect,
  setWalletTransactionHashes,
  test,
  walletSnapshot,
} from '../fixtures/browser';

test('mobile trade sheet survives keyboard-sized viewport pressure and executes Buy through the canonical path', async ({
  page,
  rpcState,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Task 5 mobile trade proof runs only in the mobile project.');

  await page.goto(`/token/${ACTIVE_TOKEN}`);
  const actions = page.locator('.bread-token-mobile-actions');
  await expect(actions).toHaveAttribute('aria-label', 'Token trade actions');
  const openBuy = actions.getByRole('button', { name: 'Open buy panel' });
  const openSell = actions.getByRole('button', { name: 'Open sell panel' });
  await expect(openBuy).toBeVisible();
  await expect(openSell).toBeVisible();

  for (const control of [openBuy, openSell]) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  await openBuy.click();
  const dialog = page.getByRole('dialog', { name: 'Trade' });
  await expect(dialog).toBeVisible();

  const initialViewport = page.viewportSize();
  const initialBox = await dialog.boundingBox();
  expect(initialViewport).not.toBeNull();
  expect(initialBox).not.toBeNull();
  expect(initialBox?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual((initialViewport?.height ?? 0) * 0.9 + 1);

  const sheetStyle = await dialog.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      overflowY: style.overflowY,
      paddingBottom: Number.parseFloat(style.paddingBottom),
    };
  });
  expect(sheetStyle.overflowY).toBe('auto');
  expect(sheetStyle.paddingBottom).toBeGreaterThanOrEqual(18);

  await dialog.getByRole('button', { name: 'Connect wallet' }).click();
  await expect(dialog.getByText('Balance 1000 USDC', { exact: true })).toBeVisible();
  const amount = dialog.getByLabel('Trade amount');
  await expect(amount).toBeEnabled();
  await amount.focus();
  await expect(amount).toBeFocused();
  await expect(amount).toHaveAttribute('inputmode', 'decimal');

  // Headless Chromium does not expose a software keyboard, so shrink the visual
  // viewport to the keyboard-pressured size required by the mobile gate.
  await page.setViewportSize({ width: 390, height: 520 });
  const pressuredBox = await dialog.boundingBox();
  expect(pressuredBox).not.toBeNull();
  expect((pressuredBox?.y ?? 0) + (pressuredBox?.height ?? 0)).toBeLessThanOrEqual(521);

  await amount.fill('10');
  await dialog.getByRole('button', { name: 'Review buy' }).click();
  const review = dialog.locator('dl.bread-trade-review');
  await expect(review.getByText('Expected output', { exact: true })).toBeVisible();
  await expect(review.getByText('Minimum output', { exact: true })).toBeVisible();
  await expect(review.getByText('Slippage', { exact: true })).toBeVisible();
  await expect(review.getByText('Route', { exact: true })).toBeVisible();
  await expect(review.getByText('Bonding curve', { exact: true })).toBeVisible();

  const submit = dialog.getByRole('button', { name: 'Buy TWIN after reviewing current values' });
  await expect(submit.locator('.bread-button__label')).toHaveText('Buy TWIN');
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeVisible();
  const submitBox = await submit.boundingBox();
  expect(submitBox).not.toBeNull();
  expect(submitBox?.height ?? 0).toBeGreaterThanOrEqual(44);

  await setWalletTransactionHashes(page, [BUY_TX_HASH]);
  await submit.click();
  await expect(dialog.getByRole('status')).toContainText('CONFIRMED');
  expect((await walletSnapshot(page)).submittedTransactions).toHaveLength(1);
  expect(rpcState.unknownCalls).toEqual([]);
});
