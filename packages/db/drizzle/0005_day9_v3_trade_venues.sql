ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS venue_kind text;

ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS venue_address text;

ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS venue_fee_tier integer;

UPDATE trades
SET
  venue_kind = 'BREAD_CURVE',
  venue_address = curve_address,
  venue_fee_tier = NULL
WHERE venue_kind IS NULL
  AND venue_address IS NULL
  AND venue_fee_tier IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'trades_venue_tuple_check'
      AND conrelid = 'trades'::regclass
  ) THEN
    ALTER TABLE trades
      ADD CONSTRAINT trades_venue_tuple_check CHECK (
        (venue_kind IS NULL AND venue_address IS NULL AND venue_fee_tier IS NULL)
        OR (
          venue_kind = 'BREAD_CURVE'
          AND venue_address IS NOT NULL
          AND venue_fee_tier IS NULL
        )
        OR (
          venue_kind = 'UNISWAP_V3'
          AND venue_address IS NOT NULL
          AND venue_fee_tier BETWEEN 0 AND 16777215
        )
      );
  END IF;
END
$$;
