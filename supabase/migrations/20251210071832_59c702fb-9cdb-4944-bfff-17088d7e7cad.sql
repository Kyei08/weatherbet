-- Add time_slot_id column to bets table
ALTER TABLE public.bets
ADD COLUMN time_slot_id text DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.bets.time_slot_id IS 'The time slot ID for multi-time betting (e.g., morning, peak, evening)';

-- Update create_bet_atomic function to accept time_slot_id
CREATE OR REPLACE FUNCTION public.create_bet_atomic(
  _city text, 
  _stake integer, 
  _odds numeric, 
  _prediction_type text, 
  _prediction_value text, 
  _target_date timestamp with time zone, 
  _expires_at timestamp with time zone, 
  _has_insurance boolean DEFAULT false, 
  _insurance_cost integer DEFAULT 0, 
  _currency_type text DEFAULT 'virtual'::text,
  _time_slot_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id UUID;
  _bet_id UUID;
  _total_cost INTEGER;
  _duplicate_count INTEGER;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check for duplicate bet within last 5 seconds
  SELECT COUNT(*) INTO _duplicate_count
  FROM public.bets
  WHERE user_id = _user_id
    AND city = _city
    AND prediction_type = _prediction_type
    AND prediction_value = _prediction_value
    AND stake = _stake
    AND currency_type = _currency_type
    AND COALESCE(time_slot_id, '') = COALESCE(_time_slot_id, '')
    AND created_at > (NOW() - INTERVAL '5 seconds');

  IF _duplicate_count > 0 THEN
    RAISE EXCEPTION 'Duplicate bet detected. Please wait before placing the same bet again.';
  END IF;

  _total_cost := _stake + _insurance_cost;

  -- Deduct from appropriate balance
  PERFORM public.update_user_points_safe(
    _user_id,
    -_total_cost,
    'bet_placed',
    NULL,
    'bet',
    _currency_type
  );

  -- Create bet with currency type and time slot
  INSERT INTO public.bets (
    user_id,
    city,
    stake,
    odds,
    prediction_type,
    prediction_value,
    target_date,
    expires_at,
    has_insurance,
    insurance_cost,
    currency_type,
    time_slot_id
  ) VALUES (
    _user_id,
    _city,
    _stake,
    _odds,
    _prediction_type,
    _prediction_value,
    _target_date,
    _expires_at,
    _has_insurance,
    _insurance_cost,
    _currency_type,
    _time_slot_id
  )
  RETURNING id INTO _bet_id;

  -- Update transaction with bet reference
  UPDATE public.financial_transactions
  SET reference_id = _bet_id
  WHERE id = (
    SELECT id FROM public.financial_transactions
    WHERE user_id = _user_id 
      AND reference_id IS NULL 
      AND transaction_type = 'bet_placed'
      AND currency_type = _currency_type
    ORDER BY created_at DESC
    LIMIT 1
  );

  RETURN _bet_id;
END;
$function$;