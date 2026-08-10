import { ACTIVE_TOKEN, GRADUATED_TOKEN, PENDING_TOKEN } from '../fixtures/constants';
import { expect, test } from '../fixtures/browser';

test('degraded and failed indexed reads stay truthful without raw RPC fallback', async ({
  page,
  indexedApiState,
  rpcState,
}) => {
  indexedApiState.freshnessStatus = 'DEGRADED';
  await page.goto('/explore');
  await expect(page.getByText('Indexed data is degraded')).toBeVisible();
  await expect(page.getByText(/will not substitute unverified primary RPC data/)).toBeVisible();
  expect(rpcState.requests).toEqual([]);

  indexedApiState.failReads = true;
  await page.reload();
  await expect(page.getByText('Explore data is unavailable')).toBeVisible();
  expect(rpcState.requests).toEqual([]);
});

test('active pending and graduated tokens show distinct graduation truth', async ({ page }) => {
  await page.goto(`/token/${ACTIVE_TOKEN}`);
  await expect(page.getByRole('heading', { name: 'Graduation' })).toBeVisible();
  await expect(page.getByText(/Active · Indexed state ACTIVE/)).toBeVisible();
  await expect(page.getByText('Indexed locked')).toHaveCount(0);

  await page.goto(`/token/${PENDING_TOKEN}`);
  await expect(page.getByText(/Pending · Indexed state GRADUATION_PENDING/)).toBeVisible();
  await expect(page.getByText('Indexed locked')).toHaveCount(0);

  await page.goto(`/token/${GRADUATED_TOKEN}`);
  await expect(page.getByText(/Graduated · Indexed state GRADUATED/)).toBeVisible();
  await expect(page.getByText('Indexed locked')).toBeVisible();
});
