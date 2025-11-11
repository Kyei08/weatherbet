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
  hasInsurance: boolean = false
): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Calculate combined odds
  const combinedOdds = categories.reduce((total, cat) => total * cat.odds, 1);

  // Calculate insurance cost if applicable
  const insuranceCost = hasInsurance ? Math.floor(stake * 0.2) : 0;
  const totalCost = stake + insuranceCost;

  // Deduct points from user
  const { error: pointsError } = await supabase.rpc('update_user_points', {
    user_uuid: user.id,
    points_change: -totalCost
  });

  if (pointsError) throw pointsError;

  // Create combined bet
  const { data: combinedBet, error: betError } = await supabase
    .from('combined_bets')
    .insert({
      user_id: user.id,
      city,
      target_date: targetDate.toISOString(),
      total_stake: stake,
      combined_odds: combinedOdds,
      has_insurance: hasInsurance,
      insurance_cost: insuranceCost,
      insurance_payout_percentage: 0.8
    })
    .select()
    .single();

  if (betError) throw betError;

  // Create category predictions
  const categoryInserts = categories.map(cat => ({
    combined_bet_id: combinedBet.id,
    prediction_type: cat.predictionType,
    prediction_value: cat.predictionValue,
    odds: cat.odds
  }));

  const { error: categoriesError } = await supabase
    .from('combined_bet_categories')
    .insert(categoryInserts);

  if (categoriesError) throw categoriesError;

  return combinedBet.id;
};

export const getCombinedBets = async (limit?: number): Promise<CombinedBetWithCategories[]> => {
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
  cashoutAmount: number
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

  // Add points to user
  const { error: pointsError } = await supabase.rpc('update_user_points', {
    user_uuid: user.id,
    points_change: cashoutAmount
  });

  if (pointsError) throw pointsError;
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
