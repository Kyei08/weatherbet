-- Update create_bet_atomic to prevent duplicates within 5 seconds
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
  _currency_type text DEFAULT 'virtual'::text
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

  -- Create bet with currency type
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
    currency_type
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
    _currency_type
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

-- Update create_parlay_atomic to prevent duplicates within 5 seconds
CREATE OR REPLACE FUNCTION public.create_parlay_atomic(
  _stake integer,
  _combined_odds numeric,
  _expires_at timestamp with time zone,
  _has_insurance boolean DEFAULT false,
  _insurance_cost integer DEFAULT 0,
  _currency_type text DEFAULT 'virtual'::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id UUID;
  _parlay_id UUID;
  _total_cost INTEGER;
  _duplicate_count INTEGER;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check for duplicate parlay within last 5 seconds
  SELECT COUNT(*) INTO _duplicate_count
  FROM public.parlays
  WHERE user_id = _user_id
    AND total_stake = _stake
    AND combined_odds = _combined_odds
    AND currency_type = _currency_type
    AND created_at > (NOW() - INTERVAL '5 seconds');

  IF _duplicate_count > 0 THEN
    RAISE EXCEPTION 'Duplicate parlay detected. Please wait before placing the same parlay again.';
  END IF;

  _total_cost := _stake + _insurance_cost;

  PERFORM public.update_user_points_safe(
    _user_id,
    -_total_cost,
    'bet_placed',
    NULL,
    'parlay',
    _currency_type
  );

  INSERT INTO public.parlays (
    user_id,
    total_stake,
    combined_odds,
    expires_at,
    has_insurance,
    insurance_cost,
    currency_type
  ) VALUES (
    _user_id,
    _stake,
    _combined_odds,
    _expires_at,
    _has_insurance,
    _insurance_cost,
    _currency_type
  )
  RETURNING id INTO _parlay_id;

  UPDATE public.financial_transactions
  SET reference_id = _parlay_id
  WHERE id = (
    SELECT id FROM public.financial_transactions
    WHERE user_id = _user_id 
      AND reference_id IS NULL 
      AND transaction_type = 'bet_placed'
      AND currency_type = _currency_type
    ORDER BY created_at DESC
    LIMIT 1
  );

  RETURN _parlay_id;
END;
$function$;

-- Update create_combined_bet_atomic to prevent duplicates within 5 seconds
CREATE OR REPLACE FUNCTION public.create_combined_bet_atomic(
  _city text,
  _stake integer,
  _combined_odds numeric,
  _target_date timestamp with time zone,
  _has_insurance boolean DEFAULT false,
  _insurance_cost integer DEFAULT 0,
  _currency_type text DEFAULT 'virtual'::text
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

  -- Check for duplicate combined bet within last 5 seconds
  SELECT COUNT(*) INTO _duplicate_count
  FROM public.combined_bets
  WHERE user_id = _user_id
    AND city = _city
    AND total_stake = _stake
    AND combined_odds = _combined_odds
    AND currency_type = _currency_type
    AND created_at > (NOW() - INTERVAL '5 seconds');

  IF _duplicate_count > 0 THEN
    RAISE EXCEPTION 'Duplicate combined bet detected. Please wait before placing the same bet again.';
  END IF;

  _total_cost := _stake + _insurance_cost;

  PERFORM public.update_user_points_safe(
    _user_id,
    -_total_cost,
    'bet_placed',
    NULL,
    'combined_bet',
    _currency_type
  );

  INSERT INTO public.combined_bets (
    user_id,
    city,
    total_stake,
    combined_odds,
    target_date,
    has_insurance,
    insurance_cost,
    currency_type
  ) VALUES (
    _user_id,
    _city,
    _stake,
    _combined_odds,
    _target_date,
    _has_insurance,
    _insurance_cost,
    _currency_type
  )
  RETURNING id INTO _bet_id;

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