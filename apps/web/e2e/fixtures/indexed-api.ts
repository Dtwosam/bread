import type { Page, Route } from '@playwright/test';

import type {
  FreshnessMeta,
  FreshnessStatus,
  IndexedCreatorOverview,
  IndexedFeedItem,
  IndexedPortfolio,
  IndexedResponse,
  IndexedSearchResult,
  IndexedTokenDetail,
  IndexedTokenHolders,
  IndexedTokenTrade,
} from '../../../../packages/types/src/index';
import {
  ACTIVE_CURVE,
  ACTIVE_TOKEN,
  ARC_TESTNET_CHAIN_ID,
  BLOCK_HASH,
  E2E_COORDINATOR,
  E2E_DEPLOYER,
  E2E_FACTORY,
  E2E_FEE_ESCROW,
  E2E_FEE_POLICY,
  E2E_GRADUATION_ADAPTER,
  E2E_WALLET,
  FIXTURE_TIMESTAMP,
  GRADUATED_CURVE,
  GRADUATED_TOKEN,
  LAUNCH_TX_HASH,
  PENDING_CURVE,
  PENDING_TOKEN,
} from './constants';

const ECONOMICS_DIGEST = `0x${'66'.repeat(32)}`;
const GRADUATION_CONFIG_HASH = `0x${'77'.repeat(32)}`;

export type IndexedApiFixtureState = {
  freshnessStatus: FreshnessStatus;
  failReads: boolean;
  requests: string[];
};

export function createIndexedApiFixtureState(): IndexedApiFixtureState {
  return {
    freshnessStatus: 'FRESH',
    failReads: false,
    requests: [],
  };
}

function meta(state: IndexedApiFixtureState): FreshnessMeta {
  return {
    chainId: ARC_TESTNET_CHAIN_ID,
    schemaVersion: 'day6-v1',
    indexedThroughBlock: '1000',
    indexedThroughBlockHash: BLOCK_HASH,
    indexedThroughBlockTimestamp: FIXTURE_TIMESTAMP,
    servedAt: '2026-08-10T15:00:01.000Z',
    source: 'bread-indexer',
    status: state.freshnessStatus,
    observedHeadBlock: state.freshnessStatus === 'FRESH' ? '1000' : '1012',
    lagBlocks: state.freshnessStatus === 'FRESH' ? '0' : '12',
    cache: 'HIT',
    stackVersion: 'e2e-test-only',
  };
}

function envelope<T>(state: IndexedApiFixtureState, data: T): IndexedResponse<T> {
  return { data, meta: meta(state) };
}

function feedItem(input: {
  tokenAddress: string;
  curveAddress: string;
  name: string;
  symbol: string;
  progressBps: string;
  progressState: string;
}): IndexedFeedItem {
  return {
    tokenAddress: input.tokenAddress,
    curveAddress: input.curveAddress,
    stackVersion: 'e2e-test-only',
    factoryAddress: E2E_FACTORY,
    deployerAddress: E2E_DEPLOYER,
    creatorFeeRecipient: E2E_WALLET,
    creatorTaxBps: '125',
    economicsDigest: ECONOMICS_DIGEST,
    configVersion: '1',
    launchTimestamp: '1723302000',
    name: input.name,
    symbol: input.symbol,
    metadata: {
      description: `${input.name} deterministic Playwright metadata`,
      website: 'https://example.com/bread-e2e',
    },
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
    graduationAdapterFamily: 'PLAYWRIGHT_TEST_ONLY',
    graduationConfigHash: GRADUATION_CONFIG_HASH,
    reservedTokensBaseline: '100000000000000000000000000',
    launchBlockNumber: '900',
    launchTransactionHash: LAUNCH_TX_HASH,
    launchLogIndex: 0,
    holderCount: '42',
    graduatedVenueKind: input.progressState === 'GRADUATED' ? 'UNISWAP_V3' : null,
    metrics: {
      lastPrice: { numerator: '2500000', denominator: '1000000000000000000', source: 'TRACKED_CURVE' },
      quoteVolume: { m5: '12000000', h1: '75000000', h24: '450000000' },
      tradeCount: { h1: '24', h24: '140' },
      uniqueTraders: { h1: '17', h24: '86' },
    },
    progress: { progressBps: input.progressBps, state: input.progressState },
  };
}

const activeFeed = feedItem({
  tokenAddress: ACTIVE_TOKEN,
  curveAddress: ACTIVE_CURVE,
  name: 'Bread Twin',
  symbol: 'TWIN',
  progressBps: '4200',
  progressState: 'ACTIVE',
});

const pendingFeed = feedItem({
  tokenAddress: PENDING_TOKEN,
  curveAddress: PENDING_CURVE,
  name: 'Bread Twin',
  symbol: 'TWIN2',
  progressBps: '10000',
  progressState: 'GRADUATION_PENDING',
});

