import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type ParlayInsert = Database['public']['Tables']['parlays']['Insert'];
type ParlayLegInsert = Database['public']['Tables']['parlay_legs']['Insert'];
type Parlay = Database['public']['Tables']['parlays']['Row'];
type ParlayLeg = Database['public']['Tables']['parlay_legs']['Row'];

export interface ParlayPrediction {
  city: string;
  predictionType: 'rain' | 'temperature';
  predictionValue: string;
  odds: number;
}

export interface ParlayWithLegs extends Parlay {
  parlay_legs: ParlayLeg[];
}

export const createParlay = async (
  stake: number,
  predictions: ParlayPrediction[],
  betDurationDays: number
): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Calculate combined odds (multiply all odds together)
  const combinedOdds = predictions.reduce((total, pred) => total * pred.odds, 1);

  // Calculate expiration
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + betDurationDays);

  // Create the parlay
  const { data: parlay, error: parlayError } = await supabase
    .from('parlays')
    .insert({
      user_id: user.id,
      total_stake: stake,
      combined_odds: combinedOdds,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (parlayError) throw parlayError;

  // Create all legs
  const legs = predictions.map(pred => ({
    parlay_id: parlay.id,
    city: pred.city,
    prediction_type: pred.predictionType,
    prediction_value: pred.predictionValue,
    odds: pred.odds,
  }));

  const { error: legsError } = await supabase
    .from('parlay_legs')
    .insert(legs);

  if (legsError) throw legsError;

  return parlay.id;
};

export const getParlays = async (limit?: number): Promise<ParlayWithLegs[]> => {
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

export const cashOutParlay = async (parlayId: string, cashoutAmount: number): Promise<void> => {
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

  // Update user points - import from supabase-auth-storage
  const { data: userData } = await supabase
    .from('users')
    .select('points')
    .eq('id', user.id)
    .single();

  if (userData) {
    await supabase
      .from('users')
      .update({ points: userData.points + cashoutAmount })
      .eq('id', user.id);
  }
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
