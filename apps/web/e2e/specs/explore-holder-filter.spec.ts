import { expect, test } from '@playwright/test';

import { createIndexedApiFixtureState, installIndexedApiRoutes } from '../fixtures/indexed-api';
import { ARC_TESTNET_RPC } from '../fixtures/constants';

test('Explore Holder range is backend-backed and preserves existing filter context', async ({ page }) => {
  const state = createIndexedApiFixtureState();
  const rawRpcRequests: string[] = [];

  page.on('request', (request) => {
    if (request.url().startsWith(ARC_TESTNET_RPC)) rawRpcRequests.push(request.url());
  });
  await installIndexedApiRoutes(page, state);

  await page.goto('/explore?view=trending&age=lt1h');
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByLabel('Holders min').fill('10');
  await page.getByLabel('Holders max').fill('20');
  await page.getByRole('button', { name: 'Apply holder filter' }).click();

  await expect(page).toHaveURL(
    /\/explore\?view=trending&age=lt1h&holdersMin=10&holdersMax=20$/,
  );
  await expect(page.getByRole('button', { name: 'Holders: 10–20' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Age: <1h' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset filters' })).toBeVisible();
  await expect(page.getByText('Bread Twin')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Graduated' })).toHaveAttribute(
    'href',
    '/explore?view=graduated&age=lt1h&holdersMin=10&holdersMax=20',
  );
  expect(
    state.requests.some((request) => {
      const url = new URL(request);
      return (
        url.pathname === '/v1/feed' &&
        url.searchParams.get('view') === 'trending' &&
        url.searchParams.get('age') === 'lt1h' &&
        url.searchParams.get('holdersMin') === '10' &&
        url.searchParams.get('holdersMax') === '20'
      );
    }),
  ).toBe(true);
  expect(rawRpcRequests).toEqual([]);

  await page.getByRole('button', { name: 'Holders: 10–20' }).click();
  await expect(page).toHaveURL('/explore?view=trending&age=lt1h');
  await expect(page.getByRole('button', { name: 'Holders: 10–20' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Age: <1h' })).toBeVisible();

  await page.getByRole('button', { name: 'Reset filters' }).click();
  await expect(page).toHaveURL('/explore?view=trending');
});