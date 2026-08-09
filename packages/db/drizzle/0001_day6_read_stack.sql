CREATE TABLE IF NOT EXISTS event_journal (
  chain_id integer NOT NULL,
  transaction_hash text NOT NULL,
  log_index integer NOT NULL,
  block_number numeric(78,0) NOT NULL,
  block_hash text NOT NULL,
  block_timestamp numeric(78,0) NOT NULL,
  transaction_index integer NOT NULL,
  contract_address text NOT NULL,
  contract_role text NOT NULL,
  stack_version text NOT NULL,
  event_name text NOT NULL,
  topic0 text NOT NULL,
  topics jsonb NOT NULL,
  data text NOT NULL,
  payload jsonb NOT NULL,
  inserted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, transaction_hash, log_index)
);
CREATE INDEX IF NOT EXISTS event_journal_block_order_idx
  ON event_journal (chain_id, block_number, transaction_index, log_index);
CREATE INDEX IF NOT EXISTS event_journal_stack_idx
  ON event_journal (chain_id, stack_version, block_number);

CREATE TABLE IF NOT EXISTS protocol_stacks (
  chain_id integer NOT NULL,
  stack_version text NOT NULL,
  factory_address text NOT NULL,
  deployment_start_block numeric(78,0) NOT NULL,
  quote_asset text NOT NULL,
  quote_decimals integer NOT NULL,
  manifest_hash text,
  source_hash text,
  addresses jsonb NOT NULL,
  adapter_state jsonb,
  runtime_code_hashes jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, stack_version)
);

CREATE TABLE IF NOT EXISTS launches (
  chain_id integer NOT NULL,
  token_address text NOT NULL,
  curve_address text NOT NULL,
  stack_version text NOT NULL,
  factory_address text NOT NULL,
  deployer_address text,
  creator_fee_recipient text,
  creator_tax_bps numeric(78,0),
  economics_digest text,
  config_version numeric(78,0),
  name text,
  symbol text,
  metadata jsonb,
  launch_block_number numeric(78,0) NOT NULL,
  launch_transaction_hash text NOT NULL,
  launch_log_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, token_address)
);
CREATE INDEX IF NOT EXISTS launches_curve_idx ON launches (chain_id, curve_address);
CREATE INDEX IF NOT EXISTS launches_stack_idx ON launches (chain_id, stack_version, launch_block_number);

CREATE TABLE IF NOT EXISTS launch_state (
  chain_id integer NOT NULL,
  token_address text NOT NULL,
  mode text,
  quote_reserve numeric(78,0),
  token_reserve numeric(78,0),
  remaining_sellable_tokens numeric(78,0),
  tracked_sold_inventory numeric(78,0),
  ready_to_graduate boolean,
  graduation_phase text,
  pool_id text,
  retry_state jsonb,
  latest_block_number numeric(78,0),
  latest_transaction_hash text,
  latest_log_index integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, token_address)
);

CREATE TABLE IF NOT EXISTS trades (
  chain_id integer NOT NULL,
  transaction_hash text NOT NULL,
  log_index integer NOT NULL,
  token_address text NOT NULL,
  curve_address text NOT NULL,
  side text NOT NULL,
  trader_address text NOT NULL,
  recipient_address text NOT NULL,
  base_amount numeric(78,0) NOT NULL,
  quote_amount numeric(78,0) NOT NULL,
  fee_amount numeric(78,0) NOT NULL,
  tax_amount numeric(78,0) NOT NULL,
  block_number numeric(78,0) NOT NULL,
  transaction_index integer NOT NULL,
  stack_version text NOT NULL,
  PRIMARY KEY (chain_id, transaction_hash, log_index)
);
CREATE INDEX IF NOT EXISTS trades_token_order_idx
  ON trades (chain_id, token_address, block_number, log_index);

CREATE TABLE IF NOT EXISTS fee_credits (
  chain_id integer NOT NULL,
  transaction_hash text NOT NULL,
  log_index integer NOT NULL,
  recipient_address text NOT NULL,
  creditor_address text,
  amount numeric(78,0) NOT NULL,
  recipient_balance numeric(78,0),
  total_outstanding numeric(78,0),
  block_number numeric(78,0) NOT NULL,
  stack_version text NOT NULL,
  PRIMARY KEY (chain_id, transaction_hash, log_index)
);

CREATE TABLE IF NOT EXISTS fee_claims (
  chain_id integer NOT NULL,
  transaction_hash text NOT NULL,
  log_index integer NOT NULL,
  recipient_address text NOT NULL,
  amount numeric(78,0) NOT NULL,
  remaining_balance numeric(78,0),
  total_outstanding numeric(78,0),
  block_number numeric(78,0) NOT NULL,
  stack_version text NOT NULL,
  PRIMARY KEY (chain_id, transaction_hash, log_index)
);

CREATE TABLE IF NOT EXISTS creator_rollups (
  chain_id integer NOT NULL,
  creator_address text NOT NULL,
  token_address text NOT NULL,
  accrued_fees numeric(78,0) NOT NULL DEFAULT 0,
  claimed_fees numeric(78,0) NOT NULL DEFAULT 0,
  trade_count numeric(78,0) NOT NULL DEFAULT 0,
  latest_block_number numeric(78,0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, creator_address, token_address)
);

CREATE TABLE IF NOT EXISTS holder_snapshots (
  chain_id integer NOT NULL,
  token_address text NOT NULL,
  holder_address text NOT NULL,
  balance numeric(78,0) NOT NULL,
  is_protocol_address boolean NOT NULL DEFAULT false,
  as_of_block_number numeric(78,0) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, token_address, holder_address)
);

CREATE TABLE IF NOT EXISTS market_candles (
  chain_id integer NOT NULL,
  token_address text NOT NULL,
  interval_seconds integer NOT NULL,
  bucket_start numeric(78,0) NOT NULL,
  open numeric(78,0) NOT NULL,
  high numeric(78,0) NOT NULL,
  low numeric(78,0) NOT NULL,
  close numeric(78,0) NOT NULL,
  base_volume numeric(78,0) NOT NULL,
  quote_volume numeric(78,0) NOT NULL,
  trade_count numeric(78,0) NOT NULL,
  PRIMARY KEY (chain_id, token_address, interval_seconds, bucket_start)
);

CREATE TABLE IF NOT EXISTS token_metrics (
  chain_id integer NOT NULL,
  token_address text NOT NULL,
  price numeric(78,0),
  market_cap numeric(78,0),
  holder_count numeric(78,0),
  trade_count numeric(78,0),
  quote_volume numeric(78,0),
  latest_block_number numeric(78,0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, token_address)
);

CREATE TABLE IF NOT EXISTS indexer_checkpoints (
  chain_id integer NOT NULL,
  stack_version text NOT NULL,
  indexed_through_block numeric(78,0) NOT NULL,
  indexed_through_block_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, stack_version)
);

CREATE TABLE IF NOT EXISTS admin_events (
  chain_id integer NOT NULL,
  transaction_hash text NOT NULL,
  log_index integer NOT NULL,
  contract_address text NOT NULL,
  event_name text NOT NULL,
  actor_address text,
  payload jsonb NOT NULL,
  block_number numeric(78,0) NOT NULL,
  stack_version text NOT NULL,
  PRIMARY KEY (chain_id, transaction_hash, log_index)
);

CREATE TABLE IF NOT EXISTS metadata (
  chain_id integer NOT NULL,
  token_address text NOT NULL,
  metadata_uri text,
  metadata_json jsonb,
  content_hash text,
  fetched_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, token_address)
);
