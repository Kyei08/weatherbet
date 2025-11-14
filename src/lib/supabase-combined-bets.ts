import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type CombinedBet = Database['public']['Tables']['combined_bets']['Row'];
type CombinedBetCategory = Database['public']['Tables']['combined_bet_categories']['Row'];

interface CategoryPrediction {
  predictionType: string;
  predictionValue: string;
  odds: number;
}

interface CombinedBetWithCategories extends CombinedBet {
  combined_bet_categories: CombinedBetCategory[];
}

export const createCombinedBet = async (
  city: string,
  stake: number,
  categories: CategoryPrediction[],
  targetDate: Date,
  hasInsurance: boolean = false,
  currencyType: 'virtual' | 'real' = 'virtual'
): Promise<string> => {
  // Calculate combined odds
  const combinedOdds = categories.reduce((total, cat) => total * cat.odds, 1);

  // Calculate insurance cost
  const insuranceCost = hasInsurance ? Math.floor(stake * 0.2) : 0;

  // Create combined bet atomically
  const { data: combinedBetId, error: betError } = await supabase.rpc('create_combined_bet_atomic', {
    _city: city,
    _stake: stake,
    _combined_odds: combinedOdds,
    _target_date: targetDate.toISOString(),
    _has_insurance: hasInsurance,
    _insurance_cost: insuranceCost,
    _currency_type: currencyType
  });

  if (betError) throw betError;

  // Create category predictions
  const categoryInserts = categories.map(cat => ({
    combined_bet_id: combinedBetId,
    prediction_type: cat.predictionType,
    prediction_value: cat.predictionValue,
    odds: cat.odds
  }));

  const { error: categoriesError } = await supabase
    .from('combined_bet_categories')
    .insert(categoryInserts);

  if (categoriesError) throw categoriesError;

  return combinedBetId;
};

export const getCombinedBets = async (limit?: number, currencyType?: 'virtual' | 'real'): Promise<CombinedBetWithCategories[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  let query = supabase
    .from('combined_bets')
    .select(`
      *,
      combined_bet_categories (*)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // Filter by currency type if specified
  if (currencyType) {
    query = query.eq('currency_type', currencyType);
  }

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as unknown as CombinedBetWithCategories[];
};

export const updateCombinedBetResult = async (
  combinedBetId: string,
  result: 'win' | 'loss' | 'cashed_out'
): Promise<void> => {
  const { error } = await supabase
    .from('combined_bets')
    .update({ result })
    .eq('id', combinedBetId);

  if (error) throw error;
};

export const cashOutCombinedBet = async (
  combinedBetId: string,
  cashoutAmount: number,
  currencyType: 'virtual' | 'real' = 'virtual'
): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Update bet as cashed out
  const { error: betError } = await supabase
    .from('combined_bets')
    .update({
      result: 'cashed_out',
      cashout_amount: cashoutAmount,
      cashed_out_at: new Date().toISOString()
    })
    .eq('id', combinedBetId);

  if (betError) throw betError;

  // Add points using safe function
  await supabase.rpc('update_user_points_safe', {
    user_uuid: user.id,
    points_change: cashoutAmount,
    transaction_type: 'cashout',
    reference_id: combinedBetId,
    reference_type: 'combined_bet',
    currency_type: currencyType
  });
};

export const updateCategoryResult = async (
  categoryId: string,
  result: 'win' | 'loss'
): Promise<void> => {
  const { error } = await supabase
    .from('combined_bet_categories')
    .update({ result })
    .eq('id', categoryId);

  if (error) throw error;
};
