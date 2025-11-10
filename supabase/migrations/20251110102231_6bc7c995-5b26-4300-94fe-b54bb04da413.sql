-- Create bonus_earnings table to track extra points earned from shop items
CREATE TABLE public.bonus_earnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  bonus_type TEXT NOT NULL, -- 'multiplier', 'bonus_points', 'stake_boost'
  bonus_amount INTEGER NOT NULL, -- extra points earned
  base_amount INTEGER NOT NULL, -- original amount before bonus
  item_id UUID, -- reference to shop_item if applicable
  bet_id UUID, -- reference to bet if applicable
  parlay_id UUID, -- reference to parlay if applicable
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.bonus_earnings ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own bonus earnings"
ON public.bonus_earnings
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bonus earnings"
ON public.bonus_earnings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_bonus_earnings_user_id ON public.bonus_earnings(user_id);
CREATE INDEX idx_bonus_earnings_created_at ON public.bonus_earnings(created_at DESC);