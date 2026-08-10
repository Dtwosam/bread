'use client';

import type { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';

import { breadWagmiConfig } from '../../lib/wallet/config';
import { WalletTradeProvider } from '../trade/wallet-trade-provider';

/**
 * The single browser-wallet composition boundary.
 *
 * WalletTradeProvider remains the accepted transaction/recovery owner from
 * Task 5; this wrapper only gives the rest of the product a wallet-named
 * boundary without introducing a second runtime or state machine.
 */
export function WalletProvider({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <WagmiProvider config={breadWagmiConfig}>
      <WalletTradeProvider>{children}</WalletTradeProvider>
    </WagmiProvider>
  );
}
