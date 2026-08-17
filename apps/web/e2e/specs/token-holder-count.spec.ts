import { ACTIVE_TOKEN } from '../fixtures/constants';
import { expect, test } from '../fixtures/browser';

test('Token stats show indexed holder count without loading holder analytics', async ({
  page,
  indexedApiState,
  rpcState,
}) => {
  await page.goto(`/token/${ACTIVE_TOKEN}`);

  const stats = page.locator('section[aria-label="Token market stats"]');
  await expect(stats).toBeVisible();
  await expect(stats.getByText('Holders', { exact: true })).toBeVisible();
  await expect(stats.getByText('42', { exact: true })).toBeVisible();

  expect(
    indexedApiState.requests.some((request) => new URL(request).pathname === `/v1/tokens/${ACTIVE_TOKEN}`),
  ).toBe(true);
  expect(
    indexedApiState.requests.some((request) => new URL(request).pathname === `/v1/tokens/${ACTIVE_TOKEN}/holders`),
  ).toBe(false);
  expect(rpcState.requests).toEqual([]);
});
