-- Create shop_items table
CREATE TABLE public.shop_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  item_icon text NOT NULL,
  item_type text NOT NULL, -- 'temp_multiplier', 'bonus_points', 'stake_boost', 'insurance', 'streak_freeze'
  item_value numeric NOT NULL,
  duration_hours integer, -- NULL for instant items
  price integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create user_purchases table
CREATE TABLE public.user_purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  item_id uuid NOT NULL,
  purchased_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  used boolean NOT NULL DEFAULT false,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_purchases ENABLE ROW LEVEL SECURITY;

-- RLS policies for shop_items
CREATE POLICY "Anyone can view active shop items"
  ON public.shop_items
  FOR SELECT
  USING (is_active = true);

-- RLS policies for user_purchases
CREATE POLICY "Users can view their own purchases"
  ON public.user_purchases
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own purchases"
  ON public.user_purchases
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own purchases"
  ON public.user_purchases
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Insert shop items
INSERT INTO public.shop_items (title, description, item_icon, item_type, item_value, duration_hours, price) VALUES
  ('2x Odds Booster', 'Double your odds on the next bet', '🚀', 'temp_multiplier', 2.0, NULL, 200),
  ('Lucky Day (24h)', 'Get 1.5x odds on all bets for 24 hours', '🍀', 'temp_multiplier', 1.5, 24, 500),
  ('Instant Bonus', 'Get 100 bonus points immediately', '💰', 'bonus_points', 100, NULL, 150),
  ('High Stakes Pass', 'Increase max stake to 200 for next 3 bets', '👑', 'stake_boost', 200, NULL, 300),
  ('Bet Insurance', 'Get 50% of your stake back if you lose (one bet)', '🛡️', 'insurance', 0.5, NULL, 250),
  ('Win Streak Freeze', 'Protect your win streak from one loss', '❄️', 'streak_freeze', 1, NULL, 400),
  ('Weekend Warrior (48h)', '2x odds on all weekend bets', '⚡', 'temp_multiplier', 2.0, 48, 800),
  ('Point Fountain', 'Get 500 bonus points immediately', '⭐', 'bonus_points', 500, NULL, 600),
  ('VIP Pass (7 days)', '1.25x odds on all bets for 7 days', '💎', 'temp_multiplier', 1.25, 168, 1500);