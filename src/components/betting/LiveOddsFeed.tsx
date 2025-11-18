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
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">Live Odds Feed</CardTitle>
            <CardDescription>Real-time odds updates based on live weather data</CardDescription>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={refresh}
            disabled={isLoading}
            className={isLoading ? 'animate-spin' : ''}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Prediction Type</label>
            <Select value={predictionType} onValueChange={(value: any) => setPredictionType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rain">Rain</SelectItem>
                <SelectItem value="temperature">Temperature</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Value</label>
            <Select value={predictionValue} onValueChange={setPredictionValue}>
              <SelectTrigger>
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

          <div className="space-y-2">
            <label className="text-sm font-medium">Days Ahead</label>
            <Select value={String(daysAhead)} onValueChange={(value) => setDaysAhead(Number(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                  <SelectItem key={day} value={String(day)}>
                    {day} {day === 1 ? 'day' : 'days'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive rounded-lg">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Live Odds Display */}
        <div className="space-y-3">
          {isLoading && liveOdds.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading live odds...
            </div>
          ) : (
            liveOdds.map((odd) => {
              const change = getOddsChange(odd.currentOdds, odd.previousOdds);
              const ChangeIcon = change.icon;
              
              return (
                <div
                  key={`${odd.city}-${odd.timestamp}`}
                  className="flex items-center justify-between p-4 bg-card border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{odd.city}</span>
                      <Badge variant="outline" className="text-xs">
                        {odd.predictionType === 'rain' 
                          ? `Rain: ${odd.predictionValue}` 
                          : `Temp: ${odd.predictionValue}°C`}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {daysAhead} {daysAhead === 1 ? 'day' : 'days'} ahead
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {formatLiveOdds(odd.currentOdds)}
                      </div>
                      <div className={`flex items-center gap-1 text-xs ${change.color}`}>
                        <ChangeIcon className="h-3 w-3" />
                        <span>{change.value}</span>
                      </div>
                    </div>

                    <Badge variant={
                      change.text === 'Rising' ? 'default' : 
                      change.text === 'Falling' ? 'destructive' : 
                      'secondary'
                    }>
                      {change.text}
                    </Badge>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-4 border-t">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span>Updates every 30 seconds</span>
        </div>
      </CardContent>
    </Card>
  );
};
