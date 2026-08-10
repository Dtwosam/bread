'use client';

import { Button } from '@bread/ui';

import { useTradeRuntime } from '../trade/trade-runtime';

export function NetworkSwitcher() {
  const runtime = useTradeRuntime();
  if (!runtime || runtime.connectionStatus !== 'WRONG_NETWORK') return null;

  return (
    <Button
      type="button"
      ariaLabel="Switch wallet to Arc Testnet"
      onClick={() => void runtime.switchToTargetChain()}
    >
      Switch to Arc
    </Button>
  );
}
