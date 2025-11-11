-- Fix users table RLS policy to restrict public data exposure
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view all users" ON public.users;

-- Create restricted policy allowing users to only see their own data
CREATE POLICY "Users can view their own user record"
ON public.users FOR SELECT
USING (auth.uid() = id);

-- Create secure leaderboard function with limited data exposure
CREATE OR REPLACE FUNCTION public.get_leaderboard(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  username TEXT,
  points INTEGER,
  level INTEGER,
  xp INTEGER
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT username, points, level, xp
  FROM users
  ORDER BY points DESC
  LIMIT limit_count;
$$;