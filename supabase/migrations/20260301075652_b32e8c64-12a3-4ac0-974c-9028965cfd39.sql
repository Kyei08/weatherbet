
-- =============================================
-- FIX 1: RLS Policy Always True on notifications
-- The insert policy allows anyone to insert. Restrict to service_role only.
-- =============================================
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;

-- Service role bypasses RLS anyway, so for authenticated users we restrict to own user_id
CREATE POLICY "Users or system can insert own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- =============================================
-- FIX 2: RLS Policy Always True on weather_accuracy_log
-- =============================================
DROP POLICY IF EXISTS "System can insert accuracy logs" ON public.weather_accuracy_log;

-- Service role bypasses RLS, so no INSERT policy needed for system inserts.
-- Authenticated users should not insert directly.

-- =============================================
-- FIX 3: RLS Policy Always True on weather_verification_log
-- =============================================
DROP POLICY IF EXISTS "Service role can manage verification logs" ON public.weather_verification_log;

-- Service role bypasses RLS, so the ALL policy with true is unnecessary.
-- Keep the SELECT policy (already exists) for public read access.

-- =============================================
-- FIX 4 & 5: Security Definer Views
-- Recreate views with security_invoker = true
-- =============================================
DROP VIEW IF EXISTS public.weather_accuracy_summary;
CREATE VIEW public.weather_accuracy_summary
WITH (security_invoker = true)
AS
SELECT
  date_trunc('month', target_date) AS month,
  city,
  category,
  count(*) AS total_predictions,
  round(avg(accuracy_score), 2) AS avg_accuracy,
  round(min(accuracy_score), 2) AS min_accuracy,
  round(max(accuracy_score), 2) AS max_accuracy
FROM public.weather_accuracy_log
GROUP BY date_trunc('month', target_date), city, category;

DROP VIEW IF EXISTS public.weather_verification_summary;
CREATE VIEW public.weather_verification_summary
WITH (security_invoker = true)
AS
SELECT
  city,
  count(*) AS total_verifications,
  round(avg(deviation_percentage), 2) AS avg_deviation,
  count(*) FILTER (WHERE is_disputed = true) AS disputed_count,
  max(verification_time) AS last_verification
FROM public.weather_verification_log
GROUP BY city;
