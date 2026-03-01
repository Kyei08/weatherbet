
-- Schedule resolve-bets to run every 5 minutes
SELECT cron.schedule(
  'resolve-bets-every-5-minutes',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://imyzcwgskjngwvcadrjn.supabase.co/functions/v1/resolve-bets',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlteXpjd2dza2puZ3d2Y2FkcmpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5ODk2ODQsImV4cCI6MjA3MjU2NTY4NH0.eVrnAk_Izo9hYdAFvuXxBH28OrT23cM26eoJfGVqPS4"}'::jsonb,
        body:='{"triggered_by": "cron"}'::jsonb
    ) as request_id;
  $$
);
