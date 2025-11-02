-- Add time-bound fields to bets table
ALTER TABLE public.bets 
ADD COLUMN IF NOT EXISTS target_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS bet_duration_days integer;

-- Update existing bets to have default values (24 hours from creation)
UPDATE public.bets 
SET 
  target_date = COALESCE(target_date, created_at + interval '24 hours'),
  expires_at = COALESCE(expires_at, created_at + interval '24 hours'),
  bet_duration_days = COALESCE(bet_duration_days, 1)
WHERE target_date IS NULL OR expires_at IS NULL OR bet_duration_days IS NULL;