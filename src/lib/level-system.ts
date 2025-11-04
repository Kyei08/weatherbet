import { supabase } from '@/integrations/supabase/client';

// XP rewards for different actions
export const XP_REWARDS = {
  BET_PLACED: 10,
  BET_WON: 25,
  BET_LOST: 5,
  CHALLENGE_COMPLETED: 50,
  ACHIEVEMENT_UNLOCKED: 100,
  DAILY_LOGIN: 20,
} as const;

// Level progression - XP required for each level
export const LEVEL_XP_REQUIREMENTS = [
  0,      // Level 1 (starting level)
  100,    // Level 2
  250,    // Level 3
  450,    // Level 4
  700,    // Level 5
  1000,   // Level 6
  1400,   // Level 7
  1900,   // Level 8
  2500,   // Level 9
  3200,   // Level 10
  4000,   // Level 11
  5000,   // Level 12
  6200,   // Level 13
  7600,   // Level 14
  9200,   // Level 15
  11000,  // Level 16
  13000,  // Level 17
  15500,  // Level 18
  18500,  // Level 19
  22000,  // Level 20
];

// Calculate level from XP
export const calculateLevel = (xp: number): number => {
  let level = 1;
  for (let i = LEVEL_XP_REQUIREMENTS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_XP_REQUIREMENTS[i]) {
      level = i + 1;
      break;
    }
  }
  return level;
};

// Get XP required for next level
export const getXpForNextLevel = (currentLevel: number): number => {
  if (currentLevel >= LEVEL_XP_REQUIREMENTS.length) {
    return LEVEL_XP_REQUIREMENTS[LEVEL_XP_REQUIREMENTS.length - 1];
  }
  return LEVEL_XP_REQUIREMENTS[currentLevel];
};

// Get XP required for current level
export const getXpForCurrentLevel = (currentLevel: number): number => {
  if (currentLevel <= 1) return 0;
  return LEVEL_XP_REQUIREMENTS[currentLevel - 1];
};

// Calculate progress percentage to next level
export const getLevelProgress = (xp: number, level: number): number => {
  const currentLevelXp = getXpForCurrentLevel(level);
  const nextLevelXp = getXpForNextLevel(level);
  const xpInCurrentLevel = xp - currentLevelXp;
  const xpNeededForNextLevel = nextLevelXp - currentLevelXp;
  return Math.min(100, (xpInCurrentLevel / xpNeededForNextLevel) * 100);
};

// Get level rewards (bonus points for leveling up)
export const getLevelReward = (level: number): number => {
  return level * 50; // 50 points per level
};

// Award XP to user
export const awardXP = async (xpAmount: number): Promise<{ 
  leveledUp: boolean; 
  newLevel: number;
  oldLevel: number;
  reward: number;
}> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Get current user data
  const { data: userData, error: fetchError } = await supabase
    .from('users')
    .select('xp, level, points')
    .eq('id', user.id)
    .single();

  if (fetchError) throw fetchError;
  if (!userData) throw new Error('User data not found');

  const oldLevel = userData.level;
  const newXp = userData.xp + xpAmount;
  const newLevel = calculateLevel(newXp);
  const leveledUp = newLevel > oldLevel;

  // Calculate level up rewards
  let pointsReward = 0;
  if (leveledUp) {
    for (let i = oldLevel + 1; i <= newLevel; i++) {
      pointsReward += getLevelReward(i);
    }
  }

  // Update user with new XP, level, and bonus points
  const { error: updateError } = await supabase
    .from('users')
    .update({
      xp: newXp,
      level: newLevel,
      points: userData.points + pointsReward,
    })
    .eq('id', user.id);

  if (updateError) throw updateError;

  return {
    leveledUp,
    newLevel,
    oldLevel,
    reward: pointsReward,
  };
};

// Get user level info
export const getUserLevelInfo = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('users')
    .select('level, xp, points')
    .eq('id', user.id)
    .single();

  if (error) throw error;
  if (!data) return null;

  const xpForCurrentLevel = getXpForCurrentLevel(data.level);
  const xpForNextLevel = getXpForNextLevel(data.level);
  const progress = getLevelProgress(data.xp, data.level);

  return {
    level: data.level,
    xp: data.xp,
    points: data.points,
    xpForCurrentLevel,
    xpForNextLevel,
    xpInCurrentLevel: data.xp - xpForCurrentLevel,
    xpNeededForNextLevel: xpForNextLevel - xpForCurrentLevel,
    progress,
  };
};
