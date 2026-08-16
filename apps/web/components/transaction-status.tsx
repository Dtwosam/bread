import arcTestnetManifest from '../../../config/networks/arc-testnet.json';
import type { TransactionState } from '../lib/transactions/state';

const STATUS_COPY = {
  IDLE: 'Ready to review.',
  VALIDATING: 'Validating wallet and network…',
  PREPARING: 'Refreshing current onchain state and simulating…',
  AWAITING_SIGNATURE: 'Awaiting wallet signature…',
  SUBMITTED: 'Submitted. Transaction hash saved for recovery.',
  CONFIRMING: 'Waiting for onchain confirmation…',
  CONFIRMED: 'Confirmed onchain. Refreshing indexed state…',
  REJECTED: 'Wallet request rejected or precondition not met.',
  REVERTED: 'Transaction reverted.',
  REPLACED: 'Transaction was replaced in the wallet.',
  UNKNOWN: 'Confirmation is unknown. The transaction hash is saved for recovery.',
} as const;

const EXPLORER_URL = arcTestnetManifest.explorer.replace(/\/+$/, '');

export function TransactionStatus({ state }: Readonly<{ state: TransactionState }>) {
  return (
    <div className={`bread-transaction-status bread-transaction-status--${state.status.toLowerCase()}`} role="status" aria-live="polite">
      <strong>{state.status}</strong>
      <span>{state.error ?? STATUS_COPY[state.status]}</span>
      {state.hash ? (
        <>
          <code className="bread-technical">{state.hash}</code>
          <a
            className="bread-transaction-link"
            href={`${EXPLORER_URL}/tx/${state.hash}`}
            target="_blank"
            rel="noreferrer"
            aria-label="View transaction on Arcscan"
          >
            View on Arcscan
          </a>
        </>
      ) : null}
    </div>
  );
}
