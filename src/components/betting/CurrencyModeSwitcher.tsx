import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useCurrencyMode } from '@/contexts/CurrencyModeContext';
import { Coins, Banknote } from 'lucide-react';

export const CurrencyModeSwitcher = () => {
  const { mode, toggleMode } = useCurrencyMode();

  return (
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
          onCheckedChange={toggleMode}
          className="data-[state=checked]:bg-green-600"
        />
      </div>
    </Card>
  );
};
