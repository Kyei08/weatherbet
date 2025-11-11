-- Create combined_bets table for multi-category bets on same city/date
CREATE TABLE public.combined_bets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  city TEXT NOT NULL,
  target_date TIMESTAMP WITH TIME ZONE NOT NULL,
  total_stake INTEGER NOT NULL,
  combined_odds NUMERIC NOT NULL,
  result TEXT NOT NULL DEFAULT 'pending',
  has_insurance BOOLEAN NOT NULL DEFAULT false,
  insurance_cost INTEGER DEFAULT 0,
  insurance_payout_percentage NUMERIC DEFAULT 0.8,
  cashout_amount INTEGER,
  cashed_out_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create combined_bet_categories table for individual predictions within combined bet
CREATE TABLE public.combined_bet_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  combined_bet_id UUID NOT NULL,
  prediction_type TEXT NOT NULL,
  prediction_value TEXT NOT NULL,
  odds NUMERIC NOT NULL,
  result TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.combined_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combined_bet_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for combined_bets
CREATE POLICY "Users can create their own combined bets" 
ON public.combined_bets 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own combined bets" 
ON public.combined_bets 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own combined bets" 
ON public.combined_bets 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all combined bets" 
ON public.combined_bets 
FOR SELECT 
USING (is_admin(auth.uid()));

-- RLS Policies for combined_bet_categories
CREATE POLICY "Users can create their own combined bet categories" 
ON public.combined_bet_categories 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.combined_bets 
    WHERE id = combined_bet_categories.combined_bet_id 
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can view their own combined bet categories" 
ON public.combined_bet_categories 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.combined_bets 
    WHERE id = combined_bet_categories.combined_bet_id 
    AND user_id = auth.uid()
  )
);

-- Create indexes for performance
CREATE INDEX idx_combined_bets_user_id ON public.combined_bets(user_id);
CREATE INDEX idx_combined_bets_result ON public.combined_bets(result);
CREATE INDEX idx_combined_bet_categories_combined_bet_id ON public.combined_bet_categories(combined_bet_id);

-- Add trigger for updated_at
CREATE TRIGGER update_combined_bets_updated_at
BEFORE UPDATE ON public.combined_bets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();