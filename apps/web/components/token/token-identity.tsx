import type { IndexedTokenDetail } from '../../../../packages/types/src/index';
import { CreatorAttribution } from '@bread/ui';

function launchTime(timestamp: string | null): string {
  if (timestamp === null || !/^\d+$/.test(timestamp)) return '—';
  const milliseconds = Number(timestamp) * 1_000;
  if (!Number.isFinite(milliseconds)) return '—';
  return new Date(milliseconds).toLocaleString();
}

export function TokenIdentity({ token }: Readonly<{ token: IndexedTokenDetail }>) {
  return (
    <section className="bread-token-identity" aria-labelledby="bread-token-name">
      <div className="bread-token-identity__mark" aria-hidden="true">
        {(token.symbol?.trim() || token.name?.trim() || '?').slice(0, 1).toUpperCase()}
      </div>
      <div className="bread-token-identity__copy">
        <div className="bread-token-identity__title-row">
          <h1 id="bread-token-name">{token.name?.trim() || 'Unnamed token'}</h1>
          <span>{token.symbol?.trim() ? `$${token.symbol.trim()}` : '—'}</span>
        </div>
        <dl className="bread-token-identity__meta">
          <div>
            <dt>Contract</dt>
            <dd>
              <code className="bread-technical">{token.tokenAddress}</code>
            </dd>
          </div>
          <div>
            <dt>Creator</dt>
            <dd>
              <CreatorAttribution creatorAddress={token.deployerAddress} size="token-header" />
            </dd>
          </div>
          <div>
            <dt>Launched</dt>
            <dd>{launchTime(token.launchTimestamp)}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
