import { TrendingUp, Activity, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useVolatilityOdds } from '@/hooks/useVolatilityOdds';
import { VOLATILITY_CONFIG } from '@/lib/volatility-odds';

interface VolatilityBadgeProps {
  city: string;
  category: string;
  showDetails?: boolean;
}

/**
 * Displays volatility information for a city/category combination
 * Shows bonus percentage when weather is harder to predict
 */
export function VolatilityBadge({ city, category, showDetails = false }: VolatilityBadgeProps) {
  const { volatilityData, isLoading } = useVolatilityOdds({
    city,
    category,
    enabled: VOLATILITY_CONFIG.enabled,
  });

  if (!VOLATILITY_CONFIG.enabled || isLoading || !volatilityData) {
    return null;
  }

  const bonusPercentage = Math.round((volatilityData.volatilityMultiplier - 1) * 100);
  const hasBonus = bonusPercentage > 0;
  const hasEnoughData = volatilityData.totalPredictions >= VOLATILITY_CONFIG.minDataPoints;

  if (!hasBonus && !showDetails) {
    return null;
  }

  const getVariant = () => {
    if (bonusPercentage >= 30) return 'destructive';
    if (bonusPercentage >= 15) return 'default';
    return 'secondary';
  };

  const getIcon = () => {
    if (bonusPercentage >= 30) return <AlertTriangle className="w-3 h-3 mr-1" />;
    if (bonusPercentage >= 15) return <Activity className="w-3 h-3 mr-1" />;
    return <TrendingUp className="w-3 h-3 mr-1" />;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={getVariant()} 
            className="text-xs cursor-help flex items-center gap-1"
          >
            {getIcon()}
            {hasBonus ? (
              <>+{bonusPercentage}% Volatility</>
            ) : (
              <>Stable</>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-2">
            <p className="font-semibold">{volatilityData.volatilityLabel}</p>
            {hasEnoughData ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Historical accuracy: {volatilityData.avgAccuracy.toFixed(1)}%
                </p>
                <p className="text-sm text-muted-foreground">
                  Based on {volatilityData.totalPredictions} predictions
                </p>
                {hasBonus && (
                  <p className="text-sm text-green-500">
                    Lower accuracy = harder to predict = better odds!
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Not enough data yet ({volatilityData.totalPredictions}/{VOLATILITY_CONFIG.minDataPoints} predictions)
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Compact volatility indicator for use in betting slips
 */
export function VolatilityIndicator({ city, category }: { city: string; category: string }) {
  const { volatilityData, isLoading } = useVolatilityOdds({
    city,
    category,
    enabled: VOLATILITY_CONFIG.enabled,
  });

  if (!VOLATILITY_CONFIG.enabled || isLoading || !volatilityData) {
    return null;
  }

  const bonusPercentage = Math.round((volatilityData.volatilityMultiplier - 1) * 100);
  
  if (bonusPercentage <= 0) {
    return null;
  }

  return (
    <span className="text-xs text-orange-500 font-medium flex items-center gap-1">
      <Activity className="w-3 h-3" />
      +{bonusPercentage}%
    </span>
  );
}
