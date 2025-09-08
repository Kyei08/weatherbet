-- Create profiles table for additional user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  username TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (true);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Add trigger for timestamps
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', 'Player' || FLOOR(RANDOM() * 10000)::TEXT));
  RETURN NEW;
END;
$$;

-- Trigger to create profile when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

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
WITH CHECK (auth.uid()::text = id);

CREATE POLICY "Users can update their own user record" 
ON public.users 
FOR UPDATE 
TO authenticated
USING (auth.uid()::text = id);

-- New bet policies - users can only see and manage their own bets
-- Note: user_id in bets table is text, so we cast auth.uid() to text
CREATE POLICY "Users can view their own bets" 
ON public.bets 
FOR SELECT 
TO authenticated
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can create their own bets" 
ON public.bets 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own bets" 
ON public.bets 
FOR UPDATE 
TO authenticated
USING (auth.uid()::text = user_id);