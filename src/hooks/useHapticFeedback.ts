import { useCallback } from 'react';
import { useUserPreferences, NotificationEventType } from '@/contexts/UserPreferencesContext';

export function useHapticFeedback() {
  const { preferences, shouldNotify } = useUserPreferences();

  const vibrate = useCallback((pattern: number | number[] = 50, eventType?: NotificationEventType) => {
    // Check if haptics are enabled and vibration API is available
    if (!preferences.hapticsEnabled || !navigator.vibrate) {
      return;
    }

    // Check if this specific event type should notify
    if (eventType && !shouldNotify(eventType)) {
      return;
    }

    try {
      navigator.vibrate(pattern);
    } catch (error) {
      console.warn('Haptic feedback failed:', error);
    }
  }, [preferences.hapticsEnabled, shouldNotify]);

  const vibrateSuccess = useCallback((eventType?: NotificationEventType) => {
    // Short double pulse for success
    vibrate([50, 50, 50], eventType);
  }, [vibrate]);

  const vibrateError = useCallback((eventType?: NotificationEventType) => {
    // Longer single pulse for error/loss
    vibrate(150, eventType);
  }, [vibrate]);

  const vibrateInfo = useCallback((eventType?: NotificationEventType) => {
    // Quick single tap for info
    vibrate(30, eventType);
  }, [vibrate]);

  return { vibrate, vibrateSuccess, vibrateError, vibrateInfo };
}
