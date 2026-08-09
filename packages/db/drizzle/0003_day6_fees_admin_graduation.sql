ALTER TABLE fee_credits ADD COLUMN IF NOT EXISTS token_address text;
ALTER TABLE fee_credits ADD COLUMN IF NOT EXISTS attribution_status text;
CREATE INDEX IF NOT EXISTS fee_credits_recipient_idx ON fee_credits (chain_id, recipient_address, block_number);
CREATE INDEX IF NOT EXISTS fee_credits_token_idx ON fee_credits (chain_id, token_address, block_number);
CREATE INDEX IF NOT EXISTS fee_claims_recipient_idx ON fee_claims (chain_id, recipient_address, block_number);

ALTER TABLE launch_state ADD COLUMN IF NOT EXISTS graduation_adapter text;
ALTER TABLE launch_state ADD COLUMN IF NOT EXISTS swept_usdc_amount numeric(78,0);
ALTER TABLE launch_state ADD COLUMN IF NOT EXISTS swept_token_amount numeric(78,0);
ALTER TABLE launch_state ADD COLUMN IF NOT EXISTS swept_at numeric(78,0);
ALTER TABLE launch_state ADD COLUMN IF NOT EXISTS graduation_failure_reason_hash text;
ALTER TABLE launch_state ADD COLUMN IF NOT EXISTS graduation_release_seed_usdc numeric(78,0);
ALTER TABLE launch_state ADD COLUMN IF NOT EXISTS graduation_release_token_out numeric(78,0);
ALTER TABLE launch_state ADD COLUMN IF NOT EXISTS position_manager text;
ALTER TABLE launch_state ADD COLUMN IF NOT EXISTS position_id numeric(78,0);
ALTER TABLE launch_state ADD COLUMN IF NOT EXISTS usdc_used numeric(78,0);
ALTER TABLE launch_state ADD COLUMN IF NOT EXISTS token_used numeric(78,0);
ALTER TABLE launch_state ADD COLUMN IF NOT EXISTS token_locked numeric(78,0);
ALTER TABLE launch_state ADD COLUMN IF NOT EXISTS usdc_dust numeric(78,0);
ALTER TABLE launch_state ADD COLUMN IF NOT EXISTS position_locked boolean;
ALTER TABLE launch_state ADD COLUMN IF NOT EXISTS token_supply_locked numeric(78,0);
ALTER TABLE launch_state ADD COLUMN IF NOT EXISTS rescue_recipient text;
ALTER TABLE launch_state ADD COLUMN IF NOT EXISTS rescue_usdc_amount numeric(78,0);
ALTER TABLE launch_state ADD COLUMN IF NOT EXISTS rescue_token_amount numeric(78,0);
ALTER TABLE launch_state ADD COLUMN IF NOT EXISTS graduation_completed_block numeric(78,0);
ALTER TABLE launch_state ADD COLUMN IF NOT EXISTS graduation_completed_log_index integer;

ALTER TABLE token_metrics ADD COLUMN IF NOT EXISTS graduation_progress_bps numeric(78,0);
ALTER TABLE token_metrics ADD COLUMN IF NOT EXISTS graduation_state text;

CREATE INDEX IF NOT EXISTS admin_events_chain_order_idx
  ON admin_events (chain_id, block_number, log_index);
