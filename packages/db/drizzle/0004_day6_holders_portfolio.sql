ALTER TABLE holder_snapshots
  ADD COLUMN IF NOT EXISTS last_transaction_hash text;

ALTER TABLE holder_snapshots
  ADD COLUMN IF NOT EXISTS last_log_index integer;

CREATE INDEX IF NOT EXISTS holder_snapshots_token_balance_idx
  ON holder_snapshots (chain_id, token_address, balance DESC, holder_address ASC);

CREATE INDEX IF NOT EXISTS holder_snapshots_wallet_idx
  ON holder_snapshots (chain_id, holder_address, token_address);
