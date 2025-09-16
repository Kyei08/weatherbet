-- Create a function to update user points safely
CREATE OR REPLACE FUNCTION public.update_user_points(user_uuid UUID, points_change INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users 
  SET points = GREATEST(0, points + points_change)
  WHERE id = user_uuid;
END;
$$;

-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the bet resolution function to run every hour
SELECT cron.schedule(
  'resolve-bets-hourly',
  '0 * * * *', -- Run at the start of every hour
  $$
  SELECT
    net.http_post(
        url:='https://imyzcwgskjngwvcadrjn.supabase.co/functions/v1/resolve-bets',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlteXpjd2dza2puZ3d2Y2FkcmpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5ODk2ODQsImV4cCI6MjA3MjU2NTY4NH0.eVrnAk_Izo9hYdAFvuXxBH28OrT23cM26eoJfGVqPS4"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);