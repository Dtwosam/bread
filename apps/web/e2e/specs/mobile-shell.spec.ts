import { expect, test } from '../fixtures/browser';

test('mobile shell follows the v2.2 56px top -> 36px live strip -> page composition without overflow', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile shell proof runs in the mobile project.');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/explore');
  await page.waitForLoadState('networkidle');

  const topBar = page.locator('.bread-mobile-top');
  const liveStrip = page.locator('.bread-live-strip-region .bread-live-strip');
  const heading = page.getByRole('heading', { name: 'Explore' });
  const navigation = page.getByRole('navigation', { name: 'Mobile navigation' });

  await expect(topBar).toBeVisible();
  await expect(topBar).toHaveCSS('height', '56px');
  await expect(liveStrip).toBeVisible();
  await expect(liveStrip).toHaveCSS('height', '36px');
  await expect(heading).toBeVisible();
  await expect(navigation).toBeVisible();

  const topBox = await topBar.boundingBox();
  const liveBox = await liveStrip.boundingBox();
  const headingBox = await heading.boundingBox();
  expect(topBox).not.toBeNull();
  expect(liveBox).not.toBeNull();
  expect(headingBox).not.toBeNull();
  expect(liveBox!.y).toBeGreaterThanOrEqual(topBox!.y + topBox!.height);
  expect(headingBox!.y).toBeGreaterThanOrEqual(liveBox!.y + liveBox!.height);

  await expect(navigation.getByRole('link')).toHaveCount(4);
  const explore = navigation.getByRole('link', { name: 'Explore' });
  const trending = navigation.getByRole('link', { name: 'Trending' });
  await expect(explore).toBeVisible();
  await expect(trending).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Create' })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Portfolio' })).toBeVisible();
  await expect(explore).toHaveAttribute('aria-current', 'page');
  await expect(trending).not.toHaveAttribute('aria-current', 'page');

  await trending.click();
  await expect(page).toHaveURL(/\/explore\?view=trending$/);
  await expect(trending).toHaveAttribute('aria-current', 'page');
  await expect(explore).not.toHaveAttribute('aria-current', 'page');

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(horizontalOverflow).toBe(false);
});
