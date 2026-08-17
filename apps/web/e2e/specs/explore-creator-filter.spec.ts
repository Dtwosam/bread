import { expect, test } from '@playwright/test';

import { createIndexedApiFixtureState, installIndexedApiRoutes } from '../fixtures/indexed-api';
import { ARC_TESTNET_RPC, E2E_DEPLOYER } from '../fixtures/constants';

test('Explore Creator wallet filter is backend-backed and preserves existing filter context', async ({ page }) => {
  const state = createIndexedApiFixtureState();
  const rawRpcRequests: string[] = [];

  page.on('request', (request) => {
    if (request.url().startsWith(ARC_TESTNET_RPC)) rawRpcRequests.push(request.url());
  });
  await installIndexedApiRoutes(page, state);

  await page.goto(
    '/explore?view=trending&age=lt1h&holdersMin=10&holdersMax=20&progressMinBps=8500&progressMaxBps=9500',
  );
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByLabel('Creator wallet').fill(E2E_DEPLOYER);
  await page.getByRole('button', { name: 'Apply creator filter' }).click();

  await expect(page).toHaveURL(
    new RegExp(
      `/explore\\?view=trending&age=lt1h&holdersMin=10&holdersMax=20&progressMinBps=8500&progressMaxBps=9500&creator=${E2E_DEPLOYER}$`,
      'i',
    ),
  );
  await expect(page.getByRole('button', { name: `Creator: ${E2E_DEPLOYER.toLowerCase()}` })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Age: <1h' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Holders: 10–20' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Baked progress: 85–95%' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset filters' })).toBeVisible();

  // The deterministic browser fixture already returns one server-selected row
  // for the retained Holder+Baked context and deliberately does not reproduce
  // creator membership. Rendering that row unchanged proves the UI forwards
  // creator rather than applying a second client-side creator predicate; the
  // real PostgreSQL/API test owns creator-membership correctness.
  await expect(page.getByText('Bread Twin')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Graduated' })).toHaveAttribute(
    'href',
    `/explore?view=graduated&age=lt1h&holdersMin=10&holdersMax=20&progressMinBps=8500&progressMaxBps=9500&creator=${E2E_DEPLOYER.toLowerCase()}`,
  );
  expect(
    state.requests.some((request) => {
      const url = new URL(request);
      return (
        url.pathname === '/v1/feed' &&
        url.searchParams.get('view') === 'trending' &&
        url.searchParams.get('age') === 'lt1h' &&
        url.searchParams.get('holdersMin') === '10' &&
        url.searchParams.get('holdersMax') === '20' &&
        url.searchParams.get('progressMinBps') === '8500' &&
        url.searchParams.get('progressMaxBps') === '9500' &&
        url.searchParams.get('creator') === E2E_DEPLOYER.toLowerCase()
      );
    }),
  ).toBe(true);
  expect(rawRpcRequests).toEqual([]);

  await page.getByRole('button', { name: `Creator: ${E2E_DEPLOYER.toLowerCase()}` }).click();
  await expect(page).toHaveURL(
    '/explore?view=trending&age=lt1h&holdersMin=10&holdersMax=20&progressMinBps=8500&progressMaxBps=9500',
  );
  await expect(page.getByRole('button', { name: `Creator: ${E2E_DEPLOYER.toLowerCase()}` })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Age: <1h' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Holders: 10–20' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Baked progress: 85–95%' })).toBeVisible();

  await page.getByRole('button', { name: 'Reset filters' }).click();
  await expect(page).toHaveURL('/explore?view=trending');
});