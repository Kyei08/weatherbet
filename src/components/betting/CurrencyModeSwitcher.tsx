import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useCurrencyMode, CurrencyMode } from '@/contexts/CurrencyModeContext';
import { Coins, Banknote } from 'lucide-react';
import { ModeWarningDialog } from './ModeWarningDialog';

export const CurrencyModeSwitcher = () => {
  const { mode, setMode } = useCurrencyMode();
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
      <Card className="p-4 bg-gradient-to-r from-primary/10 to-accent/10 border-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {mode === 'virtual' ? (
              <Coins className="h-6 w-6 text-primary" />
            ) : (
              <Banknote className="h-6 w-6 text-green-600" />
            )}
            <div>
              <Label htmlFor="mode-switch" className="text-lg font-bold cursor-pointer">
                {mode === 'virtual' ? '🎮 Play Mode (Virtual)' : '💰 Real Money Mode'}
              </Label>
              <p className="text-sm text-muted-foreground">
                {mode === 'virtual' 
                  ? 'Practice with virtual points - free to play' 
                  : 'Play with real Rands - win real prizes'}
              </p>
            </div>
          </div>
          <Switch
            id="mode-switch"
            checked={mode === 'real'}
            onCheckedChange={handleToggle}
            className="data-[state=checked]:bg-green-600"
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
