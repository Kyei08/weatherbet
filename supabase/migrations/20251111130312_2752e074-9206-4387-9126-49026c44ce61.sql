-- Create financial transactions audit table
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  transaction_type TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  balance_before_cents INTEGER NOT NULL,
  balance_after_cents INTEGER NOT NULL,
  reference_id UUID,
  reference_type TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_user_id ON public.financial_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_created_at ON public.financial_transactions(created_at DESC);

ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions"
  ON public.financial_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert transactions"
  ON public.financial_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Drop old unsafe function
DROP FUNCTION IF EXISTS public.update_user_points(uuid, integer);

-- Create new safe function with balance validation and locking
CREATE OR REPLACE FUNCTION public.update_user_points_safe(
  user_uuid UUID,
  points_change INTEGER,
  transaction_type TEXT DEFAULT 'manual',
  reference_id UUID DEFAULT NULL,
  reference_type TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance INTEGER;
  new_balance INTEGER;
  transaction_record JSONB;
BEGIN
  SELECT points INTO current_balance
  FROM public.users
  WHERE id = user_uuid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  new_balance := current_balance + points_change;

  IF new_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient funds. Current balance: R%.2f, Required: R%.2f', 
      current_balance / 100.0, 
      ABS(points_change) / 100.0;
  END IF;

  UPDATE public.users
  SET points = new_balance
  WHERE id = user_uuid;

  INSERT INTO public.financial_transactions (
    user_id,
    transaction_type,
    amount_cents,
    balance_before_cents,
    balance_after_cents,
    reference_id,
    reference_type
  ) VALUES (
    user_uuid,
    transaction_type,
    points_change,
    current_balance,
    new_balance,
    reference_id,
    reference_type
  );

  transaction_record := jsonb_build_object(
    'success', true,
    'balance_before', current_balance,
    'balance_after', new_balance,
    'amount_changed', points_change
  );

  RETURN transaction_record;
END;
$$;

-- Create atomic bet creation
CREATE OR REPLACE FUNCTION public.create_bet_atomic(
  _city TEXT,
  _stake INTEGER,
  _odds NUMERIC,
  _prediction_type TEXT,
  _prediction_value TEXT,
  _target_date TIMESTAMP WITH TIME ZONE,
  _expires_at TIMESTAMP WITH TIME ZONE,
  _has_insurance BOOLEAN DEFAULT false,
  _insurance_cost INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID;
  _bet_id UUID;
  _total_cost INTEGER;
  _transaction_id UUID;
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
    'bet'
  );

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
    insurance_cost
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
    _insurance_cost
  )
  RETURNING id INTO _bet_id;

  UPDATE public.financial_transactions
  SET reference_id = _bet_id
  WHERE id = (
    SELECT id FROM public.financial_transactions
    WHERE user_id = _user_id 
      AND reference_id IS NULL 
      AND transaction_type = 'bet_placed'
    ORDER BY created_at DESC
    LIMIT 1
  );

  RETURN _bet_id;
END;
$$;

-- Create atomic parlay creation
CREATE OR REPLACE FUNCTION public.create_parlay_atomic(
  _stake INTEGER,
  _combined_odds NUMERIC,
  _expires_at TIMESTAMP WITH TIME ZONE,
  _has_insurance BOOLEAN DEFAULT false,
  _insurance_cost INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    'parlay'
  );

  INSERT INTO public.parlays (
    user_id,
    total_stake,
    combined_odds,
    expires_at,
    has_insurance,
    insurance_cost
  ) VALUES (
    _user_id,
    _stake,
    _combined_odds,
    _expires_at,
    _has_insurance,
    _insurance_cost
  )
  RETURNING id INTO _parlay_id;

  UPDATE public.financial_transactions
  SET reference_id = _parlay_id
  WHERE id = (
    SELECT id FROM public.financial_transactions
    WHERE user_id = _user_id 
      AND reference_id IS NULL 
      AND transaction_type = 'bet_placed'
    ORDER BY created_at DESC
    LIMIT 1
  );

  RETURN _parlay_id;
END;
$$;

-- Create atomic combined bet creation
CREATE OR REPLACE FUNCTION public.create_combined_bet_atomic(
  _city TEXT,
  _stake INTEGER,
  _combined_odds NUMERIC,
  _target_date TIMESTAMP WITH TIME ZONE,
  _has_insurance BOOLEAN DEFAULT false,
  _insurance_cost INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    'combined_bet'
  );

  INSERT INTO public.combined_bets (
    user_id,
    city,
    total_stake,
    combined_odds,
    target_date,
    has_insurance,
    insurance_cost
  ) VALUES (
    _user_id,
    _city,
    _stake,
    _combined_odds,
    _target_date,
    _has_insurance,
    _insurance_cost
  )
  RETURNING id INTO _bet_id;

  UPDATE public.financial_transactions
  SET reference_id = _bet_id
  WHERE id = (
    SELECT id FROM public.financial_transactions
    WHERE user_id = _user_id 
      AND reference_id IS NULL 
      AND transaction_type = 'bet_placed'
    ORDER BY created_at DESC
    LIMIT 1
  );

  RETURN _bet_id;
END;
$$;