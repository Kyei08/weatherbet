import { useCallback, useRef } from 'react';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';

// Web Audio API notification sound generator
export function useNotificationSound() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const { preferences } = useUserPreferences();

  const playSound = useCallback((type: 'success' | 'error' | 'info' = 'success') => {
    // Check if sound is enabled in user preferences
    if (!preferences.soundEnabled) {
      return;
    }

    try {
      // Create audio context on demand (required for user interaction policy)
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      // Different sound profiles based on type
      const soundProfiles = {
        success: { frequencies: [523.25, 659.25, 783.99], duration: 0.15 }, // C5, E5, G5 - pleasant chime
        error: { frequencies: [392, 349.23], duration: 0.2 }, // G4, F4 - descending tone
        info: { frequencies: [523.25, 587.33], duration: 0.12 }, // C5, D5 - soft notification
      };
      
      const profile = soundProfiles[type];
      const now = ctx.currentTime;
      
      // Play sequence of tones
      profile.frequencies.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + index * profile.duration);
        
        // Envelope: quick attack, smooth decay
        gain.gain.setValueAtTime(0, now + index * profile.duration);
        gain.gain.linearRampToValueAtTime(0.3, now + index * profile.duration + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.01, now + index * profile.duration + profile.duration);
        
        osc.start(now + index * profile.duration);
        osc.stop(now + index * profile.duration + profile.duration);
      });
    } catch (error) {
      console.warn('Failed to play notification sound:', error);
    }
  }, [preferences.soundEnabled]);

  return { playSound };
}
