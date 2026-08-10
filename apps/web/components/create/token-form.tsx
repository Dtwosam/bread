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
  draft,
  disabled = false,
  error = null,
  onChange,
  onReview,
}: Readonly<{
  draft: CreateTokenDraft;
  disabled?: boolean;
  error?: string | null;
  onChange: (draft: CreateTokenDraft) => void;
  onReview: () => void;
}>) {
  const errorId = useId();

  function update<K extends keyof CreateTokenDraft>(key: K, value: CreateTokenDraft[K]) {
    onChange({ ...draft, [key]: value });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!disabled) onReview();
  }

  return (
    <form
      className="bread-create-form"
      aria-describedby={error ? errorId : undefined}
      onSubmit={submit}
    >
      <header className="bread-create-form__heading">
        <p className="bread-create-eyebrow">Create</p>
        <h1>Create a token</h1>
        <p>Set the creator-owned token details. Protocol economics are loaded separately from the current Bread deployment.</p>
      </header>

      <label className="bread-create-field">
        <span>Image</span>
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
        <span>Creator tax</span>
        <span className="bread-create-field__hint">Percentage applied under the current protocol maximum.</span>
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

      {error ? <p id={errorId} className="bread-create-error" role="alert">{error}</p> : null}

      <button className="bread-create-primary-action" type="submit" disabled={disabled}>
        Review
      </button>
    </form>
  );
}
