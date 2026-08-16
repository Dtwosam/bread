import { ACTIVE_TOKEN } from '../fixtures/constants';
import { expect, test } from '../fixtures/browser';

test('Search shows backend-indexed holder count without raw RPC fanout', async ({
  page,
  indexedApiState,
  rpcState,
}) => {
  await page.goto('/explore');
  await page.getByRole('button', { name: 'Search', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Search Bread' });
  const input = dialog.getByPlaceholder('Search by name, ticker, contract or creator');
  await input.fill(ACTIVE_TOKEN);

  const result = dialog.locator(`a[href="/token/${ACTIVE_TOKEN}"]`);
  await expect(result).toBeVisible();
  await expect(result.getByText('42 holders', { exact: true })).toBeVisible();
  await expect(result.getByText('Age 2m', { exact: true })).toBeVisible();

  expect(
    indexedApiState.requests.some((request) => {
      const url = new URL(request);
      return url.pathname === '/v1/search' && url.searchParams.get('q') === ACTIVE_TOKEN.toLowerCase();
    }),
  ).toBe(true);
  expect(rpcState.requests).toEqual([]);
});
