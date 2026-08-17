import { ACTIVE_TOKEN, E2E_DEPLOYER, PENDING_TOKEN } from '../fixtures/constants';
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

test('Explore holds three columns at xl and permits four only at 2xl', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Explore desktop grid proof runs in Chromium.');

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/explore');
  await page.waitForLoadState('networkidle');

  const grid = page.locator('.bread-token-grid');
  await expect(grid.locator(':scope > .bread-token-card')).toHaveCount(3);
  await grid.evaluate((element) => {
    const firstCard = element.querySelector('.bread-token-card');
    if (!firstCard) throw new Error('TokenCard fixture missing');
    element.append(firstCard.cloneNode(true));
  });
  await expect(grid.locator(':scope > .bread-token-card')).toHaveCount(4);

  const uniqueColumns = async () => {
    const boxes = await grid.locator(':scope > .bread-token-card').evaluateAll((cards) =>
      cards.map((card) => Math.round(card.getBoundingClientRect().x)),
    );
    return new Set(boxes).size;
  };

  expect(await uniqueColumns()).toBe(3);

  await page.setViewportSize({ width: 1586, height: 992 });
  expect(await uniqueColumns()).toBe(4);
});

test('desktop Search opens from both Ctrl+K and Cmd+K without changing its accessible trigger name', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop search shortcut proof runs in Chromium.');

  await page.goto('/explore');
  await page.waitForLoadState('networkidle');
  const searchTrigger = page.getByRole('button', { name: 'Search', exact: true });
  const dialog = page.getByRole('dialog', { name: 'Search Bread' });

  await expect(searchTrigger).toBeVisible();
  await page.keyboard.press('Control+K');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await page.keyboard.press('Meta+K');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(searchTrigger).toHaveAttribute('aria-label', 'Search');
});

test('Search explicitly labels the exact contract match and keeps the full contract out of visible copy', async ({
  page,
  indexedApiState,
  rpcState,
}) => {
  await page.goto('/explore');
  await page.getByRole('button', { name: 'Search', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Search Bread' });
  const input = dialog.getByPlaceholder('Search by name, ticker, contract or creator');
  await input.fill(ACTIVE_TOKEN);

  const results = dialog.locator('a.bread-search-result');
  await expect(results).toHaveCount(1);
  const exactResult = dialog.locator(`a[href="/token/${ACTIVE_TOKEN}"]`);
  const shortContract = `${ACTIVE_TOKEN.slice(0, 8)}…${ACTIVE_TOKEN.slice(-6)}`;
  await expect(exactResult).toContainText('Exact contract match');
  await expect(exactResult).toContainText(shortContract);
  await expect(exactResult).not.toContainText(ACTIVE_TOKEN);
  await expect(exactResult.locator('code')).toHaveAttribute('title', ACTIVE_TOKEN);
  await expect(exactResult.locator('.bread-creator-attribution')).toHaveAttribute('data-creator-address', E2E_DEPLOYER);

  expect(
    indexedApiState.requests.some((request) => {
      const url = new URL(request);
      return url.pathname === '/v1/search' && url.searchParams.get('q') === ACTIVE_TOKEN.toLowerCase();
    }),
  ).toBe(true);
  expect(rpcState.requests).toEqual([]);
});

test('Search arrow keys move through results and Enter opens the selected token', async ({ page, rpcState }) => {
  await page.goto('/explore');
  await page.getByRole('button', { name: 'Search', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Search Bread' });
  const input = dialog.getByPlaceholder('Search by name, ticker, contract or creator');
  await input.fill('Twin');

  const activeResult = dialog.locator(`a[href="/token/${ACTIVE_TOKEN}"]`);
  const pendingResult = dialog.locator(`a[href="/token/${PENDING_TOKEN}"]`);
  await expect(activeResult).toBeVisible();
  await expect(pendingResult).toBeVisible();
  await expect(input).toBeFocused();

  await page.keyboard.press('ArrowDown');
  await expect(activeResult).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(pendingResult).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(activeResult).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/token/${ACTIVE_TOKEN}$`));
  expect(rpcState.requests).toEqual([]);
});

test('Explore filters and Search preserve contract identity plus keyboard containment', async ({
  page,
  indexedApiState,
  rpcState,
}, testInfo) => {
  await page.goto('/explore');

  const feedNav = page.getByRole('navigation', { name: 'Explore feed' });
  await feedNav.getByRole('link', { name: 'Trending' }).click();
  await expect(page).toHaveURL(/\/explore\?view=trending$/);
  await expect(feedNav.getByRole('link', { name: 'Trending' })).toHaveAttribute('aria-current', 'page');

  const searchTrigger = page.getByRole('button', { name: 'Search', exact: true });
  await expect(searchTrigger).toHaveCount(1);
  if (testInfo.project.name === 'desktop-chromium') {
    await expect(searchTrigger.locator('.bread-icon--normal')).toBeVisible();
  }
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
  const activeShort = `${ACTIVE_TOKEN.slice(0, 8)}…${ACTIVE_TOKEN.slice(-6)}`;
  const pendingShort = `${PENDING_TOKEN.slice(0, 8)}…${PENDING_TOKEN.slice(-6)}`;
  const creatorShort = `${E2E_DEPLOYER.slice(0, 6)}…${E2E_DEPLOYER.slice(-4)}`;
  await expect(activeResult).toContainText(activeShort);
  await expect(pendingResult).toContainText(pendingShort);
  await expect(activeResult).not.toContainText(ACTIVE_TOKEN);
  await expect(pendingResult).not.toContainText(PENDING_TOKEN);
  const activeCreator = activeResult.locator('.bread-creator-attribution');
  const pendingCreator = pendingResult.locator('.bread-creator-attribution');
  await expect(activeCreator).toContainText('by');
  await expect(activeCreator).toContainText(creatorShort);
  await expect(activeCreator).toHaveAttribute('data-creator-address', E2E_DEPLOYER);
  await expect(pendingCreator).toContainText('by');
  await expect(pendingCreator).toContainText(creatorShort);
  await expect(pendingCreator).toHaveAttribute('data-creator-address', E2E_DEPLOYER);

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
