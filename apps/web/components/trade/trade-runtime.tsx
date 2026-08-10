'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { PublicClient } from 'viem';

import type {
  TradeExecutionContext,
  TradeWalletAdapter,
} from '../../lib/transactions/controller';
import type { TradeAction } from '../../lib/transactions/state';

type Address = `0x${string}`;

export type TradeConnectionStatus = 'DISCONNECTED' | 'WRONG_NETWORK' | 'READY';

export type TradeRuntime = Readonly<{
  client: PublicClient;
  wallet: TradeWalletAdapter | null;
  context: TradeExecutionContext;
  connectionStatus: TradeConnectionStatus;
  connectWallet: () => Promise<void>;
  switchToTargetChain: () => Promise<void>;
  getSpendableBalance: (action: TradeAction, tokenAddress: Address) => Promise<bigint>;
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
