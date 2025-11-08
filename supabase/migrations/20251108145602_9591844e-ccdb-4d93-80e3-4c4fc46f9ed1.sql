-- Add cash-out support to bets table
ALTER TABLE bets 
  ADD COLUMN cashed_out_at timestamp with time zone,
  ADD COLUMN cashout_amount integer;

-- Add cash-out support to parlays table
ALTER TABLE parlays
  ADD COLUMN cashed_out_at timestamp with time zone,
  ADD COLUMN cashout_amount integer;

-- Update result enum to allow 'cashed_out' as a valid result
-- Note: We'll handle this in the application layer since result is text type