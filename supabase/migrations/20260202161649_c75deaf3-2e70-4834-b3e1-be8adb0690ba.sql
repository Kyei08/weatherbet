-- Create auto-cashout rules table
CREATE TABLE public.auto_cashout_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  bet_type TEXT NOT NULL CHECK (bet_type IN ('bet', 'parlay', 'combined_bet')),
  bet_id UUID NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('percentage_above', 'percentage_below', 'weather_bonus_above', 'weather_bonus_below', 'time_bonus_above', 'amount_above')),
  threshold_value NUMERIC NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  triggered_at TIMESTAMP WITH TIME ZONE,
  cashout_amount INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_auto_cashout_rules_user_id ON public.auto_cashout_rules(user_id);
CREATE INDEX idx_auto_cashout_rules_bet_id ON public.auto_cashout_rules(bet_id);
CREATE INDEX idx_auto_cashout_rules_active ON public.auto_cashout_rules(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.auto_cashout_rules ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own auto-cashout rules"
ON public.auto_cashout_rules
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own auto-cashout rules"
ON public.auto_cashout_rules
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own auto-cashout rules"
ON public.auto_cashout_rules
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own auto-cashout rules"
ON public.auto_cashout_rules
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_auto_cashout_rules_updated_at
BEFORE UPDATE ON public.auto_cashout_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();