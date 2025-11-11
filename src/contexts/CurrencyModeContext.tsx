import { createContext, useContext, useState, ReactNode } from 'react';

export type CurrencyMode = 'virtual' | 'real';

interface CurrencyModeContextType {
  mode: CurrencyMode;
  setMode: (mode: CurrencyMode) => void;
  toggleMode: () => void;
}

const CurrencyModeContext = createContext<CurrencyModeContextType | undefined>(undefined);

export const CurrencyModeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setMode] = useState<CurrencyMode>('virtual');

  const toggleMode = () => {
    setMode(prev => prev === 'virtual' ? 'real' : 'virtual');
  };

  return (
    <CurrencyModeContext.Provider value={{ mode, setMode, toggleMode }}>
      {children}
    </CurrencyModeContext.Provider>
  );
};

export const useCurrencyMode = () => {
  const context = useContext(CurrencyModeContext);
  if (!context) {
    throw new Error('useCurrencyMode must be used within CurrencyModeProvider');
  }
  return context;
};
