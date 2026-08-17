import { expect, test } from '@playwright/test';

import { createIndexedApiFixtureState, installIndexedApiRoutes } from '../fixtures/indexed-api';
import { ARC_TESTNET_RPC } from '../fixtures/constants';

test('Explore Baked Progress range is backend-backed and preserves feed context', async ({ page }) => {
  const state = createIndexedApiFixtureState();
  const rawRpcRequests: string[] = [];

  page.on('request', (request) => {
    if (request.url().startsWith(ARC_TESTNET_RPC)) rawRpcRequests.push(request.url());
  });
  await installIndexedApiRoutes(page, state);

  await page.goto('/explore?view=trending&age=lt1h');
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByLabel('Baked progress min').fill('85');
  await page.getByLabel('Baked progress max').fill('95');
  await page.getByRole('button', { name: 'Apply baked progress filter' }).click();

  await expect(page).toHaveURL(
    /\/explore\?view=trending&age=lt1h&progressMinBps=8500&progressMaxBps=9500$/,
  );
  await expect(page.getByRole('button', { name: 'Baked progress: 85–95%' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Age: <1h' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset filters' })).toBeVisible();
  await expect(page.getByText('Bread Twin')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Graduated' })).toHaveAttribute(
    'href',
    '/explore?view=graduated&age=lt1h&progressMinBps=8500&progressMaxBps=9500',
  );
  expect(
    state.requests.some((request) => {
      const url = new URL(request);
      return (
        url.pathname === '/v1/feed' &&
        url.searchParams.get('view') === 'trending' &&
        url.searchParams.get('age') === 'lt1h' &&
        url.searchParams.get('progressMinBps') === '8500' &&
        url.searchParams.get('progressMaxBps') === '9500'
      );
    }),
  ).toBe(true);
  expect(rawRpcRequests).toEqual([]);

  await page.getByRole('button', { name: 'Baked progress: 85–95%' }).click();
  await expect(page).toHaveURL('/explore?view=trending&age=lt1h');
  await expect(page.getByRole('button', { name: 'Baked progress: 85–95%' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Age: <1h' })).toBeVisible();

  await page.getByRole('button', { name: 'Reset filters' }).click();
  await expect(page).toHaveURL('/explore?view=trending');
});