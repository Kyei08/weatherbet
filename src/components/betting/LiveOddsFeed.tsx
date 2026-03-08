import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLiveWeatherOdds } from '@/hooks/useLiveWeatherOdds';
import { CITIES, City } from '@/types/supabase-betting';
import { RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatLiveOdds } from '@/lib/dynamic-odds';

export const LiveOddsFeed = () => {
  const [selectedCities, setSelectedCities] = useState<City[]>(['New York', 'Tokyo', 'London']);
  const [predictionType, setPredictionType] = useState<'rain' | 'temperature'>('rain');
  const [predictionValue, setPredictionValue] = useState('yes');
  const [daysAhead, setDaysAhead] = useState(1);

  const { liveOdds, isLoading, error, refresh } = useLiveWeatherOdds(
    selectedCities,
    predictionType,
    predictionValue,
    daysAhead,
    30000 // Poll every 30 seconds
  );

  const getOddsChange = (currentOdds: number, previousOdds: number) => {
    const diff = currentOdds - previousOdds;
    const percentChange = ((diff / previousOdds) * 100).toFixed(1);
    
    if (Math.abs(diff) < 0.01) {
      return { icon: Minus, color: 'text-muted-foreground', text: 'Stable', value: '0.0%' };
    }
    
    if (diff > 0) {
      return { 
        icon: TrendingUp, 
        color: 'text-green-500', 
        text: 'Rising', 
        value: `+${percentChange}%` 
      };
    }
    
    return { 
      icon: TrendingDown, 
      color: 'text-red-500', 
      text: 'Falling', 
      value: `${percentChange}%` 
    };
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3 sm:pb-6">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-lg sm:text-2xl">Live Odds Feed</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Real-time odds based on live weather</CardDescription>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={refresh}
            disabled={isLoading}
            className={`shrink-0 min-h-[44px] min-w-[44px] ${isLoading ? 'animate-spin' : ''}`}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4 sm:space-y-6">
        {/* Controls */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 sm:gap-4">
          <div className="space-y-1 sm:space-y-2">
            <label className="text-xs sm:text-sm font-medium">Type</label>
            <Select value={predictionType} onValueChange={(value: any) => setPredictionType(value)}>
              <SelectTrigger className="min-h-[44px] text-xs sm:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rain">Rain</SelectItem>
                <SelectItem value="temperature">Temp</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 sm:space-y-2">
            <label className="text-xs sm:text-sm font-medium">Value</label>
            <Select value={predictionValue} onValueChange={setPredictionValue}>
              <SelectTrigger className="min-h-[44px] text-xs sm:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {predictionType === 'rain' ? (
                  <>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="20-25">20-25°C</SelectItem>
                    <SelectItem value="25-30">25-30°C</SelectItem>
                    <SelectItem value="30-35">30-35°C</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 sm:space-y-2">
            <label className="text-xs sm:text-sm font-medium">Days</label>
            <Select value={String(daysAhead)} onValueChange={(value) => setDaysAhead(Number(value))}>
              <SelectTrigger className="min-h-[44px] text-xs sm:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                  <SelectItem key={day} value={String(day)}>
                    {day}d
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && (
          <div className="p-3 sm:p-4 bg-destructive/10 border border-destructive rounded-lg">
            <p className="text-xs sm:text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Live Odds Display */}
        <div className="space-y-2 sm:space-y-3">
          {isLoading && liveOdds.length === 0 ? (
            <div className="text-center py-6 sm:py-8 text-muted-foreground text-sm">
              Loading live odds...
            </div>
          ) : (
            liveOdds.map((odd) => {
              const change = getOddsChange(odd.currentOdds, odd.previousOdds);
              const ChangeIcon = change.icon;
              
              return (
                <div
                  key={`${odd.city}-${odd.timestamp}`}
                  className="flex items-center justify-between p-3 sm:p-4 bg-card border rounded-lg hover:bg-accent/50 transition-colors gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <span className="font-semibold text-sm sm:text-base">{odd.city}</span>
                      <Badge variant="outline" className="text-[10px] sm:text-xs">
                        {odd.predictionType === 'rain' 
                          ? `Rain: ${odd.predictionValue}` 
                          : `Temp: ${odd.predictionValue}°C`}
                      </Badge>
                    </div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                      {daysAhead}d ahead
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    <div className="text-right">
                      <div className="text-lg sm:text-2xl font-bold">
                        {formatLiveOdds(odd.currentOdds)}
                      </div>
                      <div className={`flex items-center gap-0.5 text-[10px] sm:text-xs ${change.color}`}>
                        <ChangeIcon className="h-3 w-3" />
                        <span>{change.value}</span>
                      </div>
                    </div>

                    <Badge 
                      variant={
                        change.text === 'Rising' ? 'default' : 
                        change.text === 'Falling' ? 'destructive' : 
                        'secondary'
                      }
                      className="text-[10px] sm:text-xs hidden sm:inline-flex"
                    >
                      {change.text}
                    </Badge>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-center gap-2 text-[10px] sm:text-xs text-muted-foreground pt-3 sm:pt-4 border-t">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span>Updates every 30s</span>
        </div>
      </CardContent>
    </Card>
  );
};
