import { supabase } from '@/integrations/supabase/client';

// Partial cashout for single bets - reduces stake, keeps bet active
export const partialCashOutBet = async (
  betId: string,
  cashoutAmount: number,
  percentage: number,
  currencyType: 'virtual' | 'real' = 'virtual'
): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Get current bet to calculate new stake
  const { data: bet, error: fetchError } = await supabase
    .from('bets')
    .select('stake')
    .eq('id', betId)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !bet) throw new Error('Bet not found');

  const remainingPercentage = 100 - percentage;
  const newStake = Math.floor(bet.stake * (remainingPercentage / 100));

  // If cashing out 100%, use full cashout
  if (remainingPercentage <= 0) {
    const { error: betError } = await supabase
      .from('bets')
      .update({
        result: 'cashed_out',
        cashed_out_at: new Date().toISOString(),
        cashout_amount: cashoutAmount,
      })
      .eq('id', betId)
      .eq('user_id', user.id);

    if (betError) throw betError;
  } else {
    // Update bet with reduced stake (partial cashout)
    const { error: betError } = await supabase
      .from('bets')
      .update({
        stake: newStake,
      })
      .eq('id', betId)
      .eq('user_id', user.id);

    if (betError) throw betError;
  }

  // Add partial cashout amount to user balance with metadata
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  const balanceBefore = await getCurrentBalance(user.id, currencyType);
  
  await supabase.from('financial_transactions').insert({
    user_id: user.id,
    amount_cents: cashoutAmount,
    transaction_type: 'partial_cashout',
    reference_id: betId,
    reference_type: 'bet',
    currency_type: currencyType,
    balance_before_cents: balanceBefore,
    balance_after_cents: balanceBefore + cashoutAmount,
    metadata: {
      percentage,
      original_stake: bet.stake,
      remaining_stake: newStake,
      cashed_out_amount: cashoutAmount,
    },
  });

  // Update user balance
  await supabase.rpc('update_user_points_safe', {
    user_uuid: user.id,
    points_change: cashoutAmount,
    transaction_type: 'partial_cashout',
    reference_id: betId,
    reference_type: 'bet',
    currency_type: currencyType,
  });
};

// Helper to get current balance
const getCurrentBalance = async (userId: string, currencyType: 'virtual' | 'real'): Promise<number> => {
  const column = currencyType === 'real' ? 'balance_cents' : 'points';
  const { data } = await supabase
    .from('users')
    .select(column)
    .eq('id', userId)
    .single();
  
  if (!data) return 0;
  return (data as Record<string, number>)[column] || 0;
};

// Partial cashout for parlays
export const partialCashOutParlay = async (
  parlayId: string,
  cashoutAmount: number,
  percentage: number,
  currencyType: 'virtual' | 'real' = 'virtual'
): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: parlay, error: fetchError } = await supabase
    .from('parlays')
    .select('total_stake')
    .eq('id', parlayId)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !parlay) throw new Error('Parlay not found');

  const remainingPercentage = 100 - percentage;
  const newStake = Math.floor(parlay.total_stake * (remainingPercentage / 100));

  if (remainingPercentage <= 0) {
    const { error: parlayError } = await supabase
      .from('parlays')
      .update({
        result: 'cashed_out',
        cashed_out_at: new Date().toISOString(),
        cashout_amount: cashoutAmount,
      })
      .eq('id', parlayId)
      .eq('user_id', user.id);

    if (parlayError) throw parlayError;
  } else {
    const { error: parlayError } = await supabase
      .from('parlays')
      .update({
        total_stake: newStake,
      })
      .eq('id', parlayId)
      .eq('user_id', user.id);

    if (parlayError) throw parlayError;
  }

  // Add transaction with metadata
  const balanceBefore = await getCurrentBalance(user.id, currencyType);
  
  await supabase.from('financial_transactions').insert({
    user_id: user.id,
    amount_cents: cashoutAmount,
    transaction_type: 'partial_cashout',
    reference_id: parlayId,
    reference_type: 'parlay',
    currency_type: currencyType,
    balance_before_cents: balanceBefore,
    balance_after_cents: balanceBefore + cashoutAmount,
    metadata: {
      percentage,
      original_stake: parlay.total_stake,
      remaining_stake: newStake,
      cashed_out_amount: cashoutAmount,
    },
  });

  await supabase.rpc('update_user_points_safe', {
    user_uuid: user.id,
    points_change: cashoutAmount,
    transaction_type: 'partial_cashout',
    reference_id: parlayId,
    reference_type: 'parlay',
    currency_type: currencyType,
  });
};

// Partial cashout for combined bets
export const partialCashOutCombinedBet = async (
  combinedBetId: string,
  cashoutAmount: number,
  percentage: number,
  currencyType: 'virtual' | 'real' = 'virtual'
): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: combinedBet, error: fetchError } = await supabase
    .from('combined_bets')
    .select('total_stake')
    .eq('id', combinedBetId)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !combinedBet) throw new Error('Combined bet not found');

  const remainingPercentage = 100 - percentage;
  const newStake = Math.floor(combinedBet.total_stake * (remainingPercentage / 100));

  if (remainingPercentage <= 0) {
    const { error: betError } = await supabase
      .from('combined_bets')
      .update({
        result: 'cashed_out',
        cashed_out_at: new Date().toISOString(),
        cashout_amount: cashoutAmount,
      })
      .eq('id', combinedBetId)
      .eq('user_id', user.id);

    if (betError) throw betError;
  } else {
    const { error: betError } = await supabase
      .from('combined_bets')
      .update({
        total_stake: newStake,
      })
      .eq('id', combinedBetId)
      .eq('user_id', user.id);

    if (betError) throw betError;
  }

  // Add transaction with metadata
  const balanceBefore = await getCurrentBalance(user.id, currencyType);
  
  await supabase.from('financial_transactions').insert({
    user_id: user.id,
    amount_cents: cashoutAmount,
    transaction_type: 'partial_cashout',
    reference_id: combinedBetId,
    reference_type: 'combined_bet',
    currency_type: currencyType,
    balance_before_cents: balanceBefore,
    balance_after_cents: balanceBefore + cashoutAmount,
    metadata: {
      percentage,
      original_stake: combinedBet.total_stake,
      remaining_stake: newStake,
      cashed_out_amount: cashoutAmount,
    },
  });

  await supabase.rpc('update_user_points_safe', {
    user_uuid: user.id,
    points_change: cashoutAmount,
    transaction_type: 'partial_cashout',
    reference_id: combinedBetId,
    reference_type: 'combined_bet',
    currency_type: currencyType,
  });
};
