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

test('captures the Lane 2 mobile shell at the authoritative 390x844 viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile visual reference capture runs in Chromium.');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/explore');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('.bread-mobile-top')).toBeVisible();
  await expect(page.locator('.bread-live-strip-region .bread-live-strip')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();

  await page.screenshot({
    path: 'test-results/visual-reference/mobile-shell-390x844.png',
    fullPage: false,
  });
});
