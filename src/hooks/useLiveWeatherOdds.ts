import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateDynamicOdds } from '@/lib/dynamic-odds';
import { City } from '@/types/supabase-betting';

interface WeatherForecast {
  date: string;
  temp_min: number;
  temp_max: number;
  temp_day: number;
  rain_probability: number;
  condition: string;
}

interface LiveOdds {
  city: City;
  predictionType: 'rain' | 'temperature' | 'rainfall' | 'snow' | 'wind' | 'dew_point' | 'pressure' | 'cloud_coverage';
  predictionValue: string;
  daysAhead: number;
  currentOdds: number;
  previousOdds: number;
  timestamp: number;
}

export const useLiveWeatherOdds = (
  cities: City[],
  predictionType: 'rain' | 'temperature' | 'rainfall' | 'snow' | 'wind' | 'dew_point' | 'pressure' | 'cloud_coverage',
  predictionValue: string,
  daysAhead: number,
  pollInterval: number = 30000 // 30 seconds default
) => {
  const [liveOdds, setLiveOdds] = useState<LiveOdds[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWeatherAndCalculateOdds = useCallback(async () => {
    try {
      const oddsUpdates: LiveOdds[] = [];

      for (const city of cities) {
        const { data, error: weatherError } = await supabase.functions.invoke('get-weather', {
          body: { city }
        });

        if (weatherError) {
          console.error(`Error fetching weather for ${city}:`, weatherError);
          continue;
        }

        if (data?.forecast) {
          const currentOdds = calculateDynamicOdds({
            predictionType,
            predictionValue,
            forecast: data.forecast as WeatherForecast[],
            daysAhead
          });

          // Find previous odds for comparison
          const previousOdd = liveOdds.find(
            (odd) => odd.city === city && 
                    odd.predictionType === predictionType && 
                    odd.predictionValue === predictionValue
          );

          oddsUpdates.push({
            city,
            predictionType,
            predictionValue,
            daysAhead,
            currentOdds,
            previousOdds: previousOdd?.currentOdds || currentOdds,
            timestamp: Date.now()
          });
        }
      }

      setLiveOdds(oddsUpdates);
      setIsLoading(false);
      setError(null);
    } catch (err) {
      console.error('Error in fetchWeatherAndCalculateOdds:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch odds');
      setIsLoading(false);
    }
  }, [cities, predictionType, predictionValue, daysAhead, liveOdds]);

  useEffect(() => {
    fetchWeatherAndCalculateOdds();
    
    const interval = setInterval(fetchWeatherAndCalculateOdds, pollInterval);
    
    return () => clearInterval(interval);
  }, [fetchWeatherAndCalculateOdds, pollInterval]);

  return { liveOdds, isLoading, error, refresh: fetchWeatherAndCalculateOdds };
};
