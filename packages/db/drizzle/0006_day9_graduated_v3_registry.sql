ALTER TABLE launch_state
  ADD COLUMN IF NOT EXISTS graduated_venue_kind text;

ALTER TABLE launch_state
  ADD COLUMN IF NOT EXISTS graduated_venue_address text;

ALTER TABLE launch_state
  ADD COLUMN IF NOT EXISTS graduated_venue_fee_tier integer;

ALTER TABLE launch_state
  ADD COLUMN IF NOT EXISTS graduation_completed_transaction_index integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'launch_state_graduated_venue_tuple_check'
      AND conrelid = 'launch_state'::regclass
  ) THEN
    ALTER TABLE launch_state
      ADD CONSTRAINT launch_state_graduated_venue_tuple_check CHECK (
        (
          graduated_venue_kind IS NULL
          AND graduated_venue_address IS NULL
          AND graduated_venue_fee_tier IS NULL
        )
        OR (
          graduated_venue_kind = 'UNISWAP_V3'
          AND graduated_venue_address IS NOT NULL
          AND graduated_venue_fee_tier BETWEEN 0 AND 16777215
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'launch_state_graduation_tx_index_check'
      AND conrelid = 'launch_state'::regclass
  ) THEN
    ALTER TABLE launch_state
      ADD CONSTRAINT launch_state_graduation_tx_index_check CHECK (
        graduation_completed_transaction_index IS NULL
        OR graduation_completed_transaction_index >= 0
      );
  END IF;
END
$$;
