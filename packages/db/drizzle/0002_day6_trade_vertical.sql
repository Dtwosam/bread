ALTER TABLE trades ADD COLUMN IF NOT EXISTS block_timestamp numeric(78,0);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS offered_quote numeric(78,0);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS opening_tax_bps numeric(78,0);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS opening_tax_amount numeric(78,0);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS launch_buy_exempt boolean;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS refund_amount numeric(78,0);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS net_curve_input numeric(78,0);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS net_quote_out numeric(78,0);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS gross_curve_quote_out numeric(78,0);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS execution_price_numerator numeric(78,0);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS execution_price_denominator numeric(78,0);
CREATE INDEX IF NOT EXISTS trades_token_reverse_order_idx
  ON trades (chain_id, token_address, block_number DESC, transaction_index DESC, log_index DESC);
CREATE INDEX IF NOT EXISTS trades_token_time_idx
  ON trades (chain_id, token_address, block_timestamp DESC);

ALTER TABLE launch_state ADD COLUMN IF NOT EXISTS tracked_quote numeric(78,0);
ALTER TABLE launch_state ADD COLUMN IF NOT EXISTS tracked_tokens numeric(78,0);
ALTER TABLE launch_state ADD COLUMN IF NOT EXISTS quote_fee_balance numeric(78,0);
ALTER TABLE launch_state ADD COLUMN IF NOT EXISTS creator_tax_balance numeric(78,0);
ALTER TABLE launch_state ADD COLUMN IF NOT EXISTS real_quote_reserve numeric(78,0);
ALTER TABLE launch_state ADD COLUMN IF NOT EXISTS virtual_quote_reserve numeric(78,0);

ALTER TABLE market_candles ALTER COLUMN open DROP NOT NULL;
ALTER TABLE market_candles ALTER COLUMN high DROP NOT NULL;
ALTER TABLE market_candles ALTER COLUMN low DROP NOT NULL;
ALTER TABLE market_candles ALTER COLUMN close DROP NOT NULL;
ALTER TABLE market_candles ADD COLUMN IF NOT EXISTS open_price_numerator numeric(78,0);
ALTER TABLE market_candles ADD COLUMN IF NOT EXISTS open_price_denominator numeric(78,0);
ALTER TABLE market_candles ADD COLUMN IF NOT EXISTS high_price_numerator numeric(78,0);
ALTER TABLE market_candles ADD COLUMN IF NOT EXISTS high_price_denominator numeric(78,0);
ALTER TABLE market_candles ADD COLUMN IF NOT EXISTS low_price_numerator numeric(78,0);
ALTER TABLE market_candles ADD COLUMN IF NOT EXISTS low_price_denominator numeric(78,0);
ALTER TABLE market_candles ADD COLUMN IF NOT EXISTS close_price_numerator numeric(78,0);
ALTER TABLE market_candles ADD COLUMN IF NOT EXISTS close_price_denominator numeric(78,0);

ALTER TABLE token_metrics ADD COLUMN IF NOT EXISTS last_price_numerator numeric(78,0);
ALTER TABLE token_metrics ADD COLUMN IF NOT EXISTS last_price_denominator numeric(78,0);
ALTER TABLE token_metrics ADD COLUMN IF NOT EXISTS last_price_source text;
ALTER TABLE token_metrics ADD COLUMN IF NOT EXISTS quote_volume_5m numeric(78,0);
ALTER TABLE token_metrics ADD COLUMN IF NOT EXISTS quote_volume_1h numeric(78,0);
ALTER TABLE token_metrics ADD COLUMN IF NOT EXISTS quote_volume_24h numeric(78,0);
ALTER TABLE token_metrics ADD COLUMN IF NOT EXISTS trade_count_1h numeric(78,0);
ALTER TABLE token_metrics ADD COLUMN IF NOT EXISTS trade_count_24h numeric(78,0);
ALTER TABLE token_metrics ADD COLUMN IF NOT EXISTS unique_traders_1h numeric(78,0);
ALTER TABLE token_metrics ADD COLUMN IF NOT EXISTS unique_traders_24h numeric(78,0);
ALTER TABLE token_metrics ADD COLUMN IF NOT EXISTS last_activity_transaction_index integer;
ALTER TABLE token_metrics ADD COLUMN IF NOT EXISTS last_activity_log_index integer;
