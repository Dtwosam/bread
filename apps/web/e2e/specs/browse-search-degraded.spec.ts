import { ACTIVE_TOKEN, GRADUATED_TOKEN, PENDING_TOKEN } from '../fixtures/constants';
import { expect, test } from '../fixtures/browser';

test('Explore filters and Search remain keyboard-usable and indexed-only', async ({
  page,
  indexedApiState,
  rpcState,
}) => {
  await page.goto('/explore');

  const feedNav = page.getByRole('navigation', { name: 'Explore feed' });
  await feedNav.getByRole('link', { name: 'Trending' }).click();
  await expect(page).toHaveURL(/\/explore\?view=trending$/);
  await expect(feedNav.getByRole('link', { name: 'Trending' })).toHaveAttribute('aria-current', 'page');

  const searchTrigger = page.locator('button:visible').filter({ hasText: /^Search$/ }).first();
  await searchTrigger.focus();
  await searchTrigger.click();

  const dialog = page.getByRole('dialog', { name: 'Search Bread' });
  await expect(dialog).toBeVisible();
  const input = dialog.getByPlaceholder('Search by name, ticker, contract or creator');
  await expect(input).toBeFocused();
  await input.fill('Twin');
  await expect(dialog.locator('a.bread-search-result')).toHaveCount(2);
  await expect(dialog.locator(`a[href="/token/${ACTIVE_TOKEN}"]`)).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(searchTrigger).toBeFocused();

  expect(indexedApiState.requests.some((request) => new URL(request).pathname === '/v1/search')).toBe(true);
  expect(rpcState.requests).toEqual([]);
});

test('degraded and failed indexed reads never fall back to raw RPC', async ({
  page,
  indexedApiState,
  rpcState,
}) => {
  indexedApiState.freshnessStatus = 'DEGRADED';
  await page.goto('/explore');
  await expect(page.getByText('Indexed data is degraded')).toBeVisible();
  expect(rpcState.requests).toEqual([]);

  indexedApiState.failReads = true;
  await page.reload();
  await expect(page.getByText('Explore data is unavailable')).toBeVisible();
  expect(rpcState.requests).toEqual([]);
});

test('token graduation evidence distinguishes pending from permanently locked', async ({ page }) => {
  await page.goto(`/token/${PENDING_TOKEN}`);
  await expect(page.getByRole('heading', { name: 'Graduation' })).toBeVisible();
  await expect(page.getByText(/Pending · Indexed state GRADUATION_PENDING/)).toBeVisible();
  await expect(page.getByText('Not yet indexed locked')).toBeVisible();

  await page.goto(`/token/${GRADUATED_TOKEN}`);
  await expect(page.getByRole('heading', { name: 'Graduation' })).toBeVisible();
  await expect(page.getByText(/Graduated · Indexed state GRADUATED/)).toBeVisible();
  await expect(page.getByText('Indexed locked')).toBeVisible();
});

test('mobile shell exposes the four source-defined bottom navigation actions without overflow', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile navigation proof runs in the mobile project.');

  await page.goto('/explore');
  const navigation = page.getByRole('navigation', { name: 'Mobile navigation' });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole('link')).toHaveCount(4);
  await expect(navigation.getByRole('link', { name: 'Explore' })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Trending' })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Create' })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Portfolio' })).toBeVisible();

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(horizontalOverflow).toBe(false);
});
