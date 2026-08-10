import type { BrowserContext } from '@playwright/test';

import {
  APPROVAL_TX_HASH,
  ARC_TESTNET_CHAIN_ID_HEX,
  BUY_TX_HASH,
  CLAIM_TX_HASH,
  E2E_WALLET,
  LAUNCH_TX_HASH,
  SELL_TX_HASH,
} from './constants';

export type InjectedWalletOptions = Readonly<{
  connected?: boolean;
  chainIdHex?: string;
}>;

export async function installInjectedWallet(
  context: BrowserContext,
  options: InjectedWalletOptions = {},
): Promise<void> {
  const initialConnected = options.connected ?? false;
  const initialChainIdHex = options.chainIdHex ?? ARC_TESTNET_CHAIN_ID_HEX;

  await context.addInitScript(
    ({ account, chainIdHex, connected, transactionHashes }) => {
      type Listener = (...args: unknown[]) => void;
      type WalletSnapshot = Readonly<{
        connected: boolean;
        chainIdHex: string;
        requests: readonly Readonly<{ method: string; params: readonly unknown[] }>[];
        submittedTransactions: readonly unknown[];
      }>;

      const listeners = new Map<string, Set<Listener>>();
      const requests: Array<{ method: string; params: readonly unknown[] }> = [];
      const submittedTransactions: unknown[] = [];
      let isConnected = connected;
      let currentChainId = chainIdHex;
      let transactionIndex = 0;
      let queuedTransactionHashes = [...transactionHashes];

      function emit(event: string, ...args: unknown[]) {
        for (const listener of listeners.get(event) ?? []) listener(...args);
      }

      function accounts() {
        return isConnected ? [account] : [];
      }

      const provider = {
        isMetaMask: true,
        providers: undefined,
        async request(input: Readonly<{ method: string; params?: readonly unknown[] }>) {
          const params = input.params ?? [];
          requests.push({ method: input.method, params });

          switch (input.method) {
            case 'eth_accounts':
              return accounts();
            case 'eth_requestAccounts': {
              const wasConnected = isConnected;
              isConnected = true;
              if (!wasConnected) {
                emit('connect', { chainId: currentChainId });
                emit('accountsChanged', accounts());
              }
              return accounts();
            }
            case 'eth_chainId':
              return currentChainId;
            case 'wallet_switchEthereumChain': {
              const next = params[0] as Readonly<{ chainId?: unknown }> | undefined;
              if (!next || typeof next.chainId !== 'string') {
                const error = new Error('wallet_switchEthereumChain requires a chainId.');
                Object.assign(error, { code: -32602 });
                throw error;
              }
              currentChainId = next.chainId;
              emit('chainChanged', currentChainId);
              return null;
            }
            case 'eth_sendTransaction': {
              if (!isConnected) {
                const error = new Error('Wallet is disconnected.');
                Object.assign(error, { code: 4100 });
                throw error;
              }
              submittedTransactions.push(params[0] ?? null);
              const hash = queuedTransactionHashes[Math.min(transactionIndex, queuedTransactionHashes.length - 1)];
              if (!hash) {
                const error = new Error('No deterministic E2E transaction hash is queued.');
                Object.assign(error, { code: -32000 });
                throw error;
              }
              transactionIndex += 1;
              return hash;
            }
            default: {
              const error = new Error(`Unhandled E2E wallet method ${input.method}`);
              Object.assign(error, { code: 4200 });
              throw error;
            }
          }
        },
        on(event: string, listener: Listener) {
          const existing = listeners.get(event) ?? new Set<Listener>();
          existing.add(listener);
          listeners.set(event, existing);
          return provider;
        },
        removeListener(event: string, listener: Listener) {
          listeners.get(event)?.delete(listener);
          return provider;
        },
      };

      const controller = {
        connect() {
          if (isConnected) return;
          isConnected = true;
          emit('connect', { chainId: currentChainId });
          emit('accountsChanged', accounts());
        },
        disconnect() {
          if (!isConnected) return;
          isConnected = false;
          emit('accountsChanged', []);
          emit('disconnect', { code: 4900, message: 'E2E wallet disconnected.' });
        },
        setChainId(nextChainIdHex: string) {
          currentChainId = nextChainIdHex;
          emit('chainChanged', currentChainId);
        },
        setTransactionHashes(nextHashes: readonly string[]) {
          queuedTransactionHashes = [...nextHashes];
          transactionIndex = 0;
        },
        snapshot(): WalletSnapshot {
          return {
            connected: isConnected,
            chainIdHex: currentChainId,
            requests: requests.map((request) => ({ ...request, params: [...request.params] })),
            submittedTransactions: [...submittedTransactions],
          };
        },
      };

      Object.defineProperty(window, 'ethereum', {
        configurable: true,
        enumerable: true,
        value: provider,
        writable: false,
      });
      Object.defineProperty(window, '__breadE2EWallet', {
        configurable: true,
        enumerable: false,
        value: controller,
        writable: false,
      });
    },
    {
      account: E2E_WALLET,
      chainIdHex: initialChainIdHex,
      connected: initialConnected,
      transactionHashes: [APPROVAL_TX_HASH, BUY_TX_HASH, SELL_TX_HASH, LAUNCH_TX_HASH, CLAIM_TX_HASH],
    },
  );
}
