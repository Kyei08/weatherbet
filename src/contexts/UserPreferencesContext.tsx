import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface UserPreferences {
  soundEnabled: boolean;
}

interface UserPreferencesContextType {
  preferences: UserPreferences;
  setSoundEnabled: (enabled: boolean) => void;
}

const STORAGE_KEY = 'weather-betting-preferences';

const defaultPreferences: UserPreferences = {
  soundEnabled: true,
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

  return (
    <UserPreferencesContext.Provider value={{ preferences, setSoundEnabled }}>
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
