import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { Gauge, TrendingUp, Clock, Cloud } from 'lucide-react';
import { calculateDifficultyRating, DifficultyRating as DifficultyRatingType } from '@/lib/prediction-difficulty';

interface WeatherForecast {
  date: string;
  temp_min: number;
  temp_max: number;
  temp_day: number;
  rain_probability: number;
  condition: string;
}

interface DifficultyRatingProps {
  city: string;
  predictionType: string;
  predictionValue: string;
  forecast: WeatherForecast[];
  daysAhead: number;
  showDetails?: boolean;
}

/**
 * Displays prediction difficulty rating with optional breakdown
 */
export function DifficultyRating({
  city,
  predictionType,
  predictionValue,
  forecast,
  daysAhead,
  showDetails = false,
}: DifficultyRatingProps) {
  const rating = useMemo(() => {
    if (!city || !predictionType || !predictionValue || forecast.length === 0) {
      return null;
    }
    return calculateDifficultyRating(city, predictionType, predictionValue, forecast, daysAhead);
  }, [city, predictionType, predictionValue, forecast, daysAhead]);

  if (!rating) {
    return null;
  }

  const getBadgeVariant = () => {
    switch (rating.level) {
      case 'Easy': return 'secondary';
      case 'Medium': return 'outline';
      case 'Hard': return 'default';
      case 'Expert': return 'destructive';
    }
  };

  const getProgressColor = (score: number) => {
    if (score < 0.3) return 'bg-green-500';
    if (score < 0.5) return 'bg-yellow-500';
    if (score < 0.7) return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (showDetails) {
    return (
      <div className="space-y-3 p-3 rounded-lg border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Prediction Difficulty</span>
          </div>
          <Badge variant={getBadgeVariant()} className="text-sm">
            {rating.icon} {rating.level}
          </Badge>
        </div>

        <p className="text-sm text-muted-foreground">{rating.description}</p>

        <div className="space-y-2">
          {/* Volatility Factor */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                Historical Accuracy
              </span>
              <span className={rating.factors.volatility.score > 0.5 ? 'text-orange-500' : 'text-green-500'}>
                {rating.factors.volatility.label}
              </span>
            </div>
            <Progress 
              value={rating.factors.volatility.score * 100} 
              className="h-1.5"
            />
          </div>

          {/* Time Decay Factor */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                Forecast Range
              </span>
              <span className={rating.factors.timeDecay.score > 0.5 ? 'text-orange-500' : 'text-green-500'}>
                {rating.factors.timeDecay.label}
              </span>
            </div>
            <Progress 
              value={rating.factors.timeDecay.score * 100} 
              className="h-1.5"
            />
          </div>

          {/* Forecast Uncertainty Factor */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Cloud className="h-3 w-3" />
                Weather Certainty
              </span>
              <span className={rating.factors.forecastUncertainty.score > 0.5 ? 'text-orange-500' : 'text-green-500'}>
                {rating.factors.forecastUncertainty.label}
              </span>
            </div>
            <Progress 
              value={rating.factors.forecastUncertainty.score * 100} 
              className="h-1.5"
            />
          </div>
        </div>

        {rating.oddsBonus > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-primary font-medium">
              💰 +{rating.oddsBonus}% odds bonus for this difficulty!
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={getBadgeVariant()} 
            className="text-xs cursor-help flex items-center gap-1"
          >
            <Gauge className="h-3 w-3" />
            {rating.icon} {rating.level}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-2">
            <p className="font-semibold flex items-center gap-2">
              {rating.icon} {rating.level} Difficulty
            </p>
            <p className="text-sm text-muted-foreground">{rating.description}</p>
            <div className="text-xs space-y-1 pt-1 border-t">
              <div className="flex justify-between">
                <span>Volatility:</span>
                <span>{rating.factors.volatility.label}</span>
              </div>
              <div className="flex justify-between">
                <span>Time Range:</span>
                <span>{rating.factors.timeDecay.label}</span>
              </div>
              <div className="flex justify-between">
                <span>Forecast:</span>
                <span>{rating.factors.forecastUncertainty.label}</span>
              </div>
            </div>
            {rating.oddsBonus > 0 && (
              <p className="text-xs text-green-500 pt-1">
                +{rating.oddsBonus}% odds bonus
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Compact difficulty indicator for inline use
 */
export function DifficultyIndicator({
  city,
  predictionType,
  predictionValue,
  forecast,
  daysAhead,
}: Omit<DifficultyRatingProps, 'showDetails'>) {
  const rating = useMemo(() => {
    if (!city || !predictionType || !predictionValue || forecast.length === 0) {
      return null;
    }
    return calculateDifficultyRating(city, predictionType, predictionValue, forecast, daysAhead);
  }, [city, predictionType, predictionValue, forecast, daysAhead]);

  if (!rating) {
    return null;
  }

  return (
    <span className={`text-xs font-medium ${rating.color}`}>
      {rating.icon}
    </span>
  );
}
