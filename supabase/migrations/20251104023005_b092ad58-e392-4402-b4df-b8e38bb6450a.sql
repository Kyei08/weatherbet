-- Add level and xp columns to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS xp integer NOT NULL DEFAULT 0;