/* eslint-disable @next/next/no-img-element */
import type { IndexedTokenDetail } from '../../../../packages/types/src/index';
import { CreatorAttribution } from '@bread/ui';

function launchTime(timestamp: string | null): string {
  if (timestamp === null || !/^\d+$/.test(timestamp)) return '—';
  const milliseconds = Number(timestamp) * 1_000;
  if (!Number.isFinite(milliseconds)) return '—';
  return new Date(milliseconds).toLocaleString();
}

export function TokenIdentity({ token }: Readonly<{ token: IndexedTokenDetail }>) {
  const metadata = token.metadata;
  const initial = (token.symbol?.trim() || token.name?.trim() || '?').slice(0, 1).toUpperCase();
  const links = [
    metadata.website ? { label: 'Website', href: metadata.website } : null,
    metadata.x ? { label: 'X', href: metadata.x } : null,
    metadata.telegram ? { label: 'Telegram', href: metadata.telegram } : null,
  ].filter((link): link is { label: string; href: string } => link !== null);

  return (
    <section className="bread-token-identity" aria-labelledby="bread-token-name">
      <div className="bread-token-identity__mark" aria-hidden="true">
        {metadata.image ? (
          <img src={metadata.image} alt="" width="56" height="56" />
        ) : (
          initial
        )}
      </div>
      <div className="bread-token-identity__copy">
        <div className="bread-token-identity__title-row">
          <h1 id="bread-token-name">{token.name?.trim() || 'Unnamed token'}</h1>
          <span>{token.symbol?.trim() ? `$${token.symbol.trim()}` : '—'}</span>
        </div>
        {metadata.description ? (
          <p className="bread-token-identity__description">{metadata.description}</p>
        ) : null}
        {links.length > 0 ? (
          <nav className="bread-token-identity__links" aria-label="Token links">
            {links.map((link) => (
              <a key={link.label} href={link.href} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            ))}
          </nav>
        ) : null}
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
