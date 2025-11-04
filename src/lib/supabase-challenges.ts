import { supabase } from '@/integrations/supabase/client';
import { awardXP, XP_REWARDS } from './level-system';

export interface Challenge {
  id: string;
  title: string;
  description: string;
  challenge_type: string;
  target_value: number;
  reward_points: number;
  is_active: boolean;
  created_at: string;
}

export interface UserChallenge {
  id: string;
  user_id: string;
  challenge_id: string;
  progress: number;
  completed: boolean;
  completed_at: string | null;
  challenge_date: string;
  created_at: string;
  updated_at: string;
}

export interface ChallengeWithProgress extends Challenge {
  progress: number;
  completed: boolean;
  user_challenge_id?: string;
}

// Get all active challenges with user progress
export const getDailyChallenges = async (): Promise<ChallengeWithProgress[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const today = new Date().toISOString().split('T')[0];

  // Get all active challenges
  const { data: challenges, error: challengesError } = await supabase
    .from('challenges')
    .select('*')
    .eq('is_active', true);

  if (challengesError) throw challengesError;
  if (!challenges) return [];

  // Get user's progress for today
  const { data: userChallenges, error: userChallengesError } = await supabase
    .from('user_challenges')
    .select('*')
    .eq('user_id', user.id)
    .eq('challenge_date', today);

  if (userChallengesError) throw userChallengesError;

  // Merge challenges with user progress
  return challenges.map(challenge => {
    const userChallenge = userChallenges?.find(uc => uc.challenge_id === challenge.id);
    return {
      ...challenge,
      progress: userChallenge?.progress || 0,
      completed: userChallenge?.completed || false,
      user_challenge_id: userChallenge?.id,
    };
  });
};

// Update challenge progress
export const updateChallengeProgress = async (
  challengeId: string,
  progress: number
): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const today = new Date().toISOString().split('T')[0];

  // Check if challenge exists for today
  const { data: existing } = await supabase
    .from('user_challenges')
    .select('*')
    .eq('user_id', user.id)
    .eq('challenge_id', challengeId)
    .eq('challenge_date', today)
    .maybeSingle();

  // Get challenge target value
  const { data: challenge } = await supabase
    .from('challenges')
    .select('target_value, reward_points')
    .eq('id', challengeId)
    .single();

  if (!challenge) return;

  const completed = progress >= challenge.target_value;
  const completedAt = completed ? new Date().toISOString() : null;

  if (existing) {
    // Update existing progress
    const { error } = await supabase
      .from('user_challenges')
      .update({
        progress,
        completed,
        completed_at: completedAt,
      })
      .eq('id', existing.id);

    if (error) throw error;

    // Award points if just completed
    if (completed && !existing.completed) {
      await awardChallengePoints(challenge.reward_points);
      // Award XP for completing challenge
      await awardXP(XP_REWARDS.CHALLENGE_COMPLETED);
    }
  } else {
    // Create new progress record
    const { error } = await supabase
      .from('user_challenges')
      .insert({
        user_id: user.id,
        challenge_id: challengeId,
        progress,
        completed,
        completed_at: completedAt,
        challenge_date: today,
      });

    if (error) throw error;

    // Award points if completed on first insert
    if (completed) {
      await awardChallengePoints(challenge.reward_points);
      // Award XP for completing challenge
      await awardXP(XP_REWARDS.CHALLENGE_COMPLETED);
    }
  }
};

// Award bonus points for completing challenge
const awardChallengePoints = async (points: number): Promise<void> => {
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

// Track bet placement for challenges
export const trackBetPlaced = async (stake: number, city: string): Promise<void> => {
  const challenges = await getDailyChallenges();
  
  for (const challenge of challenges) {
    if (challenge.completed) continue;

    switch (challenge.challenge_type) {
      case 'daily_bets':
        await updateChallengeProgress(challenge.id, challenge.progress + 1);
        break;
      case 'high_stake':
        if (stake >= challenge.target_value) {
          await updateChallengeProgress(challenge.id, challenge.target_value);
        }
        break;
      case 'different_cities':
        await trackUniqueCities(challenge.id, city);
        break;
    }
  }
};

// Track wins for challenges
export const trackBetWon = async (): Promise<void> => {
  const challenges = await getDailyChallenges();
  
  for (const challenge of challenges) {
    if (challenge.completed) continue;

    if (challenge.challenge_type === 'daily_wins') {
      await updateChallengeProgress(challenge.id, challenge.progress + 1);
    } else if (challenge.challenge_type === 'win_streak') {
      await updateWinStreak(challenge.id);
    }
  }
};

// Track unique cities for City Explorer challenge
const trackUniqueCities = async (challengeId: string, city: string): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const today = new Date().toISOString().split('T')[0];
  
  // Get today's bets to count unique cities
  const { data: bets } = await supabase
    .from('bets')
    .select('city')
    .eq('user_id', user.id)
    .gte('created_at', today + 'T00:00:00Z');

  if (bets) {
    const uniqueCities = new Set(bets.map(b => b.city));
    await updateChallengeProgress(challengeId, uniqueCities.size);
  }
};

// Track win streaks
const updateWinStreak = async (challengeId: string): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Get recent bets ordered by date
  const { data: recentBets } = await supabase
    .from('bets')
    .select('result')
    .eq('user_id', user.id)
    .neq('result', 'pending')
    .order('created_at', { ascending: false })
    .limit(10);

  if (!recentBets) return;

  // Calculate current win streak
  let streak = 0;
  for (const bet of recentBets) {
    if (bet.result === 'win') {
      streak++;
    } else {
      break;
    }
  }

  await updateChallengeProgress(challengeId, streak);
};
