-- Create challenges table for daily challenges
CREATE TABLE public.challenges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  challenge_type text NOT NULL,
  target_value integer NOT NULL,
  reward_points integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create user_challenges table to track user progress
CREATE TABLE public.user_challenges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  progress integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamp with time zone,
  challenge_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, challenge_id, challenge_date)
);

-- Enable RLS
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_challenges ENABLE ROW LEVEL SECURITY;

-- RLS Policies for challenges (everyone can view active challenges)
CREATE POLICY "Anyone can view active challenges"
ON public.challenges
FOR SELECT
USING (is_active = true);

-- RLS Policies for user_challenges
CREATE POLICY "Users can view their own challenges"
ON public.user_challenges
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own challenges"
ON public.user_challenges
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own challenges"
ON public.user_challenges
FOR UPDATE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_user_challenges_updated_at
BEFORE UPDATE ON public.user_challenges
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial daily challenges
INSERT INTO public.challenges (title, description, challenge_type, target_value, reward_points) VALUES
('Early Bird', 'Place 3 bets today', 'daily_bets', 3, 100),
('Weather Master', 'Win 2 bets today', 'daily_wins', 2, 150),
('City Explorer', 'Bet on 3 different cities today', 'different_cities', 3, 200),
('High Roller', 'Place a bet with stake of 100 or more', 'high_stake', 100, 150),
('Perfect Prediction', 'Win 3 bets in a row', 'win_streak', 3, 300);