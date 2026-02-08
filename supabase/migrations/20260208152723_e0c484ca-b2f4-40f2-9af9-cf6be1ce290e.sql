-- Update the bet result trigger to allow cashout from authenticated users
-- Only block changing result to 'win', 'loss', or 'partial' from client
-- Allow 'cashed_out' since that's a user-initiated action
CREATE OR REPLACE FUNCTION public.prevent_direct_bet_result_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only service_role can change bet results to win/loss/partial
  IF current_setting('role') != 'service_role' THEN
    IF NEW.result != OLD.result THEN
      -- Allow cashout from authenticated users (this is a user action, not resolution)
      IF NEW.result = 'cashed_out' THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'Direct bet result modification not allowed. Bets are resolved server-side.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;