import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Cloud, Sun, CloudRain, Thermometer, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Bet } from '@/types/supabase-betting';
import { format } from 'date-fns';

interface WeatherData {
  city: string;
  current: {
    temperature: number;
    condition: string;
    description: string;
    humidity: number;
    wind_speed: number;
  };
}

interface ActiveBetsWeatherProps {
  bets: Bet[];
}

const ActiveBetsWeather = ({ bets }: ActiveBetsWeatherProps) => {
  const [weatherData, setWeatherData] = useState<Record<string, WeatherData>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWeatherForBets = async () => {
      // Get unique cities from pending bets
      const cities = [...new Set(bets.filter(bet => bet.result === 'pending').map(bet => bet.city))];
      
      if (cities.length === 0) {
        setLoading(false);
        return;
      }

      const weatherPromises = cities.map(async (city) => {
        try {
          const { data, error } = await supabase.functions.invoke('get-weather', {
            body: { city }
          });

          if (error) throw error;
          return { city, data };
        } catch (error) {
          console.error(`Error fetching weather for ${city}:`, error);
          return { city, data: null };
        }
      });

      const results = await Promise.all(weatherPromises);
      const weatherMap: Record<string, WeatherData> = {};
      
      results.forEach(({ city, data }) => {
        if (data) {
          weatherMap[city] = data;
        }
      });

      setWeatherData(weatherMap);
      setLoading(false);
    };

    fetchWeatherForBets();
  }, [bets]);

  const getWeatherIcon = (condition: string) => {
    const cond = condition?.toLowerCase() || '';
    if (cond.includes('rain') || cond.includes('drizzle')) {
      return <CloudRain className="h-5 w-5 text-primary" />;
    } else if (cond.includes('cloud')) {
      return <Cloud className="h-5 w-5 text-muted-foreground" />;
    } else {
      return <Sun className="h-5 w-5 text-warning" />;
    }
  };

  const getWeatherAlert = (bet: Bet, weather: WeatherData) => {
    if (bet.prediction_type === 'rain') {
      const willRain = weather.current.condition.toLowerCase().includes('rain');
      const predictedRain = bet.prediction_value === 'yes';
      
      if (willRain === predictedRain) {
        return { type: 'success', message: 'Looking good! 🎯' };
      } else {
        return { type: 'warning', message: 'Prediction at risk ⚠️' };
      }
    } else if (bet.prediction_type === 'temperature') {
      const [min, max] = bet.prediction_value.split('-').map(Number);
      const temp = weather.current.temperature;
      
      if (temp >= min && temp <= max) {
        return { type: 'success', message: 'In range! 🎯' };
      } else {
        return { type: 'warning', message: 'Out of range ⚠️' };
      }
    }
    
    return { type: 'info', message: 'Monitoring...' };
  };

  const pendingBets = bets.filter(bet => bet.result === 'pending');

  if (pendingBets.length === 0) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Weather Alerts for Active Bets</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading weather data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Weather Alerts for Active Bets
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {pendingBets.map((bet) => {
            const weather = weatherData[bet.city];
            
            if (!weather) return null;

            const alert = getWeatherAlert(bet, weather);

            return (
              <div 
                key={bet.id} 
                className="flex items-start justify-between p-3 border rounded-lg"
              >
                <div className="flex items-start gap-3 flex-1">
                  {getWeatherIcon(weather.current.condition)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">{bet.city}</p>
                      <Badge variant="outline" className="text-xs">
                        {bet.prediction_type === 'rain' 
                          ? `Rain: ${bet.prediction_value}`
                          : `Temp: ${bet.prediction_value}°C`
                        }
                      </Badge>
                    </div>
                    
                    <div className="text-sm text-muted-foreground mb-2">
                      <div className="flex items-center gap-2">
                        <Thermometer className="h-3 w-3" />
                        <span>{weather.current.temperature}°C • {weather.current.description}</span>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Expires: {bet.expires_at ? format(new Date(bet.expires_at), 'MMM d, h:mm a') : 'N/A'}
                    </div>
                  </div>
                </div>

                <Badge 
                  variant={alert.type === 'success' ? 'default' : alert.type === 'warning' ? 'destructive' : 'secondary'}
                  className="whitespace-nowrap"
                >
                  {alert.message}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default ActiveBetsWeather;
