'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { PublicClient } from 'viem';

import type { ProtocolContext } from '../../../../packages/protocol-sdk/src/context';
import type {
  TradeExecutionContext,
  TradeWalletAdapter,
} from '../../lib/transactions/controller';
import type { TradeAction, TransactionState } from '../../lib/transactions/state';
import type { ArcBuyMaxBalance } from '../../lib/transactions/wallet-adapter';

type Address = `0x${string}`;

export type TradeConnectionStatus = 'DISCONNECTED' | 'WRONG_NETWORK' | 'READY';
export type WalletOption = Readonly<{
  id: string;
  name: string;
}>;

export type TradeRuntime = Readonly<{
  client: PublicClient;
  wallet: TradeWalletAdapter | null;
  account: Address | null;
  walletOptions: readonly WalletOption[];
  context: TradeExecutionContext;
  protocolContext: ProtocolContext | null;
  connectionStatus: TradeConnectionStatus;
  recoveredTradeStates: readonly TransactionState[];
  connectWallet: (connectorId?: string) => Promise<void>;
  switchToTargetChain: () => Promise<void>;
  getSpendableBalance: (action: TradeAction, tokenAddress: Address) => Promise<bigint>;
  getBuyMaxBalance: () => Promise<ArcBuyMaxBalance>;
  storage?: Storage;
}>;

const TradeRuntimeContext = createContext<TradeRuntime | null>(null);

export function TradeRuntimeProvider({
  runtime,
  children,
}: Readonly<{
  runtime: TradeRuntime;
  children: ReactNode;
}>) {
  return <TradeRuntimeContext.Provider value={runtime}>{children}</TradeRuntimeContext.Provider>;
}

export function useTradeRuntime(): TradeRuntime | null {
  return useContext(TradeRuntimeContext);
}
