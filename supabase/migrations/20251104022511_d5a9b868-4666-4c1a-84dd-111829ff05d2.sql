-- Create achievements table
CREATE TABLE IF NOT EXISTS public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  badge_icon text NOT NULL,
  requirement_type text NOT NULL,
  requirement_value integer NOT NULL,
  points_reward integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create user_achievements table
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  achievement_id uuid NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- Enable RLS
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- RLS policies for achievements
CREATE POLICY "Anyone can view active achievements"
  ON public.achievements
  FOR SELECT
  USING (is_active = true);

-- RLS policies for user_achievements
CREATE POLICY "Users can view their own achievements"
  ON public.user_achievements
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own achievements"
  ON public.user_achievements
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Insert initial achievements
INSERT INTO public.achievements (title, description, badge_icon, requirement_type, requirement_value, points_reward) VALUES
  ('First Bet', 'Place your first weather bet', '🎯', 'total_bets', 1, 50),
  ('Weatherman', 'Place 10 bets', '🌤️', 'total_bets', 10, 100),
  ('Meteorologist', 'Place 50 bets', '⛈️', 'total_bets', 50, 500),
  ('First Win', 'Win your first bet', '🏆', 'total_wins', 1, 100),
  ('Winning Streak', 'Win 5 bets in a row', '🔥', 'win_streak', 5, 250),
  ('Weather Master', 'Win 25 bets', '👑', 'total_wins', 25, 1000),
  ('Big Spender', 'Bet 1000 points total', '💰', 'total_stake', 1000, 200),
  ('High Roller', 'Place a bet of 500 points', '💎', 'single_stake', 500, 300),
  ('Globe Trotter', 'Bet on 10 different cities', '🌍', 'unique_cities', 10, 150),
  ('Challenge Master', 'Complete 10 daily challenges', '⭐', 'challenges_completed', 10, 500);