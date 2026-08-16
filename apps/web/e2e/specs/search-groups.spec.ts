import { ACTIVE_TOKEN, E2E_DEPLOYER } from '../fixtures/constants';
import { expect, test } from '../fixtures/browser';

test('Search groups exact, token and canonical creator-wallet results without inventing recent/trending data', async ({
  page,
  rpcState,
}) => {
  await page.goto('/explore');
  await page.getByRole('button', { name: 'Search', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Search Bread' });
  const input = dialog.getByPlaceholder('Search by name, ticker, contract or creator');

  await input.fill(ACTIVE_TOKEN);
  await expect(dialog.getByRole('heading', { name: 'Exact match', exact: true })).toBeVisible();
  await expect(dialog.locator(`a[href="/token/${ACTIVE_TOKEN}"]`)).toBeVisible();

  await input.fill('Bread');
  await expect(dialog.getByRole('heading', { name: 'Tokens', exact: true })).toBeVisible();

  await input.fill(E2E_DEPLOYER);
  await expect(dialog.getByRole('heading', { name: 'Creators / wallets', exact: true })).toBeVisible();
  await expect(dialog.locator(`a[href="/token/${ACTIVE_TOKEN}"]`)).toBeVisible();

  await expect(dialog.getByRole('heading', { name: 'Recent searches', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('heading', { name: 'Trending searches', exact: true })).toHaveCount(0);
  expect(rpcState.requests).toEqual([]);
});
