import { ACTIVE_TOKEN, PENDING_TOKEN } from '../fixtures/constants';
import { expect, test } from '../fixtures/browser';

test('Search renders only canonical lifecycle states and does not infer ordinary bonding labels', async ({
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
  await expect(pending.getByText('Graduation pending', { exact: true })).toBeVisible();

  const active = dialog.locator(`a[href="/token/${ACTIVE_TOKEN}"]`);
  await expect(active).toBeVisible();
  await expect(active.getByText('New', { exact: true })).toHaveCount(0);
  await expect(active.getByText('Active', { exact: true })).toHaveCount(0);
  await expect(active.getByText('Almost Baked', { exact: true })).toHaveCount(0);
  await expect(active.getByText('Graduating', { exact: true })).toHaveCount(0);
  await expect(active.getByText('Graduated', { exact: true })).toHaveCount(0);

  expect(rpcState.requests).toEqual([]);
});
