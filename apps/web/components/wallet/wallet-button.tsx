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

  if (runtime?.connectionStatus === 'READY' && runtime.account) {
    return (
      <Button type="button" ariaLabel={`Connected wallet ${runtime.account}`} onClick={() => setOpen((value) => !value)}>
        {shortAddress(runtime.account)}
      </Button>
    );
  }

  return (
    <div className="bread-wallet-control">
      <Button
        type="button"
        disabled={!runtime}
        ariaLabel="Connect wallet"
        onClick={() => setOpen((value) => !value)}
      >
        Connect wallet
      </Button>
      {open ? <WalletMenu onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
