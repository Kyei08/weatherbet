import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type NotificationEventType = 'wins' | 'losses' | 'cashouts';

interface UserPreferences {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  notifyOnWins: boolean;
  notifyOnLosses: boolean;
  notifyOnCashouts: boolean;
}

interface UserPreferencesContextType {
  preferences: UserPreferences;
  setSoundEnabled: (enabled: boolean) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setNotifyOnWins: (enabled: boolean) => void;
  setNotifyOnLosses: (enabled: boolean) => void;
  setNotifyOnCashouts: (enabled: boolean) => void;
  shouldNotify: (eventType: NotificationEventType) => boolean;
}

const STORAGE_KEY = 'weather-betting-preferences';

const defaultPreferences: UserPreferences = {
  soundEnabled: true,
  hapticsEnabled: true,
  notifyOnWins: true,
  notifyOnLosses: true,
  notifyOnCashouts: true,
};

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

export const UserPreferencesProvider = ({ children }: { children: ReactNode }) => {
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...defaultPreferences, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.warn('Failed to load preferences:', error);
    }
    return defaultPreferences;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.warn('Failed to save preferences:', error);
    }
  }, [preferences]);

  const setSoundEnabled = (enabled: boolean) => {
    setPreferences(prev => ({ ...prev, soundEnabled: enabled }));
  };

  const setHapticsEnabled = (enabled: boolean) => {
    setPreferences(prev => ({ ...prev, hapticsEnabled: enabled }));
  };

  const setNotifyOnWins = (enabled: boolean) => {
    setPreferences(prev => ({ ...prev, notifyOnWins: enabled }));
  };

  const setNotifyOnLosses = (enabled: boolean) => {
    setPreferences(prev => ({ ...prev, notifyOnLosses: enabled }));
  };

  const setNotifyOnCashouts = (enabled: boolean) => {
    setPreferences(prev => ({ ...prev, notifyOnCashouts: enabled }));
  };

  const shouldNotify = (eventType: NotificationEventType): boolean => {
    switch (eventType) {
      case 'wins': return preferences.notifyOnWins;
      case 'losses': return preferences.notifyOnLosses;
      case 'cashouts': return preferences.notifyOnCashouts;
      default: return true;
    }
  };

  return (
    <UserPreferencesContext.Provider value={{ 
      preferences, 
      setSoundEnabled, 
      setHapticsEnabled,
      setNotifyOnWins,
      setNotifyOnLosses,
      setNotifyOnCashouts,
      shouldNotify
    }}>
      {children}
    </UserPreferencesContext.Provider>
  );
};

export const useUserPreferences = () => {
  const context = useContext(UserPreferencesContext);
  if (context === undefined) {
    throw new Error('useUserPreferences must be used within a UserPreferencesProvider');
  }
  return context;
};
