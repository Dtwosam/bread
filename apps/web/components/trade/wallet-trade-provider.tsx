'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import type { TransactionState } from '../../lib/transactions/state';
import {
  createTradeWalletAdapter,
  readArcBuyMaxBalance,
  readSpendableTradeBalance,
  recoverPersistedAllowanceTransactions,
} from '../../lib/transactions/wallet-adapter';
import {
  arcProtocolContext,
  arcTestnetChain,
  arcTradeExecutionContext,
} from '../../lib/wallet/config';
import {
  TradeRuntimeProvider,
  type TradeConnectionStatus,
  type TradeRuntime,
  type WalletOption,
} from './trade-runtime';

function recoveredTradeKey(state: TransactionState): string | null {
  if ((state.action !== 'BUY' && state.action !== 'SELL') || !state.tokenAddress) return null;
  return `${state.action}:${state.tokenAddress.toLowerCase()}`;
}

export function WalletTradeProvider({ children }: Readonly<{ children: ReactNode }>) {
  const queryClient = useQueryClient();
  const connection = useConnection();
  const connectors = useConnectors();
  const connect = useConnect();
  const switchChain = useSwitchChain();
  const publicClient = usePublicClient({ chainId: arcTestnetChain.id });
  const walletClient = useWalletClient();
  const recoveryStarted = useRef(false);
  const [recoveredTradeStates, setRecoveredTradeStates] = useState<readonly TransactionState[]>([]);
  const browserStorage = typeof window === 'undefined' ? undefined : window.localStorage;

  const connectionStatus: TradeConnectionStatus = !connection.isConnected
    ? 'DISCONNECTED'
    : connection.chainId !== arcTestnetChain.id
      ? 'WRONG_NETWORK'
      : walletClient.data
        ? 'READY'
        : 'DISCONNECTED';

  const walletOptions = useMemo<readonly WalletOption[]>(() => {
    const seen = new Set<string>();
    const options: WalletOption[] = [];
    for (const connector of connectors) {
      if (seen.has(connector.id)) continue;
      seen.add(connector.id);
      options.push({ id: connector.id, name: connector.name });
    }
    return options;
  }, [connectors]);

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
      storage: browserStorage,
    });
  }, [
    browserStorage,
    connection.address,
    connection.chainId,
    connectionStatus,
    publicClient,
    walletClient.data,
  ]);

  useEffect(() => {
    if (!publicClient || !browserStorage || recoveryStarted.current) return;
    recoveryStarted.current = true;

    void Promise.all([
      recoverPersistedAllowanceTransactions({
        publicClient,
        storage: browserStorage,
        chainId: arcTestnetChain.id,
      }),
      recoverPersistedTransactions({
        client: publicClient,
        storage: browserStorage,
        chainId: arcTestnetChain.id,
        onStateChange: (state) => {
          const key = recoveredTradeKey(state);
          if (!key) return;
          setRecoveredTradeStates((current) => {
            const next = current.filter((candidate) => recoveredTradeKey(candidate) !== key);
            return [...next, state];
          });
        },
        onConfirmed: async (record) => {
          const tokenAddress = record.tokenAddress;
          if (!tokenAddress || (record.action !== 'BUY' && record.action !== 'SELL')) return;
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: breadQueryKeys.token(tokenAddress) }),
            queryClient.invalidateQueries({
              queryKey: breadQueryKeys.trades(tokenAddress, { limit: 25 }),
            }),
            queryClient.invalidateQueries({
              queryKey: breadQueryKeys.holders(tokenAddress, { limit: 25 }),
            }),
          ]);
        },
      }),
    ]);
  }, [browserStorage, publicClient, queryClient]);

  if (!publicClient) return children;

  const runtime: TradeRuntime = {
    client: publicClient,
    wallet,
    account: connection.address ?? null,
    walletOptions,
    context: arcTradeExecutionContext,
    protocolContext: arcProtocolContext,
    connectionStatus,
    recoveredTradeStates,
    async connectWallet(connectorId?: string) {
      const connector = connectorId
        ? connectors.find((candidate) => candidate.id === connectorId)
        : connectors.find((candidate) => candidate.id === 'injected');
      if (!connector) {
        throw new Error(
          connectorId
            ? 'The selected wallet connector is no longer available.'
            : 'Choose a detected wallet before connecting.',
        );
      }
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
    async getBuyMaxBalance() {
      if (!connection.address) throw new Error('Connect a wallet before calculating Buy MAX.');
      return readArcBuyMaxBalance({
        publicClient,
        account: connection.address,
        quoteAsset: arcTradeExecutionContext.quoteAsset,
        quoteDecimals: arcTradeExecutionContext.quoteDecimals,
      });
    },
    ...(browserStorage ? { storage: browserStorage } : {}),
  };

  return <TradeRuntimeProvider runtime={runtime}>{children}</TradeRuntimeProvider>;
}
