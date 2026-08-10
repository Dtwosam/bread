'use client';

import { useState } from 'react';

import { Button } from '@bread/ui';
import { useTradeRuntime } from '../trade/trade-runtime';

export function WalletMenu({ onClose }: Readonly<{ onClose: () => void }>) {
  const runtime = useTradeRuntime();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function chooseWallet(connectorId: string) {
    if (!runtime) return;
    setPendingId(connectorId);
    setError(null);
    try {
      await runtime.connectWallet(connectorId);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Wallet connection failed.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="bread-wallet-menu" role="dialog" aria-label="Wallet options">
      <div className="bread-wallet-menu__heading">
        <strong>Choose a wallet</strong>
        <button type="button" aria-label="Close wallet options" onClick={onClose}>×</button>
      </div>
      <p className="bread-muted">
        Bread lists connector options detected by the wallet runtime. Detection alone is not a compatibility certification.
      </p>
      {runtime?.walletOptions.length ? (
        <div className="bread-wallet-menu__options">
          {runtime.walletOptions.map((option) => (
            <Button
              type="button"
              key={option.id}
              disabled={pendingId !== null}
              onClick={() => void chooseWallet(option.id)}
            >
              {pendingId === option.id ? 'Connecting…' : option.name}
            </Button>
          ))}
        </div>
      ) : (
        <p role="status">No browser wallet connector was detected.</p>
      )}
      {error ? <p className="bread-inline-error" role="alert">{error}</p> : null}
    </div>
  );
}
