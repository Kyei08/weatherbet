-- Create parlays table for combined bets
CREATE TABLE public.parlays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  total_stake INTEGER NOT NULL,
  combined_odds NUMERIC NOT NULL,
  result TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create parlay_legs table for individual predictions within a parlay
CREATE TABLE public.parlay_legs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parlay_id UUID NOT NULL REFERENCES public.parlays(id) ON DELETE CASCADE,
  city TEXT NOT NULL,
  prediction_type TEXT NOT NULL,
  prediction_value TEXT NOT NULL,
  odds NUMERIC NOT NULL,
  result TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.parlays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parlay_legs ENABLE ROW LEVEL SECURITY;

-- RLS policies for parlays
CREATE POLICY "Users can view their own parlays"
ON public.parlays
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own parlays"
ON public.parlays
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own parlays"
ON public.parlays
FOR UPDATE
USING (auth.uid() = user_id);

-- RLS policies for parlay_legs
CREATE POLICY "Users can view their own parlay legs"
ON public.parlay_legs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.parlays
    WHERE parlays.id = parlay_legs.parlay_id
    AND parlays.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own parlay legs"
ON public.parlay_legs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.parlays
    WHERE parlays.id = parlay_legs.parlay_id
    AND parlays.user_id = auth.uid()
  )
);

-- Create trigger for automatic timestamp updates on parlays
CREATE TRIGGER update_parlays_updated_at
BEFORE UPDATE ON public.parlays
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_parlays_user_id ON public.parlays(user_id);
CREATE INDEX idx_parlays_result ON public.parlays(result);
CREATE INDEX idx_parlay_legs_parlay_id ON public.parlay_legs(parlay_id);