const graduatedFeed = feedItem({
  tokenAddress: GRADUATED_TOKEN,
  curveAddress: GRADUATED_CURVE,
  name: 'Bread Locked',
  symbol: 'LOCK',
  progressBps: '10000',
  progressState: 'GRADUATED',
});

function curveState(kind: 'ACTIVE' | 'PENDING' | 'GRADUATED'): IndexedTokenDetail['curveState'] {
  const graduated = kind === 'GRADUATED';
  const pending = kind === 'PENDING';
  return {
    mode: graduated ? 'GRADUATED' : 'ACTIVE',
    trackedQuote: graduated ? '1000000000' : pending ? '999000000' : '420000000',
    trackedTokens: graduated ? '0' : pending ? '100000000000000000000000000' : '580000000000000000000000000',
    quoteFeeBalance: '2500000',
    creatorTaxBalance: '1250000',
    realQuoteReserve: graduated ? '0' : '420000000',
    virtualQuoteReserve: graduated ? '0' : '100000000',
    remainingSellableTokens: graduated ? '0' : '580000000000000000000000000',
    trackedSoldInventory: graduated ? '900000000000000000000000000' : '320000000000000000000000000',
    readyToGraduate: pending || graduated,
    graduationPhase: graduated ? 'POOL_CREATED' : 'NOT_GRADUATED',
    poolId: graduated ? `0x${'88'.repeat(32)}` : null,
    graduationAdapter: E2E_GRADUATION_ADAPTER,
    sweptUsdcAmount: graduated ? '1000000000' : null,
    sweptTokenAmount: graduated ? '100000000000000000000000000' : null,
    graduationFailureReasonHash: pending ? `0x${'99'.repeat(32)}` : null,
    positionManager: graduated ? '0x6000000000000000000000000000000000000001' : null,
    positionId: graduated ? '1' : null,
    usdcUsed: graduated ? '990000000' : null,
    tokenUsed: graduated ? '99000000000000000000000000' : null,
    tokenLocked: graduated ? '1000000000000000000000000' : null,
    usdcDust: graduated ? '10000000' : null,
    positionLocked: graduated ? true : null,
    tokenSupplyLocked: graduated ? '100000000000000000000000000' : null,
    graduationCompletedBlock: graduated ? '980' : null,
    graduationCompletedLogIndex: graduated ? 2 : null,
    latestBlockNumber: '1000',
    latestTransactionHash: LAUNCH_TX_HASH,
    latestLogIndex: 3,
  };
}

function detail(item: IndexedFeedItem, kind: 'ACTIVE' | 'PENDING' | 'GRADUATED'): IndexedTokenDetail {
  const { deployerAddress, creatorFeeRecipient, graduationAdapterFamily: _family, ...rest } = item;
  return {
    ...rest,
    deployerAddress,
    creatorFeeRecipient,
    graduationAdapterFamily: null,
    curveState: curveState(kind),
  };
}

const tokenDetails = new Map<string, IndexedTokenDetail>([
  [ACTIVE_TOKEN.toLowerCase(), detail(activeFeed, 'ACTIVE')],
  [PENDING_TOKEN.toLowerCase(), detail(pendingFeed, 'PENDING')],
  [GRADUATED_TOKEN.toLowerCase(), detail(graduatedFeed, 'GRADUATED')],
]);

function searchResult(item: IndexedFeedItem, matchKind: string): IndexedSearchResult {
  return {
    tokenAddress: item.tokenAddress,
    curveAddress: item.curveAddress,
    deployerAddress: item.deployerAddress,
    creatorFeeRecipient: item.creatorFeeRecipient,
    name: item.name,
    symbol: item.symbol,
    matchKind,
    ageSeconds: item.tokenAddress === ACTIVE_TOKEN ? '125' : '3600',
    holderCount: item.holderCount,
    lifecycleState:
      item.tokenAddress === PENDING_TOKEN
        ? 'GRADUATION_PENDING'
        : item.tokenAddress === GRADUATED_TOKEN
          ? 'GRADUATED'
          : null,
  };
}

const activeSearchResult = searchResult(activeFeed, 'NAME');
const pendingSearchResult = searchResult(pendingFeed, 'NAME');
const searchResults: readonly IndexedSearchResult[] = [activeSearchResult, pendingSearchResult];
const exactActiveSearchResults: readonly IndexedSearchResult[] = [
  { ...activeSearchResult, matchKind: 'CONTRACT' },
];

const trades: readonly IndexedTokenTrade[] = [];

function holders(tokenAddress: string): IndexedTokenHolders {
  return {
    tokenAddress,
    holders: [
      {
        walletAddress: E2E_WALLET,
        balance: '2500000000000000000000000',
        isProtocolAddress: false,
        asOfBlockNumber: '1000',
        lastEvent: null,
      },
    ],
    concentration: {
      top10ExcludesProtocolAddresses: true,
      top10NonProtocolBalance: '2500000000000000000000000',
      supply: '1000000000000000000000000000',
      holderCount: '1',
      userHolderCount: '1',
    },
  };
}

