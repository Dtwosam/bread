import type { Page } from '@playwright/test';

import {
  ACTIVE_CURVE,
  ACTIVE_TOKEN,
  ARC_TESTNET_CHAIN_ID,
  BLOCK_HASH,
  E2E_COORDINATOR,
  E2E_DEPLOYER,
  E2E_FACTORY,
  E2E_FEE_ESCROW,
  E2E_GRADUATION_ADAPTER,
  E2E_WALLET,
  FIXTURE_TIMESTAMP,
  GRADUATED_TOKEN,
  LAUNCH_TX_HASH,
  PENDING_TOKEN,
} from '../fixtures/constants';
import { expect, test } from '../fixtures/browser';

const GRADUATED_POOL_ID = `0x${'88'.repeat(32)}`;
const GRADUATED_POSITION_MANAGER = '0x6000000000000000000000000000000000000001';
const ARCSCAN_TESTNET = 'https://testnet.arcscan.app';

async function installProcessingTokenDetail(page: Page): Promise<void> {
  await page.route(`**/v1/tokens/${ACTIVE_TOKEN}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          tokenAddress: ACTIVE_TOKEN,
          curveAddress: ACTIVE_CURVE,
          stackVersion: 'e2e-test-only',
          factoryAddress: E2E_FACTORY,
          deployerAddress: E2E_DEPLOYER,
          creatorFeeRecipient: E2E_WALLET,
          creatorTaxBps: '125',
          economicsDigest: `0x${'66'.repeat(32)}`,
          configVersion: '1',
          launchTimestamp: '1723302000',
          name: 'Bread Twin',
          symbol: 'TWIN',
          metadata: { description: 'Processing-state deterministic Playwright metadata' },
          quoteAsset: '0x3600000000000000000000000000000000000000',
          initialSupply: '1000000000000000000000000000',
          phantomQuote: '100000000',
          graduationThreshold: '1000000000',
          protocolFeeRecipient: E2E_FEE_ESCROW,
          tradeFeeBps: '100',
          protocolFeeShareBps: '5000',
          maxCreatorTaxBps: '500',
          graduationCoordinator: E2E_COORDINATOR,
          graduationAdapter: E2E_GRADUATION_ADAPTER,
          graduationAdapterFamily: null,
          graduationConfigHash: `0x${'77'.repeat(32)}`,
          reservedTokensBaseline: '100000000000000000000000000',
          launchBlockNumber: '900',
          launchTransactionHash: LAUNCH_TX_HASH,
          launchLogIndex: 0,
          holderCount: '42',
          graduatedVenueKind: null,
          metrics: {
            lastPrice: { numerator: '2500000', denominator: '1000000000000000000', source: 'TRACKED_CURVE' },
            quoteVolume: { m5: '12000000', h1: '75000000', h24: '450000000' },
            tradeCount: { h1: '24', h24: '140' },
            uniqueTraders: { h1: '17', h24: '86' },
          },
          progress: { progressBps: '10000', state: 'PROCESSING' },
          curveState: {
            mode: 'ACTIVE',
            trackedQuote: '1000000000',
            trackedTokens: '100000000000000000000000000',
            quoteFeeBalance: '2500000',
            creatorTaxBalance: '1250000',
            realQuoteReserve: '900000000',
            virtualQuoteReserve: '100000000',
            remainingSellableTokens: '0',
            trackedSoldInventory: '900000000000000000000000000',
            readyToGraduate: true,
            graduationPhase: 'SWEPT',
            poolId: null,
            graduationAdapter: E2E_GRADUATION_ADAPTER,
            sweptUsdcAmount: '1000000000',
            sweptTokenAmount: '100000000000000000000000000',
            graduationFailureReasonHash: null,
            positionManager: null,
            positionId: null,
            usdcUsed: null,
            tokenUsed: null,
            tokenLocked: null,
            usdcDust: null,
            positionLocked: null,
            tokenSupplyLocked: null,
            graduationCompletedBlock: null,
            graduationCompletedLogIndex: null,
            latestBlockNumber: '1000',
            latestTransactionHash: LAUNCH_TX_HASH,
            latestLogIndex: 3,
          },
        },
        meta: {
          chainId: ARC_TESTNET_CHAIN_ID,
          schemaVersion: 'day6-v1',
          indexedThroughBlock: '1000',
          indexedThroughBlockHash: BLOCK_HASH,
          indexedThroughBlockTimestamp: FIXTURE_TIMESTAMP,
          servedAt: '2026-08-10T15:00:01.000Z',
          source: 'bread-indexer',
          status: 'FRESH',
          observedHeadBlock: '1000',
          lagBlocks: '0',
          cache: 'HIT',
          stackVersion: 'e2e-test-only',
        },
      }),
    });
  });
}

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
  await expect(page.getByText(/completed trade remains confirmed/i)).toHaveCount(0);

  await page.goto(`/token/${PENDING_TOKEN}`);
  await expect(page.getByText(/Graduation pending · Indexed state GRADUATION_PENDING/)).toBeVisible();
  await expect(page.getByText('Indexed locked')).toHaveCount(0);
  await expect(page.getByText(/completed trade remains confirmed/i)).toBeVisible();
  await expect(page.getByText(/trade failed/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /retry/i })).toBeVisible();

  await page.goto(`/token/${GRADUATED_TOKEN}`);
  await expect(page.getByText(/Graduated · Indexed state GRADUATED/)).toBeVisible();
  await expect(page.getByText('Indexed locked')).toBeVisible();
  await expect(page.getByRole('button', { name: /retry/i })).toHaveCount(0);
});

test('processing token is Graduating, preserves completed trades, and disables the invalid curve route', async ({ page }) => {
  await installProcessingTokenDetail(page);
  await page.goto(`/token/${ACTIVE_TOKEN}`);

  const graduation = page.locator('.bread-graduation');
  await expect(graduation.getByText(/Graduating · Indexed state PROCESSING/)).toBeVisible();
  await expect(graduation.getByText(/bonding curve is complete/i)).toBeVisible();
  await expect(graduation.getByText(/liquidity creation is in progress/i)).toBeVisible();
  await expect(graduation.getByText(/completed trades remain confirmed/i)).toBeVisible();
  await expect(page.getByText(/trade failed/i)).toHaveCount(0);
  await expect(graduation.getByRole('button', { name: /continue graduation/i })).toBeVisible();

  await expect(page.locator('.bread-token-trade-slot button[aria-label="Trading unavailable while graduation completes"]')).toBeDisabled();
  await expect(page.locator('.bread-token-tablet-trade-trigger button[aria-label="Trading unavailable while graduation completes"]')).toBeDisabled();
  await expect(page.locator('.bread-token-mobile-actions button').nth(0)).toBeDisabled();
  await expect(page.locator('.bread-token-mobile-actions button').nth(1)).toBeDisabled();
});

test('graduated lifecycle exposes canonical venue, pool identity, indexed liquidity and permanent-lock evidence', async ({ page }) => {
  await page.goto(`/token/${GRADUATED_TOKEN}`);

  const graduation = page.locator('.bread-graduation');
  await expect(graduation.getByText(/Graduated · Indexed state GRADUATED/)).toBeVisible();
  await expect(graduation.getByText('Uniswap V3', { exact: true })).toBeVisible();
  await expect(graduation.getByText('Pool ID', { exact: true })).toBeVisible();
  await expect(graduation.getByText(GRADUATED_POOL_ID, { exact: true })).toBeVisible();
  await expect(graduation.getByText('Liquidity USDC', { exact: true })).toBeVisible();
  await expect(graduation.getByText('990 USDC', { exact: true })).toBeVisible();
  await expect(graduation.getByText('Permanent lock', { exact: true })).toBeVisible();
  await expect(graduation.getByText('Indexed locked', { exact: true })).toBeVisible();

  const positionManager = graduation.getByRole('link', { name: 'Open position manager in Arcscan' });
  await expect(positionManager).toHaveAttribute(
    'href',
    `${ARCSCAN_TESTNET}/address/${GRADUATED_POSITION_MANAGER}`,
  );
  await expect(graduation.getByText(/not a safety guarantee/i)).toBeVisible();
});
