import { expect, test } from '../fixtures/browser';

test('captures the Lane 2 desktop shell at the approved-reference viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop visual reference capture runs in Chromium.');

  await page.setViewportSize({ width: 1586, height: 992 });
  await page.goto('/explore');

  await expect(page.locator('.bread-header')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect wallet' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Watchlist' })).toBeVisible();

  await page.screenshot({
    path: 'test-results/visual-reference/desktop-shell-1586x992.png',
    fullPage: false,
  });
});
