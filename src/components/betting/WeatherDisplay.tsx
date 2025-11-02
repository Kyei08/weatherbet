import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Cloud, Sun, CloudRain, Thermometer, Droplets, Wind, Gauge } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import WeatherForecast from './WeatherForecast';

interface WeatherDisplayProps {
  city: string;
}

const WeatherDisplay = ({ city }: WeatherDisplayProps) => {
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase.functions.invoke('get-weather', {
          body: { city }
        });

        if (fetchError) throw fetchError;
        
        setWeather(data);
      } catch (err) {
        console.error('Error fetching weather:', err);
        setError('Failed to load weather data');
      } finally {
        setLoading(false);
      }
    };

    if (city) {
      fetchWeather();
    }
  }, [city]);

  const getWeatherIcon = (condition: string) => {
    const cond = condition?.toLowerCase() || '';
    if (cond.includes('rain') || cond.includes('drizzle')) {
      return <CloudRain className="h-6 w-6 text-primary" />;
    } else if (cond.includes('cloud')) {
      return <Cloud className="h-6 w-6 text-muted-foreground" />;
    } else {
      return <Sun className="h-6 w-6 text-warning" />;
    }
  };

  if (loading) {
    return (
      <Card className="mb-4">
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">Loading weather data...</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !weather) {
    return (
      <Card className="mb-4">
        <CardContent className="pt-6">
          <p className="text-destructive text-center">{error || 'No weather data available'}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 mb-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getWeatherIcon(weather.current.condition)}
            Current Weather - {weather.city}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{weather.current.temperature}°C</p>
                <p className="text-sm text-muted-foreground">Temperature</p>
              </div>
            </div>
            <div>
              <Badge variant="outline" className="mb-1 capitalize">
                {weather.current.description}
              </Badge>
              <p className="text-sm text-muted-foreground">Condition</p>
            </div>
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xl font-semibold">{weather.current.humidity}%</p>
                <p className="text-sm text-muted-foreground">Humidity</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Wind className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xl font-semibold">{weather.current.wind_speed} km/h</p>
                <p className="text-sm text-muted-foreground">Wind Speed</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {weather.forecast && weather.forecast.length > 0 && (
        <WeatherForecast city={weather.city} forecast={weather.forecast} />
      )}
    </div>
  );
};

export default WeatherDisplay;