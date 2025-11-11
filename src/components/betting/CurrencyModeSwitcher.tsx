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
      <Card className={`p-6 border-3 ${theme.card} ${theme.glowShadow} relative overflow-hidden animate-fade-in`}>
        {/* Animated background glow */}
        <div className={`absolute inset-0 ${theme.gradient} opacity-20 animate-pulse`} />
        
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${theme.primary} ${theme.primaryForeground} ${theme.glowShadow}`}>
              {mode === 'virtual' ? (
                <Coins className="h-7 w-7" />
              ) : (
                <Banknote className="h-7 w-7" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Label htmlFor="mode-switch" className={`text-xl font-bold cursor-pointer ${theme.primaryText}`}>
                  {mode === 'virtual' ? '🎮 Play Mode (Virtual)' : '💰 Real Money Mode'}
                </Label>
                <Sparkles className={`h-4 w-4 ${theme.accentText} animate-pulse`} />
              </div>
              <p className={`text-sm ${theme.secondaryText} mt-1`}>
                {mode === 'virtual' 
                  ? 'Practice with virtual points - completely risk-free!' 
                  : 'Play with real Rands - win real cash prizes!'}
              </p>
            </div>
          </div>
          <Switch
            id="mode-switch"
            checked={mode === 'real'}
            onCheckedChange={handleToggle}
            className={`data-[state=checked]:bg-real-primary data-[state=unchecked]:bg-virtual-primary scale-125`}
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
