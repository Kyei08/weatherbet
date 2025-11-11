-- Create leaderboard_groups table to organize users into competitive pools
CREATE TABLE public.leaderboard_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  max_size INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_leaderboard_assignments table to track which group each user is in
CREATE TABLE public.user_leaderboard_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  group_id UUID NOT NULL REFERENCES public.leaderboard_groups(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leaderboard_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_leaderboard_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leaderboard_groups
CREATE POLICY "Anyone can view leaderboard groups"
ON public.leaderboard_groups
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage leaderboard groups"
ON public.leaderboard_groups
FOR ALL
TO authenticated
USING (is_admin(auth.uid()));

-- RLS Policies for user_leaderboard_assignments
CREATE POLICY "Users can view their own assignment"
ON public.user_leaderboard_assignments
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can view assignments in their group"
ON public.user_leaderboard_assignments
FOR SELECT
TO authenticated
USING (
  group_id IN (
    SELECT group_id FROM public.user_leaderboard_assignments WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own assignment"
ON public.user_leaderboard_assignments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all assignments"
ON public.user_leaderboard_assignments
FOR ALL
TO authenticated
USING (is_admin(auth.uid()));

-- Create index for faster lookups
CREATE INDEX idx_user_leaderboard_assignments_user_id ON public.user_leaderboard_assignments(user_id);
CREATE INDEX idx_user_leaderboard_assignments_group_id ON public.user_leaderboard_assignments(group_id);

-- Create function to get or create a leaderboard group for a user
CREATE OR REPLACE FUNCTION public.assign_user_to_leaderboard_group(_user_id UUID, _max_size INTEGER DEFAULT 100)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _group_id UUID;
  _group_count INTEGER;
BEGIN
  -- Check if user already has a group assignment
  SELECT group_id INTO _group_id
  FROM public.user_leaderboard_assignments
  WHERE user_id = _user_id;
  
  IF _group_id IS NOT NULL THEN
    RETURN _group_id;
  END IF;
  
  -- Find a group that has space
  SELECT lg.id INTO _group_id
  FROM public.leaderboard_groups lg
  LEFT JOIN public.user_leaderboard_assignments ula ON lg.id = ula.group_id
  WHERE lg.max_size = _max_size
  GROUP BY lg.id, lg.max_size
  HAVING COUNT(ula.user_id) < lg.max_size
  ORDER BY lg.created_at ASC
  LIMIT 1;
  
  -- If no group with space exists, create a new one
  IF _group_id IS NULL THEN
    SELECT COUNT(*) INTO _group_count FROM public.leaderboard_groups WHERE max_size = _max_size;
    
    INSERT INTO public.leaderboard_groups (name, max_size)
    VALUES ('League ' || (_group_count + 1), _max_size)
    RETURNING id INTO _group_id;
  END IF;
  
  -- Assign user to the group
  INSERT INTO public.user_leaderboard_assignments (user_id, group_id)
  VALUES (_user_id, _group_id);
  
  RETURN _group_id;
END;
$$;

-- Create function to get leaderboard for user's group
CREATE OR REPLACE FUNCTION public.get_group_leaderboard(_user_id UUID)
RETURNS TABLE(
  username TEXT,
  points INTEGER,
  level INTEGER,
  xp INTEGER,
  rank BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  WITH user_group AS (
    SELECT group_id FROM public.user_leaderboard_assignments WHERE user_id = _user_id
  ),
  group_users AS (
    SELECT u.username, u.points, u.level, u.xp, u.id
    FROM public.users u
    INNER JOIN public.user_leaderboard_assignments ula ON u.id = ula.user_id
    INNER JOIN user_group ug ON ula.group_id = ug.group_id
  )
  SELECT 
    gu.username,
    gu.points,
    gu.level,
    gu.xp,
    ROW_NUMBER() OVER (ORDER BY gu.points DESC) as rank
  FROM group_users gu
  ORDER BY gu.points DESC;
$$;

-- Insert a default leaderboard group
INSERT INTO public.leaderboard_groups (name, max_size) VALUES ('League 1', 100);