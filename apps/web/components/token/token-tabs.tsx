'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import type {
  IndexedResponse,
  IndexedTokenDetail,
  IndexedTokenHolders,
  IndexedTokenTrade,
} from '../../../../packages/types/src/index';
import { createBreadApiClient } from '../../lib/api/client';
import { breadQueryKeys } from '../../lib/api/queries';
import { FreshnessBanner } from '../freshness-banner';
import { formatUsdcBaseUnits } from '../explore/model';

type TokenTab = 'trades' | 'holders' | 'info';

export function TokenTabs({ token }: Readonly<{ token: IndexedTokenDetail }>) {
  const tokenAddress = token.tokenAddress;
  const [activeTab, setActiveTab] = useState<TokenTab>('trades');
  const api = useMemo(() => createBreadApiClient(), []);

  const tradesQuery = useQuery({
    queryKey: breadQueryKeys.trades(tokenAddress, { limit: 25 }),
    queryFn: () => api.getTrades<readonly IndexedTokenTrade[]>(tokenAddress, { limit: 25 }),
    enabled: activeTab === 'trades',
  });

  const holdersQuery = useQuery({
    queryKey: breadQueryKeys.holders(tokenAddress, { limit: 25 }),
    queryFn: () => api.getHolders<IndexedTokenHolders>(tokenAddress, { limit: 25 }),
    enabled: activeTab === 'holders',
  });

  return (
    <section className="bread-token-tabs" aria-labelledby="bread-token-tabs-heading">
      <h2 className="bread-visually-hidden" id="bread-token-tabs-heading">
        Token details
      </h2>
      <div className="bread-token-tablist" role="tablist" aria-label="Token details">
        {(['trades', 'holders', 'info'] as const).map((tab) => (
          <button
            className="bread-token-tab"
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            key={tab}
            onClick={() => setActiveTab(tab)}
          >
            {tab[0].toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="bread-token-tabpanel" role="tabpanel">
        {activeTab === 'trades' ? (
          <TradesPanel query={tradesQuery} />
        ) : activeTab === 'holders' ? (
          <HoldersPanel query={holdersQuery} />
        ) : (
          <InfoPanel token={token} />
        )}
      </div>
    </section>
  );
}

function TradesPanel({
  query,
}: Readonly<{
  query: UseQueryResult<IndexedResponse<readonly IndexedTokenTrade[]>, Error>;
}>) {
  if (query.isPending) return <p className="bread-token-note">Loading trades…</p>;
  if (query.isError) return <p className="bread-inline-error">Trades are unavailable right now.</p>;

  const response = query.data;
  return (
    <>
      <FreshnessBanner meta={response.meta} />
      {response.data.length === 0 ? (
        <p className="bread-token-note">No indexed trades yet.</p>
      ) : (
        <div className="bread-token-table" role="table" aria-label="Recent token trades">
          <div className="bread-token-table__head" role="row">
            <span role="columnheader">Side</span>
            <span role="columnheader">Quote</span>
            <span role="columnheader">Tokens</span>
            <span role="columnheader">Trader</span>
          </div>
          {response.data.map((trade) => (
            <div className="bread-token-table__row" role="row" key={`${trade.transactionHash}:${trade.logIndex}`}>
              <strong role="cell">{trade.side}</strong>
              <span role="cell">{formatUsdcBaseUnits(trade.quoteAmount)}</span>
              <span role="cell">{trade.tokenAmount}</span>
              <code role="cell" className="bread-technical">
                {trade.actor}
              </code>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function HoldersPanel({
  query,
}: Readonly<{
  query: UseQueryResult<IndexedResponse<IndexedTokenHolders>, Error>;
}>) {
  if (query.isPending) return <p className="bread-token-note">Loading holders…</p>;
  if (query.isError) return <p className="bread-inline-error">Holders are unavailable right now.</p>;

  const response = query.data;
  return (
    <>
      <FreshnessBanner meta={response.meta} />
      <div className="bread-token-holder-summary">
        <span>Indexed holders</span>
        <strong>{response.data.concentration.holderCount}</strong>
        <span>Top 10 non-protocol balance</span>
        <strong>{response.data.concentration.top10NonProtocolBalance}</strong>
      </div>
      {response.data.holders.length === 0 ? (
        <p className="bread-token-note">No indexed holders yet.</p>
      ) : (
        <div className="bread-token-table" role="table" aria-label="Token holders">
          <div className="bread-token-table__head" role="row">
            <span role="columnheader">Wallet</span>
            <span role="columnheader">Holding</span>
            <span role="columnheader">Protocol</span>
          </div>
          {response.data.holders.map((holder) => (
            <div
              className="bread-token-table__row bread-token-table__row--holders"
              role="row"
              key={holder.walletAddress}
            >
              <code role="cell" className="bread-technical">
                {holder.walletAddress}
              </code>
              <span role="cell">{holder.balance}</span>
              <span role="cell">{holder.isProtocolAddress ? 'Yes' : 'No'}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function MetadataLink({ href, label }: Readonly<{ href: string; label: string }>) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {label}
    </a>
  );
}

function InfoPanel({ token }: Readonly<{ token: IndexedTokenDetail }>) {
  const facts = [
    ['Contract', token.tokenAddress],
    ['Quote asset', token.quoteAsset ?? '—'],
    ['Creator', token.deployerAddress ?? '—'],
    ['Creator tax', token.creatorTaxBps === null ? '—' : `${token.creatorTaxBps} bps`],
    ['Buyback', '—'],
    ['Protocol version', token.stackVersion],
    ['Graduation adapter', token.curveState?.graduationAdapter ?? token.graduationAdapter ?? '—'],
  ] as const;
  const links = [
    token.metadata.website ? { label: 'Website', href: token.metadata.website } : null,
    token.metadata.x ? { label: 'X', href: token.metadata.x } : null,
    token.metadata.telegram ? { label: 'Telegram', href: token.metadata.telegram } : null,
  ].filter((entry): entry is { label: string; href: string } => entry !== null);

  return (
    <dl className="bread-token-info">
      {facts.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
      <div>
        <dt>Description</dt>
        <dd>{token.metadata.description ?? '—'}</dd>
      </div>
      <div>
        <dt>Social links</dt>
        <dd>
          {links.length === 0
            ? '—'
            : links.map((link, index) => (
                <span key={link.label}>
                  {index === 0 ? null : ' · '}
                  <MetadataLink href={link.href} label={link.label} />
                </span>
              ))}
        </dd>
      </div>
    </dl>
  );
}
