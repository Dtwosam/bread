import { CreatorAttribution } from '@bread/ui';

import {
  formatIndexedAge,
  formatUsdcBaseUnits,
  shortAddress,
  toTokenCardModel,
  type IndexedFeedCardFields,
} from './explore/model';

const GRADUATED_VENUE_LABELS: Readonly<Record<string, string>> = {
  UNISWAP_V3: 'Uniswap V3',
};

export function TokenCard({
  item,
  indexedThroughBlockTimestamp,
}: Readonly<{
  item: IndexedFeedCardFields;
  indexedThroughBlockTimestamp: string | null;
}>) {
  const model = toTokenCardModel(item);
  const age = formatIndexedAge(item.launchTimestamp, indexedThroughBlockTimestamp);
  const progressWidth = model.progress ? `${model.progress.percent}%` : '0%';
  const graduatedVenueLabel = model.graduatedVenueKind
    ? GRADUATED_VENUE_LABELS[model.graduatedVenueKind]
    : undefined;
  const tokenInitial = (model.symbol !== '—' ? model.symbol : model.name).slice(0, 1).toUpperCase();

  return (
    <a className="bread-token-card" href={`/token/${encodeURIComponent(model.tokenAddress)}`}>
      <div className="bread-token-card__identity">
        <span className="bread-token-card__image" aria-hidden="true">{tokenInitial || '?'}</span>
        <div className="bread-token-card__identity-copy">
          <strong>{model.name}</strong>
          <span>${model.symbol} · {age}</span>
          <code className="bread-technical" title={model.tokenAddress}>
            {shortAddress(model.tokenAddress)}
          </code>
        </div>
      </div>

      <CreatorAttribution creatorAddress={model.creatorAddress} />

      <dl className="bread-token-card__market">
        <div>
          <dt>Market cap</dt>
          <dd className="bread-financial-value">{formatUsdcBaseUnits(model.marketCap)}</dd>
        </div>
        <div>
          <dt>24h change</dt>
          <dd className="bread-financial-value">—</dd>
        </div>
      </dl>

      <dl className="bread-token-card__metrics">
        <div>
          <dt>24h volume</dt>
          <dd className="bread-financial-value">{formatUsdcBaseUnits(model.volume24h)}</dd>
        </div>
        <div>
          <dt>Holders</dt>
          <dd className="bread-financial-value">{model.holderCount ?? '—'}</dd>
        </div>
      </dl>

      {model.progress?.state === 'GRADUATED' ? (
        <div
          className="bread-token-card__graduated bread-token-card__progress-line"
          aria-label="Graduated trading venue"
        >
          <span>Graduated</span>
          {graduatedVenueLabel ? <span>{graduatedVenueLabel}</span> : null}
        </div>
      ) : (
        <div className="bread-token-card__progress" aria-label="Graduation progress">
          <div className="bread-token-card__progress-line">
            <span>Graduation</span>
            <span className="bread-financial-value">
              {model.progress ? `${model.progress.percent.toFixed(2).replace(/\.00$/, '')}%` : '—'}
            </span>
          </div>
          <div className="bread-progress-track" aria-hidden="true">
            <span className="bread-progress-value" style={{ width: progressWidth }} />
          </div>
        </div>
      )}
    </a>
  );
}
