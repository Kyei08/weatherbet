-- Drop the overly permissive update policy
DROP POLICY IF EXISTS "Users can update their own user record" ON public.users;

-- Create a restrictive update policy that only allows updating non-financial columns
-- Users should NEVER be able to update points, balance_cents, xp, or level directly
CREATE POLICY "Users can update their own profile fields"
ON public.users
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  -- Ensure financial fields haven't changed by comparing with current values
  -- This policy allows the update but the trigger below will enforce field restrictions
);

-- Create a trigger to prevent direct balance/points manipulation from client
CREATE OR REPLACE FUNCTION public.prevent_direct_balance_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only service_role can modify financial fields
  -- Regular users (anon/authenticated) cannot change these
  IF current_setting('role') != 'service_role' THEN
    -- If any financial field is being changed, reject
    IF NEW.points != OLD.points THEN
      RAISE EXCEPTION 'Direct points modification not allowed. Use the proper betting system.';
    END IF;
    IF NEW.balance_cents != OLD.balance_cents THEN
      RAISE EXCEPTION 'Direct balance modification not allowed. Use the proper payment system.';
    END IF;
    IF NEW.xp != OLD.xp THEN
      RAISE EXCEPTION 'Direct XP modification not allowed.';
    END IF;
    IF NEW.level != OLD.level THEN
      RAISE EXCEPTION 'Direct level modification not allowed.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach trigger to users table
DROP TRIGGER IF EXISTS prevent_balance_manipulation ON public.users;
CREATE TRIGGER prevent_balance_manipulation
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.prevent_direct_balance_update();

-- Also prevent direct manipulation of bet results from client
CREATE OR REPLACE FUNCTION public.prevent_direct_bet_result_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only service_role can change bet results
  IF current_setting('role') != 'service_role' THEN
    IF NEW.result != OLD.result THEN
      RAISE EXCEPTION 'Direct bet result modification not allowed. Bets are resolved server-side.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply to all bet tables
DROP TRIGGER IF EXISTS prevent_bet_result_manipulation ON public.bets;
CREATE TRIGGER prevent_bet_result_manipulation
BEFORE UPDATE ON public.bets
FOR EACH ROW
EXECUTE FUNCTION public.prevent_direct_bet_result_update();

DROP TRIGGER IF EXISTS prevent_parlay_result_manipulation ON public.parlays;
CREATE TRIGGER prevent_parlay_result_manipulation
BEFORE UPDATE ON public.parlays
FOR EACH ROW
EXECUTE FUNCTION public.prevent_direct_bet_result_update();

DROP TRIGGER IF EXISTS prevent_combined_bet_result_manipulation ON public.combined_bets;
CREATE TRIGGER prevent_combined_bet_result_manipulation
BEFORE UPDATE ON public.combined_bets
FOR EACH ROW
EXECUTE FUNCTION public.prevent_direct_bet_result_update();