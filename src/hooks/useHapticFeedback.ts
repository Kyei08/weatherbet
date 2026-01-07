import { useCallback } from 'react';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';

export function useHapticFeedback() {
  const { preferences } = useUserPreferences();

  const vibrate = useCallback((pattern: number | number[] = 50) => {
    // Check if haptics are enabled and vibration API is available
    if (!preferences.hapticsEnabled || !navigator.vibrate) {
      return;
    }

    try {
      navigator.vibrate(pattern);
    } catch (error) {
      console.warn('Haptic feedback failed:', error);
    }
  }, [preferences.hapticsEnabled]);

  const vibrateSuccess = useCallback(() => {
    // Short double pulse for success
    vibrate([50, 50, 50]);
  }, [vibrate]);

  const vibrateError = useCallback(() => {
    // Longer single pulse for error/loss
    vibrate(150);
  }, [vibrate]);

  const vibrateInfo = useCallback(() => {
    // Quick single tap for info
    vibrate(30);
  }, [vibrate]);

  return { vibrate, vibrateSuccess, vibrateError, vibrateInfo };
}
