import { CreatorAttribution } from '@bread/ui';

import {
  formatUsdcBaseUnits,
  shortAddress,
  toTokenCardModel,
  type IndexedFeedCardFields,
} from './explore/model';

export function TokenCard({ item }: Readonly<{ item: IndexedFeedCardFields }>) {
  const model = toTokenCardModel(item);
  const progressWidth = model.progress ? `${model.progress.percent}%` : '0%';

  return (
    <a className="bread-token-card" href={`/token/${encodeURIComponent(model.tokenAddress)}`}>
      <div className="bread-token-card__identity">
        <div>
          <strong>{model.name}</strong>
          <span>${model.symbol}</span>
        </div>
        <code className="bread-technical" title={model.tokenAddress}>
          {shortAddress(model.tokenAddress)}
        </code>
      </div>

      <CreatorAttribution creatorAddress={model.creatorAddress} />

      <dl className="bread-token-card__metrics">
        <div>
          <dt>Indexed price ratio</dt>
          <dd className="bread-technical bread-financial-value">
            {model.price ? `${model.price.numerator} / ${model.price.denominator}` : '—'}
          </dd>
        </div>
        <div>
          <dt>24h volume</dt>
          <dd className="bread-financial-value">{formatUsdcBaseUnits(model.volume24h)}</dd>
        </div>
        <div>
          <dt>24h change</dt>
          <dd>—</dd>
        </div>
      </dl>

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
    </a>
  );
}
