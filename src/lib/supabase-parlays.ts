import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type ParlayInsert = Database['public']['Tables']['parlays']['Insert'];
type ParlayLegInsert = Database['public']['Tables']['parlay_legs']['Insert'];
type Parlay = Database['public']['Tables']['parlays']['Row'];
type ParlayLeg = Database['public']['Tables']['parlay_legs']['Row'];

export interface ParlayPrediction {
  city: string;
  predictionType: 'rain' | 'temperature' | 'rainfall' | 'snow' | 'wind' | 'dew_point' | 'pressure' | 'cloud_coverage';
  predictionValue: string;
  odds: number;
}

export interface ParlayWithLegs extends Parlay {
  parlay_legs: ParlayLeg[];
}

export const createParlay = async (
  stake: number,
  predictions: ParlayPrediction[],
  betDurationDays: number,
  targetDay: Date,
  hasInsurance: boolean = false,
  currencyType: 'virtual' | 'real' = 'virtual'
): Promise<string> => {
  // Calculate combined odds
  const combinedOdds = predictions.reduce((total, pred) => total * pred.odds, 1);

  // Deadline is day before the target day at 23:59:59
  const deadline = new Date(targetDay);
  deadline.setDate(deadline.getDate() - 1);
  deadline.setHours(23, 59, 59, 999);

  // Calculate insurance cost
  const insuranceCost = hasInsurance ? Math.floor(stake * 0.2) : 0;

  // Create parlay atomically (deducts balance and creates parlay)
  const { data: parlayId, error: parlayError } = await supabase.rpc('create_parlay_atomic', {
    _stake: stake,
    _combined_odds: combinedOdds,
    _expires_at: deadline.toISOString(),
    _has_insurance: hasInsurance,
    _insurance_cost: insuranceCost,
    _currency_type: currencyType
  });

  if (parlayError) throw parlayError;

  // Create all legs
  const legs = predictions.map(pred => ({
    parlay_id: parlayId,
    city: pred.city,
    prediction_type: pred.predictionType,
    prediction_value: pred.predictionValue,
    odds: pred.odds,
  }));

  const { error: legsError } = await supabase
    .from('parlay_legs')
    .insert(legs);

  if (legsError) throw legsError;

  return parlayId;
};

export const getParlays = async (limit?: number, currencyType?: 'virtual' | 'real'): Promise<ParlayWithLegs[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  let query = supabase
    .from('parlays')
    .select(`
      *,
      parlay_legs (*)
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

  return data as ParlayWithLegs[];
};

export const updateParlayResult = async (
  parlayId: string,
  result: 'win' | 'loss' | 'cashed_out'
): Promise<void> => {
  const { error } = await supabase
    .from('parlays')
    .update({ result })
    .eq('id', parlayId);

  if (error) throw error;
};

export const cashOutParlay = async (parlayId: string, cashoutAmount: number, currencyType: 'virtual' | 'real' = 'virtual'): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Update parlay status to cashed_out
  const { error: parlayError } = await supabase
    .from('parlays')
    .update({ 
      result: 'cashed_out',
      cashed_out_at: new Date().toISOString(),
      cashout_amount: cashoutAmount
    })
    .eq('id', parlayId)
    .eq('user_id', user.id);

  if (parlayError) throw parlayError;

  // Add points using safe function
  await supabase.rpc('update_user_points_safe', {
    user_uuid: user.id,
    points_change: cashoutAmount,
    transaction_type: 'cashout',
    reference_id: parlayId,
    reference_type: 'parlay',
    currency_type: currencyType
  });
};

export const updateParlayLegResult = async (
  legId: string,
  result: 'win' | 'loss'
): Promise<void> => {
  const { error } = await supabase
    .from('parlay_legs')
    .update({ result })
    .eq('id', legId);

  if (error) throw error;
};
