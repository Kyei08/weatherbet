-- Create perks table
CREATE TABLE public.perks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  perk_icon text NOT NULL,
  perk_type text NOT NULL, -- 'bet_multiplier', 'bonus_points', 'max_stake_increase', 'win_bonus'
  perk_value numeric NOT NULL, -- multiplier/bonus amount
  unlock_level integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create user_perks table to track unlocked perks
CREATE TABLE public.user_perks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  perk_id uuid NOT NULL,
  unlocked_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, perk_id)
);

-- Enable RLS
ALTER TABLE public.perks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_perks ENABLE ROW LEVEL SECURITY;

-- RLS policies for perks
CREATE POLICY "Anyone can view active perks"
  ON public.perks
  FOR SELECT
  USING (is_active = true);

-- RLS policies for user_perks
CREATE POLICY "Users can view their own perks"
  ON public.user_perks
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own perks"
  ON public.user_perks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Insert initial perks
INSERT INTO public.perks (title, description, perk_icon, perk_type, perk_value, unlock_level) VALUES
  ('Starter Boost', 'Get +10% bonus points on all wins', '🎯', 'win_bonus', 0.1, 2),
  ('High Roller', 'Increase max stake by 50 points', '💰', 'max_stake_increase', 50, 3),
  ('Lucky Charm', 'Get +20 bonus points on every bet placed', '🍀', 'bonus_points', 20, 5),
  ('Odds Master', '1.1x multiplier on all bet odds', '⚡', 'bet_multiplier', 1.1, 7),
  ('Fortune Seeker', 'Get +25% bonus points on all wins', '💎', 'win_bonus', 0.25, 10),
  ('Stake Champion', 'Increase max stake by 100 points', '👑', 'max_stake_increase', 100, 12),
  ('Weather Wizard', '1.15x multiplier on all bet odds', '🌟', 'bet_multiplier', 1.15, 15),
  ('Point Magnet', 'Get +50 bonus points on every bet placed', '🧲', 'bonus_points', 50, 18),
  ('Elite Gambler', 'Get +50% bonus points on all wins', '🏆', 'win_bonus', 0.5, 20);