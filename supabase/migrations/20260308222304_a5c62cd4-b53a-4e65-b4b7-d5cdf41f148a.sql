
-- Season tracking tables
CREATE TABLE public.leaderboard_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_number integer NOT NULL,
  group_id uuid REFERENCES public.leaderboard_groups(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(season_number, group_id)
);

ALTER TABLE public.leaderboard_seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view seasons" ON public.leaderboard_seasons
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role manages seasons" ON public.leaderboard_seasons
  FOR ALL TO service_role USING (true);

-- Season results (top 3 finishers per season)
CREATE TABLE public.season_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid REFERENCES public.leaderboard_seasons(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  username text NOT NULL,
  final_rank integer NOT NULL,
  final_points integer NOT NULL,
  total_bets integer NOT NULL DEFAULT 0,
  total_wins integer NOT NULL DEFAULT 0,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.season_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view season results" ON public.season_results
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role manages season results" ON public.season_results
  FOR ALL TO service_role USING (true);

-- Add weekly_points to users for weekly competition
ALTER TABLE public.users ADD COLUMN weekly_points integer NOT NULL DEFAULT 0;
