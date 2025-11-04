import { supabase } from '@/integrations/supabase/client';
import { awardXP, XP_REWARDS } from './level-system';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  badge_icon: string;
  requirement_type: string;
  requirement_value: number;
  points_reward: number;
  is_active: boolean;
  created_at: string;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
  created_at: string;
}

export interface AchievementWithProgress extends Achievement {
  unlocked: boolean;
  progress: number;
  unlocked_at?: string;
}

// Get all achievements with user progress
export const getAchievementsWithProgress = async (): Promise<AchievementWithProgress[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get all active achievements
  const { data: achievements, error: achievementsError } = await supabase
    .from('achievements')
    .select('*')
    .eq('is_active', true)
    .order('points_reward', { ascending: true });

  if (achievementsError) throw achievementsError;
  if (!achievements) return [];

  // Get user's unlocked achievements
  const { data: userAchievements, error: userAchievementsError } = await supabase
    .from('user_achievements')
    .select('*')
    .eq('user_id', user.id);

  if (userAchievementsError) throw userAchievementsError;

  // Calculate progress for each achievement
  const progress = await calculateProgress(user.id);

  return achievements.map(achievement => {
    const userAchievement = userAchievements?.find(ua => ua.achievement_id === achievement.id);
    const currentProgress = progress[achievement.requirement_type] || 0;
    
    return {
      ...achievement,
      unlocked: !!userAchievement,
      progress: Math.min(currentProgress, achievement.requirement_value),
      unlocked_at: userAchievement?.unlocked_at,
    };
  });
};

// Calculate user progress for all achievement types
const calculateProgress = async (userId: string): Promise<Record<string, number>> => {
  // Get all user bets
  const { data: bets } = await supabase
    .from('bets')
    .select('*')
    .eq('user_id', userId);

  if (!bets) return {};

  const totalBets = bets.length;
  const totalWins = bets.filter(b => b.result === 'win').length;
  const totalStake = bets.reduce((sum, b) => sum + b.stake, 0);
  const uniqueCities = new Set(bets.map(b => b.city)).size;

  // Calculate win streak
  const sortedBets = [...bets]
    .filter(b => b.result !== 'pending')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  let winStreak = 0;
  for (const bet of sortedBets) {
    if (bet.result === 'win') {
      winStreak++;
    } else {
      break;
    }
  }

  // Get completed challenges count
  const { data: completedChallenges } = await supabase
    .from('user_challenges')
    .select('*')
    .eq('user_id', userId)
    .eq('completed', true);

  const challengesCompleted = completedChallenges?.length || 0;

  // Get max single stake
  const singleStake = Math.max(...bets.map(b => b.stake), 0);

  return {
    total_bets: totalBets,
    total_wins: totalWins,
    total_stake: totalStake,
    unique_cities: uniqueCities,
    win_streak: winStreak,
    challenges_completed: challengesCompleted,
    single_stake: singleStake,
  };
};

// Check and unlock achievements
export const checkAndUnlockAchievements = async (): Promise<string[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const achievementsWithProgress = await getAchievementsWithProgress();
  const newlyUnlocked: string[] = [];

  for (const achievement of achievementsWithProgress) {
    if (!achievement.unlocked && achievement.progress >= achievement.requirement_value) {
      // Unlock the achievement
      const { error } = await supabase
        .from('user_achievements')
        .insert({
          user_id: user.id,
          achievement_id: achievement.id,
        });

      if (!error) {
        // Award points
        await awardAchievementPoints(achievement.points_reward);
        // Award XP for unlocking achievement
        await awardXP(XP_REWARDS.ACHIEVEMENT_UNLOCKED);
        newlyUnlocked.push(achievement.title);
      }
    }
  }

  return newlyUnlocked;
};

// Award bonus points for unlocking achievement
const awardAchievementPoints = async (points: number): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: userData } = await supabase
    .from('users')
    .select('points')
    .eq('id', user.id)
    .single();

  if (userData) {
    await supabase
      .from('users')
      .update({ points: userData.points + points })
      .eq('id', user.id);
  }
};
