import { awardXP, XP_REWARDS } from '@/lib/level-system';
import { toast } from 'sonner';

export const useLevelSystem = () => {
  const awardXPForAction = async (action: keyof typeof XP_REWARDS) => {
    try {
      const xpAmount = XP_REWARDS[action];
      const result = await awardXP(xpAmount);

      // Show XP gained toast
      toast.success(`+${xpAmount} XP earned!`, {
        duration: 2000,
      });

      // Show level up notification
      if (result.leveledUp) {
        toast.success(
          `🎉 Level Up! You reached Level ${result.newLevel}!`,
          {
            description: `Reward: +${result.reward} points`,
            duration: 5000,
          }
        );
      }

      return result;
    } catch (error) {
      console.error('Error awarding XP:', error);
      // Silently fail - don't interrupt the main flow
      return null;
    }
  };

  return { awardXPForAction };
};
