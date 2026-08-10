'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { PublicClient } from 'viem';

import type { ProtocolContext } from '../../../../packages/protocol-sdk/src/context';
import type { TradeAction } from '../../lib/transactions/state';
import type { TradeWalletAdapter } from '../../lib/transactions/controller';

type Address = `0x${string}`;

export type TradeRuntime = Readonly<{
  client: PublicClient;
  wallet: TradeWalletAdapter;
  context: ProtocolContext;
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
