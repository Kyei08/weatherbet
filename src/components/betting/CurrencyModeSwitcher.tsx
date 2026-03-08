import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useCurrencyMode, CurrencyMode } from '@/contexts/CurrencyModeContext';
import { useModeTheme } from '@/hooks/useModeTheme';
import { Coins, Banknote, Sparkles } from 'lucide-react';
import { ModeWarningDialog } from './ModeWarningDialog';

export const CurrencyModeSwitcher = () => {
  const { mode, setMode } = useCurrencyMode();
  const theme = useModeTheme();
  const [showWarning, setShowWarning] = useState(false);
  const [pendingMode, setPendingMode] = useState<CurrencyMode>('virtual');

  const handleToggle = () => {
    const targetMode = mode === 'virtual' ? 'real' : 'virtual';
    setPendingMode(targetMode);
    setShowWarning(true);
  };

  const handleConfirm = () => {
    setMode(pendingMode);
    setShowWarning(false);
  };

  return (
    <>
      <Card className={`p-4 sm:p-6 border-3 ${theme.card} ${theme.glowShadow} relative overflow-hidden animate-fade-in`}>
        {/* Animated background glow */}
        <div className={`absolute inset-0 ${theme.gradient} opacity-20 animate-pulse`} />
        
        <div className="relative flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className={`p-2 sm:p-3 rounded-xl shrink-0 ${theme.primary} ${theme.primaryForeground} ${theme.glowShadow}`}>
              {mode === 'virtual' ? (
                <Coins className="h-5 w-5 sm:h-7 sm:w-7" />
              ) : (
                <Banknote className="h-5 w-5 sm:h-7 sm:w-7" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Label htmlFor="mode-switch" className={`text-base sm:text-xl font-bold cursor-pointer ${theme.primaryText} truncate`}>
                  {mode === 'virtual' ? '🎮 Play Mode' : '💰 Real Money'}
                </Label>
                <Sparkles className={`h-4 w-4 shrink-0 ${theme.accentText} animate-pulse`} />
              </div>
              <p className={`text-xs sm:text-sm ${theme.secondaryText} mt-0.5 sm:mt-1 line-clamp-1`}>
                {mode === 'virtual' 
                  ? 'Practice risk-free with virtual points!' 
                  : 'Win real cash prizes!'}
              </p>
            </div>
          </div>
          <Switch
            id="mode-switch"
            checked={mode === 'real'}
            onCheckedChange={handleToggle}
            className={`data-[state=checked]:bg-real-primary data-[state=unchecked]:bg-virtual-primary scale-110 sm:scale-125 shrink-0`}
          />
        </div>
      </Card>

      <ModeWarningDialog
        open={showWarning}
        onOpenChange={setShowWarning}
        targetMode={pendingMode}
        onConfirm={handleConfirm}
      />
    </>
  );
};
