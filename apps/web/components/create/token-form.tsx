'use client';

import { useId, type FormEvent } from 'react';

export type CreateTokenDraft = Readonly<{
  image: string;
  name: string;
  ticker: string;
  description: string;
  website: string;
  x: string;
  telegram: string;
  creatorTaxPercent: string;
  initialBuyUsdc: string;
  buybackEnabled: false;
}>;

export type CreateFormStage = 'TOKEN' | 'ECONOMICS';

export type CreateEconomicsModel = Readonly<{
  quoteAsset: 'USDC';
  launchFee: string;
  graduationTarget: string;
  creatorRevenueWallet: `0x${string}`;
  maxCreatorTax: string;
}>;

export const EMPTY_CREATE_TOKEN_DRAFT: CreateTokenDraft = {
  image: '',
  name: '',
  ticker: '',
  description: '',
  website: '',
  x: '',
  telegram: '',
  creatorTaxPercent: '0',
  initialBuyUsdc: '',
  buybackEnabled: false,
};

export function TokenForm({
  stage,
  draft,
  economics = null,
  disabled = false,
  error = null,
  onChange,
  onContinue,
  onBack,
  onReview,
}: Readonly<{
  stage: CreateFormStage;
  draft: CreateTokenDraft;
  economics?: CreateEconomicsModel | null;
  disabled?: boolean;
  error?: string | null;
  onChange: (draft: CreateTokenDraft) => void;
  onContinue: () => void;
  onBack: () => void;
  onReview: () => void;
}>) {
  const errorId = useId();

  function update<K extends keyof CreateTokenDraft>(key: K, value: CreateTokenDraft[K]) {
    onChange({ ...draft, [key]: value });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    if (stage === 'TOKEN') onContinue();
    else onReview();
  }

  const unavailable = 'Connect on Arc to load current canonical value';

  return (
    <form
      className="bread-create-form"
      aria-describedby={error ? errorId : undefined}
      onSubmit={submit}
    >
      <header className="bread-create-form__heading">
        <p className="bread-create-eyebrow">{stage === 'TOKEN' ? 'Step 1 of 3' : 'Step 2 of 3'}</p>
        <h1>{stage === 'TOKEN' ? 'Token details' : 'Economics'}</h1>
        <p>
          {stage === 'TOKEN'
            ? 'Set the token identity and optional launch-and-buy amount.'
            : 'Confirm creator economics against the current canonical Bread deployment.'}
        </p>
      </header>

      {stage === 'TOKEN' ? (
        <>
          <label className="bread-create-field">
            <span>Image</span>
            <span className="bread-create-field__hint">Use a public HTTPS image URL. File upload storage is not part of the current Bread runtime.</span>
            <input
              type="url"
              inputMode="url"
              value={draft.image}
              disabled={disabled}
              placeholder="https://…"
              onChange={(event) => update('image', event.target.value)}
            />
          </label>

          <div className="bread-create-field-row">
            <label className="bread-create-field">
              <span>Name</span>
              <input
                required
                value={draft.name}
                disabled={disabled}
                autoComplete="off"
                onChange={(event) => update('name', event.target.value)}
              />
            </label>
            <label className="bread-create-field">
              <span>Ticker</span>
              <input
                required
                value={draft.ticker}
                disabled={disabled}
                autoCapitalize="characters"
                autoComplete="off"
                onChange={(event) => update('ticker', event.target.value.toUpperCase())}
              />
            </label>
          </div>

          <label className="bread-create-field">
            <span>Description</span>
            <textarea
              value={draft.description}
              disabled={disabled}
              rows={5}
              onChange={(event) => update('description', event.target.value)}
            />
          </label>

          <fieldset className="bread-create-fieldset" disabled={disabled}>
            <legend>Links</legend>
            <label className="bread-create-field">
              <span>Website</span>
              <input type="url" inputMode="url" value={draft.website} onChange={(event) => update('website', event.target.value)} />
            </label>
            <label className="bread-create-field">
              <span>X</span>
              <input type="url" inputMode="url" value={draft.x} onChange={(event) => update('x', event.target.value)} />
            </label>
            <label className="bread-create-field">
              <span>Telegram</span>
              <input type="url" inputMode="url" value={draft.telegram} onChange={(event) => update('telegram', event.target.value)} />
            </label>
          </fieldset>

          <label className="bread-create-field">
            <span>Initial buy</span>
            <span className="bread-create-field__hint">Optional USDC amount for atomic Launch &amp; Buy.</span>
            <input
              type="text"
              inputMode="decimal"
              value={draft.initialBuyUsdc}
              disabled={disabled}
              placeholder="0"
              onChange={(event) => update('initialBuyUsdc', event.target.value)}
            />
          </label>
        </>
      ) : (
        <>
          <label className="bread-create-field">
            <span>Creator tax</span>
            <span className="bread-create-field__hint">
              Percentage applied under the current protocol maximum{economics ? ` (${economics.maxCreatorTax})` : ''}.
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={draft.creatorTaxPercent}
              disabled={disabled}
              onChange={(event) => update('creatorTaxPercent', event.target.value)}
            />
          </label>

          <div className="bread-create-field bread-create-buyback" aria-describedby="bread-create-buyback-note">
            <span>Buyback</span>
            <button type="button" role="switch" aria-checked="false" disabled>
              Off
            </button>
            <span id="bread-create-buyback-note" className="bread-create-field__hint">
              Buyback is unavailable in the current Bread stack; no buyback or vesting money path is being implied.
            </span>
          </div>

          <dl className="bread-create-economics-values">
            <div><dt>Quote asset</dt><dd>{economics?.quoteAsset ?? 'USDC'}</dd></div>
            <div><dt>Launch fee</dt><dd>{economics?.launchFee ?? unavailable}</dd></div>
            <div><dt>Graduation target</dt><dd>{economics?.graduationTarget ?? unavailable}</dd></div>
            <div>
              <dt>Creator revenue wallet</dt>
              <dd className="bread-technical">{economics?.creatorRevenueWallet ?? unavailable}</dd>
            </div>
          </dl>
        </>
      )}

      {error ? <p id={errorId} className="bread-create-error" role="alert">{error}</p> : null}

      <div className="bread-create-form__actions">
        {stage === 'ECONOMICS' ? (
          <button className="bread-create-secondary-action" type="button" disabled={disabled} onClick={onBack}>
            Back
          </button>
        ) : null}
        <button className="bread-create-primary-action" type="submit" disabled={disabled}>
          {stage === 'TOKEN' ? 'Continue' : 'Review'}
        </button>
      </div>
    </form>
  );
}
