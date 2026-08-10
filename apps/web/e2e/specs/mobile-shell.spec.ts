import { expect, test } from '../fixtures/browser';

test('mobile shell exposes the source-defined navigation without viewport overflow', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile shell proof runs in the mobile project.');

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
