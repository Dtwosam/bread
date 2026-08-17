import { ACTIVE_TOKEN, PENDING_TOKEN } from '../fixtures/constants';
import { expect, test } from '../fixtures/browser';

test('Search renders exact canonical lifecycle classification without frontend thresholds', async ({
  page,
  rpcState,
}) => {
  await page.goto('/explore');
  await page.getByRole('button', { name: 'Search', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Search Bread' });
  const input = dialog.getByPlaceholder('Search by name, ticker, contract or creator');
  await input.fill('Bread');

  const pending = dialog.locator(`a[href="/token/${PENDING_TOKEN}"]`);
  await expect(pending).toBeVisible();
  await expect(pending.getByText('Lifecycle Graduation pending', { exact: true })).toBeVisible();

  const almostBaked = dialog.locator(`a[href="/token/${ACTIVE_TOKEN}"]`);
  await expect(almostBaked).toBeVisible();
  await expect(almostBaked.getByText('Lifecycle Almost Baked', { exact: true })).toBeVisible();
  await expect(almostBaked.getByText('Lifecycle New', { exact: true })).toHaveCount(0);
  await expect(almostBaked.getByText('Lifecycle Active', { exact: true })).toHaveCount(0);
  await expect(almostBaked.getByText('Lifecycle Graduating', { exact: true })).toHaveCount(0);
  await expect(almostBaked.getByText('Lifecycle Graduated', { exact: true })).toHaveCount(0);

  expect(rpcState.requests).toEqual([]);
});
