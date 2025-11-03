import { useEffect, useState } from 'react';
import { getChallenges, getUserChallenges, updateChallengeProgress, updateUserPoints, getUser } from '@/lib/supabase-auth-storage';
import { toast } from 'sonner';

interface Challenge {
  id: string;
  title: string;
  challenge_type: string;
  target_value: number;
  reward_points: number;
}

export const useChallengeTracker = () => {
  const [challenges, setChallenges] = useState<Challenge[]>([]);

  useEffect(() => {
    loadChallenges();
  }, []);

  const loadChallenges = async () => {
    try {
      const allChallenges = await getChallenges();
      setChallenges(allChallenges);
    } catch (error) {
      console.error('Error loading challenges:', error);
    }
  };

  const checkAndUpdateChallenges = async (
    eventType: 'bet_placed' | 'bet_won',
    eventData: { stake?: number; city?: string }
  ) => {
    try {
      const userChallenges = await getUserChallenges();
      const today = new Date().toISOString().split('T')[0];

      for (const challenge of challenges) {
        const userChallenge = userChallenges.find(uc => uc.challenge_id === challenge.id);
        
        if (userChallenge?.completed) continue;

        let shouldUpdate = false;
        let newProgress = userChallenge?.progress || 0;

        // Check if this event matches the challenge type
        if (eventType === 'bet_placed' && challenge.challenge_type === 'daily_bets') {
          newProgress += 1;
          shouldUpdate = true;
        } else if (eventType === 'bet_won' && challenge.challenge_type === 'daily_wins') {
          newProgress += 1;
          shouldUpdate = true;
        } else if (eventType === 'bet_placed' && challenge.challenge_type === 'high_stake' && eventData.stake) {
          if (eventData.stake >= challenge.target_value) {
            newProgress = challenge.target_value;
            shouldUpdate = true;
          }
        }

        if (shouldUpdate) {
          const completed = newProgress >= challenge.target_value;
          
          await updateChallengeProgress(challenge.id, newProgress, completed);

          if (completed && !userChallenge?.completed) {
            // Award bonus points
            const userData = await getUser();
            if (userData) {
              await updateUserPoints(userData.points + challenge.reward_points);
              toast.success(`Challenge Complete! 🎉`, {
                description: `You earned ${challenge.reward_points} bonus points for completing "${challenge.title}"!`
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error updating challenges:', error);
    }
  };

  return { checkAndUpdateChallenges };
};
