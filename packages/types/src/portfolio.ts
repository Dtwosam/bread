export type IndexedAvailableValue = Readonly<{
  status: 'AVAILABLE';
  source: string;
  numerator: string;
  denominator: string;
}>;

export type IndexedUnavailableValue = Readonly<{
  status: 'UNAVAILABLE';
  reason: string;
}>;

export type IndexedPortfolioHolding = Readonly<{
  tokenAddress: string;
  name: string | null;
  symbol: string | null;
  balance: string;
  isProtocolAddress: boolean;
  graduationState: string | null;
  price: IndexedAvailableValue | IndexedUnavailableValue;
  currentValue: IndexedAvailableValue | IndexedUnavailableValue;
  activity: Readonly<{
    asOfBlockNumber: string;
    lastEvent: Readonly<{ transactionHash: string; logIndex: number }> | null;
  }>;
}>;

export type IndexedPortfolio = Readonly<{
  walletAddress: string;
  holdings: readonly IndexedPortfolioHolding[];
}>;

export type IndexedCreatorLaunch = Readonly<{
  tokenAddress: string;
  curveAddress: string;
}>;

export type IndexedCreatorOverview = Readonly<{
  address: string;
  createdLaunches: readonly IndexedCreatorLaunch[];
  feeRecipientLaunches: readonly IndexedCreatorLaunch[];
  fees: Readonly<{
    credited: string;
    claimed: string;
    indexedClaimable: string;
    onchainAuthoritative: false;
  }>;
  perLaunchEarnedRevenue: readonly Readonly<{
    tokenAddress: string;
    credited: string;
    tradeCount: string;
  }>[];
  unavailable: Readonly<{
    buyback: true;
    vesting: true;
  }>;
}>;
