import { checkAndUnlockPerks } from '@/lib/supabase-perks';
import { toast } from 'sonner';

export const usePerkTracker = () => {
  const checkPerks = async (newLevel: number) => {
    try {
      const newlyUnlocked = await checkAndUnlockPerks(newLevel);
      
      // Show toast for each newly unlocked perk
      newlyUnlocked.forEach((title) => {
        toast.success(`✨ Perk Unlocked: ${title}!`, {
          duration: 5000,
        });
      });

      return newlyUnlocked;
    } catch (error) {
      console.error('Error checking perks:', error);
      // Silently fail - don't interrupt the main flow
      return [];
    }
  };

  return { checkPerks };
};
