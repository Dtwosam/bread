import { expect, test } from '../fixtures/browser';

test('mobile shell exposes the source-defined navigation without viewport overflow', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile shell proof runs in the mobile project.');

  await page.goto('/explore');
  const navigation = page.getByRole('navigation', { name: 'Mobile navigation' });
  await expect(navigation).toBeVisible();
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
