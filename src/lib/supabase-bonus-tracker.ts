import { supabase } from '@/integrations/supabase/client';

export interface BonusEarning {
  id: string;
  user_id: string;
  bonus_type: 'multiplier' | 'bonus_points' | 'stake_boost';
  bonus_amount: number;
  base_amount: number;
  item_id: string | null;
  bet_id: string | null;
  parlay_id: string | null;
  created_at: string;
}

export interface BonusStats {
  totalBonusEarnings: number;
  multiplierEarnings: number;
  bonusPointsEarnings: number;
  stakeBoostEarnings: number;
  earningsThisWeek: number;
  earningsThisMonth: number;
  averageBonus: number;
  totalBonusCount: number;
}

// Record a bonus earning
export const recordBonusEarning = async (
  bonusType: BonusEarning['bonus_type'],
  bonusAmount: number,
  baseAmount: number,
  itemId?: string,
  betId?: string,
  parlayId?: string
): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('bonus_earnings')
    .insert({
      user_id: user.id,
      bonus_type: bonusType,
      bonus_amount: bonusAmount,
      base_amount: baseAmount,
      item_id: itemId || null,
      bet_id: betId || null,
      parlay_id: parlayId || null,
    });

  if (error) throw error;
};

// Get all bonus earnings for current user
export const getBonusEarnings = async (limit?: number): Promise<BonusEarning[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from('bonus_earnings')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []).map(item => ({
    ...item,
    bonus_type: item.bonus_type as BonusEarning['bonus_type'],
  }));
};

// Get bonus statistics
export const getBonusStats = async (): Promise<BonusStats> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      totalBonusEarnings: 0,
      multiplierEarnings: 0,
      bonusPointsEarnings: 0,
      stakeBoostEarnings: 0,
      earningsThisWeek: 0,
      earningsThisMonth: 0,
      averageBonus: 0,
      totalBonusCount: 0,
    };
  }

  // Get all earnings
  const { data: allEarnings, error: allError } = await supabase
    .from('bonus_earnings')
    .select('*')
    .eq('user_id', user.id);

  if (allError) throw allError;

  const earnings = allEarnings || [];
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const totalBonusEarnings = earnings.reduce((sum, e) => sum + e.bonus_amount, 0);
  const multiplierEarnings = earnings
    .filter(e => e.bonus_type === 'multiplier')
    .reduce((sum, e) => sum + e.bonus_amount, 0);
  const bonusPointsEarnings = earnings
    .filter(e => e.bonus_type === 'bonus_points')
    .reduce((sum, e) => sum + e.bonus_amount, 0);
  const stakeBoostEarnings = earnings
    .filter(e => e.bonus_type === 'stake_boost')
    .reduce((sum, e) => sum + e.bonus_amount, 0);

  const earningsThisWeek = earnings
    .filter(e => new Date(e.created_at) >= weekAgo)
    .reduce((sum, e) => sum + e.bonus_amount, 0);

  const earningsThisMonth = earnings
    .filter(e => new Date(e.created_at) >= monthAgo)
    .reduce((sum, e) => sum + e.bonus_amount, 0);

  const averageBonus = earnings.length > 0 ? totalBonusEarnings / earnings.length : 0;

  return {
    totalBonusEarnings,
    multiplierEarnings,
    bonusPointsEarnings,
    stakeBoostEarnings,
    earningsThisWeek,
    earningsThisMonth,
    averageBonus,
    totalBonusCount: earnings.length,
  };
};

// Get bonus earnings over time for charting
export const getBonusEarningsOverTime = async (days: number = 30): Promise<{ date: string; amount: number }[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('bonus_earnings')
    .select('bonus_amount, created_at')
    .eq('user_id', user.id)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (!data) return [];

  // Group by date
  const groupedByDate: { [key: string]: number } = {};
  
  data.forEach(earning => {
    const date = new Date(earning.created_at).toISOString().split('T')[0];
    if (!groupedByDate[date]) {
      groupedByDate[date] = 0;
    }
    groupedByDate[date] += earning.bonus_amount;
  });

  // Convert to array and fill missing dates
  const result: { date: string; amount: number }[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    result.push({
      date: dateStr,
      amount: groupedByDate[dateStr] || 0,
    });
  }

  return result;
};
