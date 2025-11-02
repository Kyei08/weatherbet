import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Cloud, Sun, CloudRain, Droplets, Wind } from 'lucide-react';
import { format } from 'date-fns';

interface ForecastDay {
  date: string;
  temp_min: number;
  temp_max: number;
  temp_day: number;
  humidity: number;
  wind_speed: number;
  rain_probability: number;
  condition: string;
  description: string;
  icon: string;
}

interface WeatherForecastProps {
  city: string;
  forecast: ForecastDay[];
}

const WeatherForecast = ({ city, forecast }: WeatherForecastProps) => {
  const getWeatherIcon = (condition: string) => {
    const cond = condition.toLowerCase();
    if (cond.includes('rain') || cond.includes('drizzle')) {
      return <CloudRain className="h-5 w-5 text-primary" />;
    } else if (cond.includes('cloud')) {
      return <Cloud className="h-5 w-5 text-muted-foreground" />;
    } else {
      return <Sun className="h-5 w-5 text-warning" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>7-Day Forecast - {city}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {forecast.map((day, index) => (
            <div 
              key={day.date} 
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-3 flex-1">
                {getWeatherIcon(day.condition)}
                <div>
                  <p className="font-medium">
                    {index === 0 ? 'Today' : format(new Date(day.date), 'EEE, MMM d')}
                  </p>
                  <p className="text-sm text-muted-foreground capitalize">{day.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-semibold">{day.temp_day}°C</p>
                  <p className="text-xs text-muted-foreground">
                    {day.temp_min}° / {day.temp_max}°
                  </p>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Droplets className="h-4 w-4" />
                  <span>{day.rain_probability}%</span>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Wind className="h-4 w-4" />
                  <span>{day.wind_speed}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default WeatherForecast;
