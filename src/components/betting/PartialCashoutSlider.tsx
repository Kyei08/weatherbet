import { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Percent, DollarSign, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrencyMode } from '@/contexts/CurrencyModeContext';
import { formatRands } from '@/lib/currency';

interface PartialCashoutSliderProps {
  totalCashoutAmount: number;
  currentStake: number;
  onPartialCashout: (percentage: number, amount: number) => Promise<void>;
  onFullCashout: () => void;
  disabled?: boolean;
}

export const PartialCashoutSlider = ({
  totalCashoutAmount,
  currentStake,
  onPartialCashout,
  onFullCashout,
  disabled = false,
}: PartialCashoutSliderProps) => {
  const [percentage, setPercentage] = useState(50);
  const [isProcessing, setIsProcessing] = useState(false);
  const { mode } = useCurrencyMode();

  const cashoutAmount = Math.floor(totalCashoutAmount * (percentage / 100));
  const remainingStake = Math.floor(currentStake * ((100 - percentage) / 100));

  const formatValue = (value: number) => {
    if (mode === 'real') {
      return formatRands(value);
    }
    return `${value.toLocaleString()} pts`;
  };

  const handlePartialCashout = async () => {
    if (percentage === 100) {
      onFullCashout();
      return;
    }

    setIsProcessing(true);
    try {
      await onPartialCashout(percentage, cashoutAmount);
    } finally {
      setIsProcessing(false);
    }
  };

  const presetPercentages = [25, 50, 75, 100];

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-muted/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Percent className="h-4 w-4 text-primary" />
          Partial Cash-Out
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preset buttons */}
        <div className="flex gap-2">
          {presetPercentages.map((preset) => (
            <Button
              key={preset}
              variant={percentage === preset ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPercentage(preset)}
              disabled={disabled || isProcessing}
              className="flex-1 text-xs"
            >
              {preset}%
            </Button>
          ))}
        </div>

        {/* Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">
              Cash-out percentage
            </Label>
            <span className="text-sm font-bold text-primary">{percentage}%</span>
          </div>
          <Slider
            value={[percentage]}
            onValueChange={([value]) => setPercentage(value)}
            min={10}
            max={100}
            step={5}
            disabled={disabled || isProcessing}
            className="py-2"
          />
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/50">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              You receive
            </div>
            <div className="text-lg font-bold text-green-500">
              {formatValue(cashoutAmount)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <AlertTriangle className="h-3 w-3" />
              Stake remaining
            </div>
            <div className={cn(
              "text-lg font-bold",
              percentage === 100 ? "text-muted-foreground" : "text-foreground"
            )}>
              {percentage === 100 ? 'None' : formatValue(remainingStake)}
            </div>
          </div>
        </div>

        {/* Info text */}
        {percentage < 100 && (
          <p className="text-xs text-muted-foreground">
            Your bet will continue with {formatValue(remainingStake)} stake. 
            You can cash out the rest later.
          </p>
        )}

        {/* Action button */}
        <Button
          onClick={handlePartialCashout}
          disabled={disabled || isProcessing}
          className={cn(
            "w-full font-semibold",
            percentage === 100 
              ? "bg-primary hover:bg-primary/90" 
              : "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
          )}
        >
          {isProcessing ? (
            'Processing...'
          ) : percentage === 100 ? (
            `Cash Out All (${formatValue(totalCashoutAmount)})`
          ) : (
            `Cash Out ${percentage}% (${formatValue(cashoutAmount)})`
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
