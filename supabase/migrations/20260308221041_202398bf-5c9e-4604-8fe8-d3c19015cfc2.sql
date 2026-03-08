
-- Tighten insert policy to only allow inserting own user_id records
DROP POLICY "Authenticated users can insert rank history" ON public.leaderboard_rank_history;

CREATE POLICY "Users can insert their own rank history"
  ON public.leaderboard_rank_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
