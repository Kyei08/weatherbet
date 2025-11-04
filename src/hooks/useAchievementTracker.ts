import { checkAndUnlockAchievements } from '@/lib/supabase-achievements';
import { toast } from 'sonner';

export const useAchievementTracker = () => {
  const checkAchievements = async () => {
    try {
      const newlyUnlocked = await checkAndUnlockAchievements();
      
      // Show toast for each newly unlocked achievement
      newlyUnlocked.forEach((title) => {
        toast.success(`🏆 Achievement Unlocked: ${title}!`, {
          duration: 5000,
        });
      });

      return newlyUnlocked;
    } catch (error) {
      console.error('Error checking achievements:', error);
      // Silently fail - don't interrupt the main flow
      return [];
    }
  };

  return { checkAchievements };
};
