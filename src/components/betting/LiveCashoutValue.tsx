import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrencyMode } from '@/contexts/CurrencyModeContext';
import { formatRands } from '@/lib/currency';
import { PartialCashoutSlider } from './PartialCashoutSlider';
import { PartialCashoutHistory } from './PartialCashoutHistory';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface LiveCashoutValueProps {
  amount: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
  previousAmount?: number;
  reasoning: string;
  timeBonus: number;
  weatherBonus: number;
  lastUpdated: number;
  isUpdating?: boolean;
  compact?: boolean;
  currentStake: number;
  betId: string;
  betType: 'bet' | 'parlay' | 'combined_bet';
  onCashout?: () => void;
  onPartialCashout?: (percentage: number, amount: number) => Promise<void>;
}

export const LiveCashoutValue = ({
  amount,
  percentage,
  trend,
  previousAmount,
  reasoning,
  timeBonus,
  weatherBonus,
  lastUpdated,
  isUpdating = false,
  compact = false,
  currentStake,
  betId,
  betType,
  onCashout,
  onPartialCashout,
}: LiveCashoutValueProps) => {
  const [showPartialCashout, setShowPartialCashout] = useState(false);
  const { mode } = useCurrencyMode();
  const [showChange, setShowChange] = useState(false);
  const [animating, setAnimating] = useState(false);
  
  // Animate when value changes
  useEffect(() => {
    if (previousAmount !== undefined && previousAmount !== amount) {
      setAnimating(true);
      setShowChange(true);
      
      const animTimer = setTimeout(() => setAnimating(false), 500);
      const changeTimer = setTimeout(() => setShowChange(false), 3000);
      
      return () => {
        clearTimeout(animTimer);
        clearTimeout(changeTimer);
      };
    }
  }, [amount, previousAmount]);
  
  const change = previousAmount !== undefined ? amount - previousAmount : 0;
  const changePercent = previousAmount !== undefined && previousAmount > 0
    ? ((change / previousAmount) * 100).toFixed(1)
    : '0';
  
  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };
  
  const getTrendColor = () => {
    if (trend === 'up') return 'text-green-500';
    if (trend === 'down') return 'text-red-500';
    return 'text-muted-foreground';
  };
  
  const formatValue = (value: number) => {
    if (mode === 'real') {
      return formatRands(value);
    }
    return `${value.toLocaleString()} pts`;
  };
  
  const timeSinceUpdate = () => {
    const seconds = Math.floor((Date.now() - lastUpdated) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className={cn(
          "font-semibold transition-all duration-300",
          animating && trend === 'up' && "text-green-500 scale-110",
          animating && trend === 'down' && "text-red-500 scale-90"
        )}>
          {formatValue(amount)}
        </span>
        {isUpdating ? (
          <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : (
          getTrendIcon()
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 p-3 rounded-lg bg-muted/50 border border-border">
      {/* Header with live indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </div>
          <span className="text-xs font-medium text-muted-foreground">Live Cash-Out</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {isUpdating ? (
            <span className="flex items-center gap-1">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Updating...
            </span>
          ) : (
            timeSinceUpdate()
          )}
        </span>
      </div>
      
      {/* Main value */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-xl font-bold transition-all duration-300",
            animating && trend === 'up' && "text-green-500 scale-110",
            animating && trend === 'down' && "text-red-500 scale-90"
          )}>
            {formatValue(amount)}
          </span>
          {getTrendIcon()}
        </div>
        <span className={cn(
          "text-sm font-medium",
          percentage >= 80 ? "text-green-500" : 
          percentage >= 65 ? "text-yellow-500" : "text-muted-foreground"
        )}>
          {percentage}%
        </span>
      </div>
      
      {/* Change indicator */}
      {showChange && change !== 0 && (
        <div className={cn(
          "flex items-center gap-1 text-xs animate-in fade-in slide-in-from-bottom-1",
          getTrendColor()
        )}>
          {trend === 'up' ? '+' : ''}{formatValue(change)} ({changePercent}%)
        </div>
      )}
      
      {/* Bonus breakdown */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          ⏱️ Time: +{timeBonus}%
        </span>
        <span className="flex items-center gap-1">
          🌤️ Weather: +{weatherBonus}%
        </span>
      </div>
      
      {/* Reasoning */}
      <p className="text-xs text-muted-foreground italic">
        {reasoning}
      </p>
      
      {/* Cash-out buttons */}
      {onCashout && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              onClick={onCashout}
              className={cn(
                "flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all",
                "bg-primary text-primary-foreground hover:bg-primary/90",
                animating && trend === 'up' && "ring-2 ring-green-500 ring-offset-2 ring-offset-background"
              )}
            >
              Cash Out All
            </button>
            {onPartialCashout && (
              <Collapsible open={showPartialCashout} onOpenChange={setShowPartialCashout}>
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      "py-2 px-3 rounded-md text-sm font-medium transition-all",
                      "border border-primary text-primary hover:bg-primary/10",
                      "flex items-center gap-1"
                    )}
                  >
                    Partial
                    {showPartialCashout ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </CollapsibleTrigger>
              </Collapsible>
            )}
          </div>
          
          {/* Partial cashout slider */}
          {onPartialCashout && (
            <Collapsible open={showPartialCashout} onOpenChange={setShowPartialCashout}>
              <CollapsibleContent className="animate-in slide-in-from-top-2">
                <PartialCashoutSlider
                  totalCashoutAmount={amount}
                  currentStake={currentStake}
                  onPartialCashout={onPartialCashout}
                  onFullCashout={onCashout}
                  disabled={isUpdating}
                />
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}
      
      {/* Partial Cashout History */}
      <PartialCashoutHistory
        betId={betId}
        betType={betType}
        currencyType={mode}
      />
    </div>
  );
};
