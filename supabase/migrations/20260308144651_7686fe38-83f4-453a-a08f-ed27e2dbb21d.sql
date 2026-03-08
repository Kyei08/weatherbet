
CREATE OR REPLACE FUNCTION public.get_following_activity(_limit integer DEFAULT 20)
RETURNS TABLE(
  bet_id uuid,
  user_id uuid,
  username text,
  city text,
  prediction_type text,
  prediction_value text,
  stake integer,
  odds numeric,
  result text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    b.id as bet_id,
    b.user_id,
    u.username,
    b.city,
    b.prediction_type,
    b.prediction_value,
    b.stake,
    b.odds,
    b.result,
    b.created_at,
    b.updated_at
  FROM bets b
  INNER JOIN user_follows uf ON uf.following_id = b.user_id
  INNER JOIN users u ON u.id = b.user_id
  WHERE uf.follower_id = auth.uid()
    AND b.result IN ('win', 'loss', 'pending')
    AND b.currency_type = 'virtual'
  ORDER BY b.created_at DESC
  LIMIT _limit;
$$;
