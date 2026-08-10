'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';

import { Button } from '@bread/ui';
import { useTradeRuntime } from '../trade/trade-runtime';
import { NetworkSwitcher } from './network-switcher';

const WalletMenu = dynamic(() => import('./wallet-menu').then((module) => module.WalletMenu), {
  ssr: false,
  loading: () => null,
});

function shortAddress(address: `0x${string}`): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletButton() {
  const runtime = useTradeRuntime();
  const [open, setOpen] = useState(false);

  if (runtime?.connectionStatus === 'WRONG_NETWORK') {
    return <NetworkSwitcher />;
  }

  const connected = runtime?.connectionStatus === 'READY' && runtime.account;
  const label = connected ? shortAddress(connected) : 'Connect wallet';
  const ariaLabel = connected ? `Connected wallet ${connected}` : 'Connect wallet';

  return (
    <div className="bread-wallet-control">
      <Button
        type="button"
        disabled={!runtime}
        ariaLabel={ariaLabel}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </Button>
      {open ? <WalletMenu onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
