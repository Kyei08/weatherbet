import { useCurrencyMode } from '@/contexts/CurrencyModeContext';
import MoneyModeDashboard from './money/MoneyModeDashboard';
import VirtualModeDashboard from './virtual/VirtualModeDashboard';
import { CurrencyModeSwitcher } from './CurrencyModeSwitcher';

/**
 * Mode Router - Routes to completely separate dashboard implementations
 * based on the current currency mode (Money vs Virtual)
 */
export const ModeRouter = () => {
  const { mode } = useCurrencyMode();

  return (
    <div className="min-h-screen">
      {/* Global Mode Switcher */}
      <div className="max-w-4xl mx-auto px-4 pt-4">
        <CurrencyModeSwitcher />
      </div>

      {/* Render completely separate dashboard based on mode */}
      {mode === 'real' ? <MoneyModeDashboard /> : <VirtualModeDashboard />}
    </div>
  );
};
