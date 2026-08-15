import { expect, test } from '@playwright/test';

import { createIndexedApiFixtureState, installIndexedApiRoutes } from '../fixtures/indexed-api';
import { ARC_TESTNET_RPC } from '../fixtures/constants';

test('Explore consumes the indexed API fixture without raw RPC fanout', async ({ page }) => {
  const state = createIndexedApiFixtureState();
  const rawRpcRequests: string[] = [];

  page.on('request', (request) => {
    if (request.url().startsWith(ARC_TESTNET_RPC)) rawRpcRequests.push(request.url());
  });
  await installIndexedApiRoutes(page, state);

  await page.goto('/explore');

  await expect(page.getByRole('heading', { name: 'Explore' })).toBeVisible();
  await expect(page.getByText('Bread Twin').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'New' })).toHaveAttribute('aria-current', 'page');
  expect(state.requests.filter((url) => new URL(url).pathname === '/v1/feed')).toHaveLength(1);
  expect(rawRpcRequests).toEqual([]);

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(horizontalOverflow).toBe(false);
});

test('Explore Graduated view renders only canonical graduated feed membership', async ({ page }) => {
  const state = createIndexedApiFixtureState();
  const rawRpcRequests: string[] = [];

  page.on('request', (request) => {
    if (request.url().startsWith(ARC_TESTNET_RPC)) rawRpcRequests.push(request.url());
  });
  await installIndexedApiRoutes(page, state);

  await page.goto('/explore?view=graduated');

  const feedNav = page.getByRole('navigation', { name: 'Explore feed' });
  await expect(feedNav.getByRole('link', { name: 'Graduated' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText('Bread Locked')).toBeVisible();
  await expect(page.getByText('Bread Twin')).toHaveCount(0);
  expect(
    state.requests.some((request) => {
      const url = new URL(request);
      return url.pathname === '/v1/feed' && url.searchParams.get('view') === 'graduated';
    }),
  ).toBe(true);
  expect(rawRpcRequests).toEqual([]);
});
