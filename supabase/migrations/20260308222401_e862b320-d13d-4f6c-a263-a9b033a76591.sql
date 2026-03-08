
SELECT cron.schedule(
  'weekly-leaderboard-reset',
  '0 0 * * 1',
  $$
  SELECT net.http_post(
    url:='https://imyzcwgskjngwvcadrjn.supabase.co/functions/v1/weekly-leaderboard-reset',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlteXpjd2dza2puZ3d2Y2FkcmpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5ODk2ODQsImV4cCI6MjA3MjU2NTY4NH0.eVrnAk_Izo9hYdAFvuXxBH28OrT23cM26eoJfGVqPS4"}'::jsonb,
    body:='{"trigger": "cron"}'::jsonb
  ) as request_id;
  $$
);
