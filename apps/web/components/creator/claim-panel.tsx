'use client';

import { formatUnits } from 'viem';

import { Button, Card } from '@bread/ui';
import type { ClaimReview } from '../../lib/transactions/claim-controller';

export function ClaimPanel({
  recipient,
  indexedClaimable,
  review,
  busy,
  error,
  onReview,
}: Readonly<{
  recipient: `0x${string}`;
  indexedClaimable: string;
  review: ClaimReview | null;
  busy: boolean;
  error: string | null;
  onReview: () => void;
}>) {
  return (
    <Card className="bread-creator-claim-panel">
      <div>
        <span className="bread-muted">Indexed claimable</span>
        <strong>{formatUnits(BigInt(indexedClaimable), 6)} USDC</strong>
        <p className="bread-muted">Indexed revenue is a projection. Review rereads FeeEscrow before signing.</p>
      </div>

      <dl>
        <div>
          <dt>Claimable USDC</dt>
          <dd>{review ? `${formatUnits(review.claimableUsdc, 6)} USDC` : 'Review required'}</dd>
        </div>
        <div>
          <dt>Recipient</dt>
          <dd>{recipient}</dd>
        </div>
      </dl>

      {error ? <p role="alert">{error}</p> : null}
      <Button type="button" disabled={busy} onClick={onReview}>
        {busy ? 'Reviewing claim…' : 'Review claim'}
      </Button>
    </Card>
  );
}
