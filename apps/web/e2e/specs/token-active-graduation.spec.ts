import { ACTIVE_TOKEN } from '../fixtures/constants';
import { expect, test } from '../fixtures/browser';

test('active Token graduation module shows source-defined baked progress from indexed reserve evidence', async ({
  page,
  indexedApiState,
  rpcState,
}) => {
  await page.goto(`/token/${ACTIVE_TOKEN}`);

  const graduation = page.locator('section.bread-graduation');
  await expect(graduation.getByRole('heading', { name: 'Graduation' })).toBeVisible();
  await expect(graduation.getByText('42.0% baked', { exact: true })).toBeVisible();
  await expect(graduation.getByText('Accumulated', { exact: true })).toBeVisible();
  await expect(graduation.getByText('420 USDC', { exact: true })).toBeVisible();
  await expect(graduation.getByText('Snapshotted target', { exact: true })).toBeVisible();
  await expect(graduation.getByText('1000 USDC', { exact: true })).toBeVisible();
  await expect(graduation.getByText('Remaining', { exact: true })).toBeVisible();
  await expect(graduation.getByText('580 USDC', { exact: true })).toBeVisible();

  expect(
    indexedApiState.requests.some((request) => new URL(request).pathname === `/v1/tokens/${ACTIVE_TOKEN}`),
  ).toBe(true);
  expect(indexedApiState.requests.some((request) => new URL(request).pathname.endsWith('/holders'))).toBe(false);
  expect(rpcState.requests).toEqual([]);
});
