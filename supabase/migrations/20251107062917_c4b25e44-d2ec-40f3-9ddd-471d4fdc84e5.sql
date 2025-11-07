-- Add insurance fields to bets table
ALTER TABLE public.bets
ADD COLUMN has_insurance boolean NOT NULL DEFAULT false,
ADD COLUMN insurance_cost integer DEFAULT 0,
ADD COLUMN insurance_payout_percentage numeric DEFAULT 0.8;

-- Add insurance fields to parlays table
ALTER TABLE public.parlays
ADD COLUMN has_insurance boolean NOT NULL DEFAULT false,
ADD COLUMN insurance_cost integer DEFAULT 0,
ADD COLUMN insurance_payout_percentage numeric DEFAULT 0.8;

-- Add comment explaining insurance
COMMENT ON COLUMN public.bets.has_insurance IS 'Whether the user purchased insurance for this bet';
COMMENT ON COLUMN public.bets.insurance_cost IS 'Cost of insurance (deducted from user points at bet placement)';
COMMENT ON COLUMN public.bets.insurance_payout_percentage IS 'Percentage of stake returned if bet loses with insurance (0.8 = 80%)';

COMMENT ON COLUMN public.parlays.has_insurance IS 'Whether the user purchased insurance for this parlay';
COMMENT ON COLUMN public.parlays.insurance_cost IS 'Cost of insurance (deducted from user points at bet placement)';
COMMENT ON COLUMN public.parlays.insurance_payout_percentage IS 'Percentage of stake returned if parlay loses with insurance (0.8 = 80%)';