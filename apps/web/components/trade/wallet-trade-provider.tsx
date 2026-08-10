'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  useConnect,
  useConnection,
  useConnectors,
  usePublicClient,
  useSwitchChain,
  useWalletClient,
} from 'wagmi';

import { breadQueryKeys } from '../../lib/api/queries';
import { recoverPersistedTransactions } from '../../lib/transactions/controller';
import {
  createTradeWalletAdapter,
  readSpendableTradeBalance,
} from '../../lib/transactions/wallet-adapter';
import {
  arcTestnetChain,
  arcTradeExecutionContext,
} from '../../lib/wallet/config';
import { TradeRuntimeProvider, type TradeConnectionStatus, type TradeRuntime } from './trade-runtime';

export function WalletTradeProvider({ children }: Readonly<{ children: ReactNode }>) {
  const queryClient = useQueryClient();
  const connection = useConnection();
  const connectors = useConnectors();
  const connect = useConnect();
  const switchChain = useSwitchChain();
  const publicClient = usePublicClient({ chainId: arcTestnetChain.id });
  const walletClient = useWalletClient();
  const recoveryStarted = useRef(false);

  const connectionStatus: TradeConnectionStatus = !connection.isConnected
    ? 'DISCONNECTED'
    : connection.chainId !== arcTestnetChain.id
      ? 'WRONG_NETWORK'
      : walletClient.data
        ? 'READY'
        : 'DISCONNECTED';

  const wallet = useMemo(() => {
    if (
      connectionStatus !== 'READY' ||
      !publicClient ||
      !walletClient.data ||
      !connection.address ||
      connection.chainId === undefined
    ) {
      return null;
    }

    return createTradeWalletAdapter({
      publicClient,
      walletClient: walletClient.data,
      account: connection.address,
      chainId: connection.chainId,
    });
  }, [
    connection.address,
    connection.chainId,
    connectionStatus,
    publicClient,
    walletClient.data,
  ]);

  useEffect(() => {
    if (!publicClient || recoveryStarted.current) return;
    recoveryStarted.current = true;

    void recoverPersistedTransactions({
      client: publicClient,
      storage: window.localStorage,
      chainId: arcTestnetChain.id,
      onConfirmed: async (record) => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: breadQueryKeys.token(record.tokenAddress) }),
          queryClient.invalidateQueries({
            queryKey: breadQueryKeys.trades(record.tokenAddress, { limit: 25 }),
          }),
          queryClient.invalidateQueries({
            queryKey: breadQueryKeys.holders(record.tokenAddress, { limit: 25 }),
          }),
        ]);
      },
    });
  }, [publicClient, queryClient]);

  if (!publicClient) return children;

  const runtime: TradeRuntime = {
    client: publicClient,
    wallet,
    context: arcTradeExecutionContext,
    connectionStatus,
    async connectWallet() {
      const connector = connectors[0];
      if (!connector) throw new Error('No injected EVM wallet was detected.');
      await connect.mutateAsync({ connector, chainId: arcTestnetChain.id });
    },
    async switchToTargetChain() {
      await switchChain.mutateAsync({ chainId: arcTestnetChain.id });
    },
    async getSpendableBalance(action, tokenAddress) {
      if (!connection.address) throw new Error('Connect a wallet before reading a spendable balance.');
      return readSpendableTradeBalance({
        publicClient,
        account: connection.address,
        action,
        tokenAddress,
        quoteAsset: arcTradeExecutionContext.quoteAsset,
      });
    },
  };

  return <TradeRuntimeProvider runtime={runtime}>{children}</TradeRuntimeProvider>;
}
