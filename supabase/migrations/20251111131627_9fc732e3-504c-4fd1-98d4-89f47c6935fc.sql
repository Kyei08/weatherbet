-- Add real money balance to users table (separate from virtual points)
ALTER TABLE users ADD COLUMN balance_cents INTEGER NOT NULL DEFAULT 0;

-- Add currency type to financial transactions
ALTER TABLE financial_transactions ADD COLUMN currency_type TEXT NOT NULL DEFAULT 'virtual';
CREATE INDEX idx_financial_transactions_currency ON financial_transactions(currency_type, user_id);

-- Add currency type to bets
ALTER TABLE bets ADD COLUMN currency_type TEXT NOT NULL DEFAULT 'virtual';
CREATE INDEX idx_bets_currency ON bets(currency_type, user_id);

-- Add currency type to parlays
ALTER TABLE parlays ADD COLUMN currency_type TEXT NOT NULL DEFAULT 'virtual';
CREATE INDEX idx_parlays_currency ON parlays(currency_type, user_id);

-- Add currency type to combined_bets
ALTER TABLE combined_bets ADD COLUMN currency_type TEXT NOT NULL DEFAULT 'virtual';
CREATE INDEX idx_combined_bets_currency ON combined_bets(currency_type, user_id);

-- Drop and recreate update_user_points_safe to handle both currencies
DROP FUNCTION IF EXISTS public.update_user_points_safe(uuid, integer, text, uuid, text);

CREATE OR REPLACE FUNCTION public.update_user_points_safe(
  user_uuid UUID,
  points_change INTEGER,
  transaction_type TEXT DEFAULT 'manual',
  reference_id UUID DEFAULT NULL,
  reference_type TEXT DEFAULT NULL,
  currency_type TEXT DEFAULT 'virtual'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_balance INTEGER;
  new_balance INTEGER;
  transaction_record JSONB;
  balance_column TEXT;
BEGIN
  -- Determine which balance column to use
  IF currency_type = 'real' THEN
    balance_column := 'balance_cents';
  ELSE
    balance_column := 'points';
  END IF;

  -- Get current balance with row lock
  IF currency_type = 'real' THEN
    SELECT balance_cents INTO current_balance
    FROM public.users
    WHERE id = user_uuid
    FOR UPDATE;
  ELSE
    SELECT points INTO current_balance
    FROM public.users
    WHERE id = user_uuid
    FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  new_balance := current_balance + points_change;

  -- Check for insufficient funds
  IF new_balance < 0 THEN
    IF currency_type = 'real' THEN
      RAISE EXCEPTION 'Insufficient funds. Current balance: R%.2f, Required: R%.2f', 
        current_balance / 100.0, 
        ABS(points_change) / 100.0;
    ELSE
      RAISE EXCEPTION 'Insufficient points. Current: %, Required: %', 
        current_balance, 
        ABS(points_change);
    END IF;
  END IF;

  -- Update the appropriate balance
  IF currency_type = 'real' THEN
    UPDATE public.users
    SET balance_cents = new_balance
    WHERE id = user_uuid;
  ELSE
    UPDATE public.users
    SET points = new_balance
    WHERE id = user_uuid;
  END IF;

  -- Record transaction
  INSERT INTO public.financial_transactions (
    user_id,
    transaction_type,
    amount_cents,
    balance_before_cents,
    balance_after_cents,
    reference_id,
    reference_type,
    currency_type
  ) VALUES (
    user_uuid,
    transaction_type,
    points_change,
    current_balance,
    new_balance,
    reference_id,
    reference_type,
    currency_type
  );

  transaction_record := jsonb_build_object(
    'success', true,
    'balance_before', current_balance,
    'balance_after', new_balance,
    'amount_changed', points_change,
    'currency_type', currency_type
  );

  RETURN transaction_record;
END;
$$;

-- Update create_bet_atomic to support currency type
DROP FUNCTION IF EXISTS public.create_bet_atomic(text, integer, numeric, text, text, timestamp with time zone, timestamp with time zone, boolean, integer);

CREATE OR REPLACE FUNCTION public.create_bet_atomic(
  _city TEXT,
  _stake INTEGER,
  _odds NUMERIC,
  _prediction_type TEXT,
  _prediction_value TEXT,
  _target_date TIMESTAMP WITH TIME ZONE,
  _expires_at TIMESTAMP WITH TIME ZONE,
  _has_insurance BOOLEAN DEFAULT FALSE,
  _insurance_cost INTEGER DEFAULT 0,
  _currency_type TEXT DEFAULT 'virtual'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id UUID;
  _bet_id UUID;
  _total_cost INTEGER;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
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
$$;

-- Update create_parlay_atomic to support currency type
DROP FUNCTION IF EXISTS public.create_parlay_atomic(integer, numeric, timestamp with time zone, boolean, integer);

CREATE OR REPLACE FUNCTION public.create_parlay_atomic(
  _stake INTEGER,
  _combined_odds NUMERIC,
  _expires_at TIMESTAMP WITH TIME ZONE,
  _has_insurance BOOLEAN DEFAULT FALSE,
  _insurance_cost INTEGER DEFAULT 0,
  _currency_type TEXT DEFAULT 'virtual'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id UUID;
  _parlay_id UUID;
  _total_cost INTEGER;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
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
$$;

-- Update create_combined_bet_atomic to support currency type
DROP FUNCTION IF EXISTS public.create_combined_bet_atomic(text, integer, numeric, timestamp with time zone, boolean, integer);

CREATE OR REPLACE FUNCTION public.create_combined_bet_atomic(
  _city TEXT,
  _stake INTEGER,
  _combined_odds NUMERIC,
  _target_date TIMESTAMP WITH TIME ZONE,
  _has_insurance BOOLEAN DEFAULT FALSE,
  _insurance_cost INTEGER DEFAULT 0,
  _currency_type TEXT DEFAULT 'virtual'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id UUID;
  _bet_id UUID;
  _total_cost INTEGER;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
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
$$;