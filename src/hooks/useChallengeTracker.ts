import { trackBetPlaced, trackBetWon } from '@/lib/supabase-challenges';

export const useChallengeTracker = () => {
  const checkAndUpdateChallenges = async (
    eventType: 'bet_placed' | 'bet_won',
    data?: { stake?: number; city?: string }
  ) => {
    try {
      if (eventType === 'bet_placed' && data?.stake && data?.city) {
        await trackBetPlaced(data.stake, data.city);
      } else if (eventType === 'bet_won') {
        await trackBetWon();
      }
    } catch (error) {
      console.error('Error tracking challenge:', error);
      // Silently fail - don't interrupt the main flow
    }
  };

  return { checkAndUpdateChallenges };
};