function portfolio(): IndexedPortfolio {
  return {
    walletAddress: E2E_WALLET,
    holdings: [
      {
        tokenAddress: ACTIVE_TOKEN,
        name: 'Bread Twin',
        symbol: 'TWIN',
        balance: '2500000000000000000000000',
        isProtocolAddress: false,
        graduationState: 'ACTIVE',
        price: {
          status: 'AVAILABLE',
          source: 'TRACKED_CURVE',
          numerator: '2500000',
          denominator: '1000000000000000000',
        },
        currentValue: {
          status: 'AVAILABLE',
          source: 'TRACKED_CURVE',
          numerator: '6250000000',
          denominator: '1000000000000000000',
        },
        activity: { asOfBlockNumber: '1000', lastEvent: null },
      },
    ],
  };
}

function creator(): IndexedCreatorOverview {
  return {
    address: E2E_WALLET,
    createdLaunches: [{ tokenAddress: ACTIVE_TOKEN, curveAddress: ACTIVE_CURVE }],
    feeRecipientLaunches: [{ tokenAddress: ACTIVE_TOKEN, curveAddress: ACTIVE_CURVE }],
    fees: {
      credited: '25000000',
      claimed: '15000000',
      indexedClaimable: '10000000',
      onchainAuthoritative: false,
    },
    perLaunchEarnedRevenue: [{ tokenAddress: ACTIVE_TOKEN, credited: '25000000', tradeCount: '140' }],
    unavailable: { buyback: true, vesting: true },
  };
}

function routePayload(state: IndexedApiFixtureState, requestUrl: string): unknown {
  const url = new URL(requestUrl);
  if (url.pathname === '/v1/feed') {
    const view = url.searchParams.get('view') ?? 'new';
    const age = url.searchParams.get('age');
    const holdersMin = url.searchParams.get('holdersMin');
    const holdersMax = url.searchParams.get('holdersMax');
    const progressMinBps = url.searchParams.get('progressMinBps');
    const progressMaxBps = url.searchParams.get('progressMaxBps');
    const viewItems =
      view === 'graduated'
        ? [graduatedFeed]
        : view === 'trending'
          ? [activeFeed, pendingFeed]
          : view === 'graduating'
            ? [activeFeed, pendingFeed]
            : [activeFeed, pendingFeed, graduatedFeed];
    // The fixture models server-selected membership only. It deliberately does
    // not reproduce or define the production age/holder/progress classification algorithms.
    const holderFilteredItems =
      view === 'trending' && holdersMin === '10' && holdersMax === '20'
        ? [{ ...activeFeed, holderCount: '15' }]
        : viewItems;
    const progressFilteredItems =
      view === 'trending' && progressMinBps === '8500' && progressMaxBps === '9500'
        ? [{ ...activeFeed, progress: { progressBps: '9000', state: 'ACTIVE' } }]
        : holderFilteredItems;
    const items =
      view === 'trending' && age === 'lt5m' ? [activeFeed] : progressFilteredItems;
    return envelope(state, items);
  }
  if (url.pathname === '/v1/search') {
    const query = url.searchParams.get('q')?.toLowerCase();
    return envelope(state, query === ACTIVE_TOKEN.toLowerCase() ? exactActiveSearchResults : searchResults);
  }
  if (url.pathname === `/v1/portfolio/${E2E_WALLET}`) return envelope(state, portfolio());
  if (url.pathname === `/v1/creators/${E2E_WALLET}`) return envelope(state, creator());

  const token = url.pathname.match(/^\/v1\/tokens\/(0x[0-9a-fA-F]{40})(?:\/(trades|holders))?$/);
  if (!token) return null;
  const tokenAddress = token[1]?.toLowerCase();
  const suffix = token[2];
  if (!tokenAddress) return null;
  if (suffix === 'trades') return envelope(state, trades);
  if (suffix === 'holders') return envelope(state, holders(tokenAddress));
  return tokenDetails.has(tokenAddress) ? envelope(state, tokenDetails.get(tokenAddress)) : null;
}

export async function installIndexedApiRoutes(page: Page, state: IndexedApiFixtureState): Promise<void> {
  await page.route('**/v1/**', async (route: Route) => {
    const requestUrl = route.request().url();
    state.requests.push(requestUrl);
    if (state.failReads) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'E2E_INDEXER_UNAVAILABLE',
            message: 'Deterministic Playwright indexer outage.',
            requestId: 'e2e-indexer-outage',
          },
        }),
      });
      return;
    }

    const body = routePayload(state, requestUrl);
    if (body === null) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'TOKEN_NOT_FOUND',
            message: 'Token is not indexed by the deterministic Playwright fixture.',
            requestId: 'e2e-token-not-found',
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}
