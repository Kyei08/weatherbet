-- Update RLS policies for existing tables to be user-specific
DROP POLICY IF EXISTS "Anyone can select users" ON public.users;
DROP POLICY IF EXISTS "Anyone can insert users" ON public.users;
DROP POLICY IF EXISTS "Anyone can update users" ON public.users;

DROP POLICY IF EXISTS "Anyone can select bets" ON public.bets;
DROP POLICY IF EXISTS "Anyone can insert bets" ON public.bets;
DROP POLICY IF EXISTS "Anyone can update bets" ON public.bets;

-- New user-specific policies for users table
CREATE POLICY "Users can view all users" 
ON public.users 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Users can insert their own user record" 
ON public.users 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own user record" 
ON public.users 
FOR UPDATE 
TO authenticated
USING (auth.uid() = id);

-- New bet policies - users can only see and manage their own bets
CREATE POLICY "Users can view their own bets" 
ON public.bets 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bets" 
ON public.bets 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bets" 
ON public.bets 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);