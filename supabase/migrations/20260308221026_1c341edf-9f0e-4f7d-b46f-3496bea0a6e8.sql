
-- Table to store periodic leaderboard rank snapshots
CREATE TABLE public.leaderboard_rank_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text NOT NULL,
  rank integer NOT NULL,
  points integer NOT NULL,
  sort_type text NOT NULL DEFAULT 'points',
  group_id uuid REFERENCES public.leaderboard_groups(id) ON DELETE CASCADE,
  recorded_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for efficient queries
CREATE INDEX idx_rank_history_user_sort ON public.leaderboard_rank_history(user_id, sort_type, recorded_at DESC);
CREATE INDEX idx_rank_history_recorded ON public.leaderboard_rank_history(recorded_at);

-- Enable RLS
ALTER TABLE public.leaderboard_rank_history ENABLE ROW LEVEL SECURITY;

-- Anyone in the same leaderboard group can view rank history
CREATE POLICY "Users can view rank history in their group"
  ON public.leaderboard_rank_history
  FOR SELECT
  TO authenticated
  USING (
    group_id IN (
      SELECT group_id FROM public.user_leaderboard_assignments WHERE user_id = auth.uid()
    )
  );

-- Authenticated users can insert rank history (recorded client-side on load)
CREATE POLICY "Authenticated users can insert rank history"
  ON public.leaderboard_rank_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
