import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Perk {
  id: string;
  title: string;
  description: string;
  perk_icon: string;
  perk_type: 'bet_multiplier' | 'bonus_points' | 'max_stake_increase' | 'win_bonus';
  perk_value: number;
  unlock_level: number;
  is_active: boolean;
  created_at: string;
}

export interface UserPerk {
  id: string;
  user_id: string;
  perk_id: string;
  unlocked_at: string;
  created_at: string;
}

export interface PerkWithStatus extends Perk {
  unlocked: boolean;
  unlocked_at?: string;
}

// Get all perks with user unlock status
export const getPerksWithStatus = async (userLevel: number): Promise<PerkWithStatus[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get all active perks
  const { data: perks, error: perksError } = await supabase
    .from('perks')
    .select('*')
    .eq('is_active', true)
    .order('unlock_level', { ascending: true });

  if (perksError) throw perksError;
  if (!perks) return [];

  // Get user's unlocked perks
  const { data: userPerks, error: userPerksError } = await supabase
    .from('user_perks')
    .select('*')
    .eq('user_id', user.id);

  if (userPerksError) throw userPerksError;

  return perks.map(perk => {
    const userPerk = userPerks?.find(up => up.perk_id === perk.id);
    return {
      ...perk,
      perk_type: perk.perk_type as 'bet_multiplier' | 'bonus_points' | 'max_stake_increase' | 'win_bonus',
      unlocked: !!userPerk || userLevel >= perk.unlock_level,
      unlocked_at: userPerk?.unlocked_at,
    };
  });
};

// Get user's active perks (unlocked perks)
export const getActivePerks = async (): Promise<Perk[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get user level
  const { data: userData } = await supabase
    .from('users')
    .select('level')
    .eq('id', user.id)
    .single();

  if (!userData) return [];

  // Get all perks that user has unlocked based on level
  const { data: perks, error } = await supabase
    .from('perks')
    .select('*')
    .eq('is_active', true)
    .lte('unlock_level', userData.level)
    .order('unlock_level', { ascending: true });

  if (error) throw error;
  return (perks || []).map(perk => ({
    ...perk,
    perk_type: perk.perk_type as 'bet_multiplier' | 'bonus_points' | 'max_stake_increase' | 'win_bonus',
  }));
};

// Check and unlock new perks when leveling up
export const checkAndUnlockPerks = async (newLevel: number): Promise<string[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get perks that should be unlocked at this level
  const { data: perks } = await supabase
    .from('perks')
    .select('*')
    .eq('is_active', true)
    .eq('unlock_level', newLevel);

  if (!perks || perks.length === 0) return [];

  const newlyUnlocked: string[] = [];

  for (const perk of perks) {
    // Check if already unlocked
    const { data: existing } = await supabase
      .from('user_perks')
      .select('id')
      .eq('user_id', user.id)
      .eq('perk_id', perk.id)
      .maybeSingle();

    if (!existing) {
      // Unlock the perk
      const { error } = await supabase
        .from('user_perks')
        .insert({
          user_id: user.id,
          perk_id: perk.id,
        });

      if (!error) {
        newlyUnlocked.push(perk.title);
      }
    }
  }

  return newlyUnlocked;
};

// Calculate perk bonuses for betting
export interface PerkBonuses {
  betMultiplier: number;
  bonusPoints: number;
  maxStakeIncrease: number;
  winBonus: number;
}

export const calculatePerkBonuses = async (): Promise<PerkBonuses> => {
  const activePerks = await getActivePerks();

  const bonuses: PerkBonuses = {
    betMultiplier: 1,
    bonusPoints: 0,
    maxStakeIncrease: 0,
    winBonus: 0,
  };

  for (const perk of activePerks) {
    switch (perk.perk_type) {
      case 'bet_multiplier':
        bonuses.betMultiplier *= perk.perk_value;
        break;
      case 'bonus_points':
        bonuses.bonusPoints += perk.perk_value;
        break;
      case 'max_stake_increase':
        bonuses.maxStakeIncrease += perk.perk_value;
        break;
      case 'win_bonus':
        bonuses.winBonus += perk.perk_value;
        break;
    }
  }

  return bonuses;
};

// Apply win bonus to points
export const applyWinBonus = async (basePoints: number): Promise<number> => {
  const bonuses = await calculatePerkBonuses();
  return Math.floor(basePoints * (1 + bonuses.winBonus));
};
