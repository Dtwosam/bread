import { expect, test } from '@playwright/test';

import { createIndexedApiFixtureState, installIndexedApiRoutes } from '../fixtures/indexed-api';
import { ARC_TESTNET_RPC, E2E_DEPLOYER } from '../fixtures/constants';

test('Explore 24h Volume range is backend-backed and preserves existing filter context', async ({ page }) => {
  const state = createIndexedApiFixtureState();
  const rawRpcRequests: string[] = [];

  page.on('request', (request) => {
    if (request.url().startsWith(ARC_TESTNET_RPC)) rawRpcRequests.push(request.url());
  });
  await installIndexedApiRoutes(page, state);

  await page.goto(
    `/explore?view=trending&age=lt1h&holdersMin=10&holdersMax=20&progressMinBps=8500&progressMaxBps=9500&creator=${E2E_DEPLOYER.toLowerCase()}`,
  );
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByLabel('24h volume min').fill('10');
  await page.getByLabel('24h volume max').fill('20');
  await page.getByRole('button', { name: 'Apply 24h volume filter' }).click();

  const expectedBase =
    `/explore?view=trending&age=lt1h&holdersMin=10&holdersMax=20&progressMinBps=8500&progressMaxBps=9500&creator=${E2E_DEPLOYER.toLowerCase()}`;
  await expect(page).toHaveURL(`${expectedBase}&volumeMinQuote=10000000&volumeMaxQuote=20000000`);
  await expect(page.getByRole('button', { name: '24h Volume: 10–20 USDC' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Age: <1h' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Holders: 10–20' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Baked progress: 85–95%' })).toBeVisible();
  await expect(page.getByRole('button', { name: `Creator: ${E2E_DEPLOYER.toLowerCase()}` })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset filters' })).toBeVisible();

  // The deterministic browser fixture deliberately does not reproduce the
  // production trailing-24h membership predicate. Rendering its retained
  // server-selected row unchanged proves the UI forwards the volume bounds
  // rather than applying a second client-side filter; real PostgreSQL owns
  // the time-window membership proof.
  await expect(page.getByText('Bread Twin')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Graduated' })).toHaveAttribute(
    'href',
    `/explore?view=graduated&age=lt1h&holdersMin=10&holdersMax=20&progressMinBps=8500&progressMaxBps=9500&creator=${E2E_DEPLOYER.toLowerCase()}&volumeMinQuote=10000000&volumeMaxQuote=20000000`,
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
        url.searchParams.get('creator') === E2E_DEPLOYER.toLowerCase() &&
        url.searchParams.get('volumeMinQuote') === '10000000' &&
        url.searchParams.get('volumeMaxQuote') === '20000000'
      );
    }),
  ).toBe(true);
  expect(rawRpcRequests).toEqual([]);

  await page.getByRole('button', { name: '24h Volume: 10–20 USDC' }).click();
  await expect(page).toHaveURL(expectedBase);
  await expect(page.getByRole('button', { name: '24h Volume: 10–20 USDC' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Age: <1h' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Holders: 10–20' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Baked progress: 85–95%' })).toBeVisible();
  await expect(page.getByRole('button', { name: `Creator: ${E2E_DEPLOYER.toLowerCase()}` })).toBeVisible();

  await page.getByRole('button', { name: 'Reset filters' }).click();
  await expect(page).toHaveURL('/explore?view=trending');
});