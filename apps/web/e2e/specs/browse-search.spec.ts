import { ACTIVE_TOKEN, PENDING_TOKEN } from '../fixtures/constants';
import { expect, test, walletSnapshot } from '../fixtures/browser';

test('disconnected users browse Explore and token detail without raw RPC', async ({
  page,
  indexedApiState,
  rpcState,
}) => {
  await page.goto('/explore');
  await expect(page.getByRole('heading', { name: 'Explore' })).toBeVisible();
  await expect(page.getByText('Bread Twin').first()).toBeVisible();
  expect((await walletSnapshot(page)).connected).toBe(false);

  await page.goto(`/token/${ACTIVE_TOKEN}`);
  await expect(page.getByRole('heading', { name: 'Bread Twin' })).toBeVisible();
  await expect(page.getByText(ACTIVE_TOKEN, { exact: true })).toBeVisible();
  expect((await walletSnapshot(page)).connected).toBe(false);

  expect(indexedApiState.requests.some((request) => new URL(request).pathname === `/v1/tokens/${ACTIVE_TOKEN}`)).toBe(true);
  expect(rpcState.requests).toEqual([]);
});

test('Explore filters and Search preserve contract identity plus keyboard containment', async ({
  page,
  indexedApiState,
  rpcState,
}) => {
  await page.goto('/explore');

  const feedNav = page.getByRole('navigation', { name: 'Explore feed' });
  await feedNav.getByRole('link', { name: 'Trending' }).click();
  await expect(page).toHaveURL(/\/explore\?view=trending$/);
  await expect(feedNav.getByRole('link', { name: 'Trending' })).toHaveAttribute('aria-current', 'page');

  const searchTrigger = page.getByRole('button', { name: 'Search', exact: true });
  await expect(searchTrigger).toHaveCount(1);
  await searchTrigger.focus();
  await searchTrigger.click();

  const dialog = page.getByRole('dialog', { name: 'Search Bread' });
  const close = dialog.getByRole('button', { name: 'Close search' });
  const input = dialog.getByPlaceholder('Search by name, ticker, contract or creator');
  await expect(input).toBeFocused();
  await input.fill('Twin');

  const results = dialog.locator('a.bread-search-result');
  await expect(results).toHaveCount(2);
  const activeResult = dialog.locator(`a[href="/token/${ACTIVE_TOKEN}"]`);
  const pendingResult = dialog.locator(`a[href="/token/${PENDING_TOKEN}"]`);
  await expect(activeResult).toContainText(ACTIVE_TOKEN);
  await expect(pendingResult).toContainText(PENDING_TOKEN);

  await close.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(pendingResult).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(searchTrigger).toBeFocused();

  expect(indexedApiState.requests.some((request) => new URL(request).pathname === '/v1/search')).toBe(true);
  expect(rpcState.requests).toEqual([]);
});
