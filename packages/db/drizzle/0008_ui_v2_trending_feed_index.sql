CREATE INDEX IF NOT EXISTS trades_stack_time_feed_idx
  ON trades (chain_id, stack_version, block_timestamp DESC, token_address, block_number DESC, log_index DESC)
  INCLUDE (quote_amount, trader_address);
