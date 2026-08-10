'use client';

export type LaunchReviewModel = Readonly<{
  fixedSupply: string;
  quoteCurrency: string;
  creatorTax: string;
  buyback: 'Off — unavailable in current Bread stack';
  initialBuy: string;
  launchFee: string;
  graduationTarget: string;
  creatorRevenueWallet: `0x${string}`;
  permanentLiquidityLock: string;
  launchAndBuy: boolean;
  initialBuyConsequences?: Readonly<{
    expectedOutput: string;
    minimumOutput: string;
    baseFee: string;
    creatorTax: string;
    openingTax: string;
    priceImpact: string;
    slippage: string;
  }>;
}>;

export function LaunchReview({
  review,
  disabled = false,
  onBack,
  onLaunch,
}: Readonly<{
  review: LaunchReviewModel | null;
  disabled?: boolean;
  onBack: () => void;
  onLaunch: () => void;
}>) {
  const unavailable = 'Not prepared from the current protocol deployment';

  return (
    <section className="bread-launch-review" aria-labelledby="bread-launch-review-heading">
      <header className="bread-launch-review__heading">
        <p className="bread-create-eyebrow">Review</p>
        <h1 id="bread-launch-review-heading">Review launch</h1>
        <p>
          Confirm creator inputs and canonical protocol values before opening your wallet. Unprepared
          values are never replaced with guessed economics.
        </p>
      </header>

      <dl className="bread-launch-review__values">
        <div><dt>Fixed supply</dt><dd>{review?.fixedSupply ?? unavailable}</dd></div>
        <div><dt>Quote currency</dt><dd>{review?.quoteCurrency ?? unavailable}</dd></div>
        <div><dt>Creator tax</dt><dd>{review?.creatorTax ?? unavailable}</dd></div>
        <div><dt>Buyback</dt><dd>{review?.buyback ?? 'Off — unavailable in current Bread stack'}</dd></div>
        <div><dt>Initial buy</dt><dd>{review?.initialBuy ?? unavailable}</dd></div>
        <div><dt>Launch fee</dt><dd>{review?.launchFee ?? unavailable}</dd></div>
        <div><dt>Graduation target</dt><dd>{review?.graduationTarget ?? unavailable}</dd></div>
        <div><dt>Creator revenue wallet</dt><dd>{review?.creatorRevenueWallet ?? unavailable}</dd></div>
        <div><dt>Permanent liquidity lock</dt><dd>{review?.permanentLiquidityLock ?? unavailable}</dd></div>
      </dl>

      {review?.initialBuyConsequences ? (
        <section className="bread-launch-review__initial-buy" aria-labelledby="bread-launch-buy-review-heading">
          <h2 id="bread-launch-buy-review-heading">Launch &amp; Buy details</h2>
          <dl className="bread-launch-review__values">
            <div><dt>Expected output</dt><dd>{review.initialBuyConsequences.expectedOutput}</dd></div>
            <div><dt>Minimum output</dt><dd>{review.initialBuyConsequences.minimumOutput}</dd></div>
            <div><dt>Base fee</dt><dd>{review.initialBuyConsequences.baseFee}</dd></div>
            <div><dt>Creator tax</dt><dd>{review.initialBuyConsequences.creatorTax}</dd></div>
            <div><dt>Opening buy tax</dt><dd>{review.initialBuyConsequences.openingTax}</dd></div>
            <div><dt>Price impact</dt><dd>{review.initialBuyConsequences.priceImpact}</dd></div>
            <div><dt>Slippage</dt><dd>{review.initialBuyConsequences.slippage}</dd></div>
          </dl>
        </section>
      ) : null}

      {!review ? (
        <p className="bread-launch-review__unavailable" role="status">
          Launch is unavailable until Bread can resolve and validate the current protocol deployment.
        </p>
      ) : null}

      <div className="bread-launch-review__actions">
        <button type="button" className="bread-create-secondary-action" disabled={disabled} onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="bread-create-primary-action"
          disabled={disabled || review === null}
          onClick={onLaunch}
        >
          {review?.launchAndBuy ? 'Launch & Buy' : 'Launch'}
        </button>
      </div>
    </section>
  );
}
