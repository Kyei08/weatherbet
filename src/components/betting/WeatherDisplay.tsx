import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Cloud, Sun, CloudRain, Thermometer } from 'lucide-react';

interface WeatherData {
  city: string;
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
}

interface WeatherDisplayProps {
  city: string;
}

const WeatherDisplay = ({ city }: WeatherDisplayProps) => {
  // Mock weather data - in a real app, this would fetch from an API
  const getWeatherData = (cityName: string): WeatherData => {
    const mockData: Record<string, WeatherData> = {
      'New York': { city: 'New York', temperature: 22, condition: 'Partly Cloudy', humidity: 65, windSpeed: 12 },
      'London': { city: 'London', temperature: 18, condition: 'Rainy', humidity: 80, windSpeed: 15 },
      'Tokyo': { city: 'Tokyo', temperature: 25, condition: 'Sunny', humidity: 55, windSpeed: 8 },
      'Paris': { city: 'Paris', temperature: 20, condition: 'Cloudy', humidity: 70, windSpeed: 10 },
      'Sydney': { city: 'Sydney', temperature: 24, condition: 'Sunny', humidity: 60, windSpeed: 14 },
      'Berlin': { city: 'Berlin', temperature: 16, condition: 'Rainy', humidity: 75, windSpeed: 11 },
      'Moscow': { city: 'Moscow', temperature: 12, condition: 'Cloudy', humidity: 68, windSpeed: 9 },
      'Mumbai': { city: 'Mumbai', temperature: 32, condition: 'Partly Cloudy', humidity: 85, windSpeed: 7 },
      'Toronto': { city: 'Toronto', temperature: 19, condition: 'Sunny', humidity: 62, windSpeed: 13 },
      'Dubai': { city: 'Dubai', temperature: 35, condition: 'Sunny', humidity: 45, windSpeed: 6 },
    };
    return mockData[cityName] || mockData['New York'];
  };

  const weather = getWeatherData(city);

  const getWeatherIcon = (condition: string) => {
    switch (condition.toLowerCase()) {
      case 'sunny':
        return <Sun className="h-6 w-6 text-warning" />;
      case 'rainy':
        return <CloudRain className="h-6 w-6 text-primary" />;
      case 'cloudy':
        return <Cloud className="h-6 w-6 text-muted-foreground" />;
      default:
        return <Sun className="h-6 w-6 text-warning" />;
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getWeatherIcon(weather.condition)}
          Current Weather - {weather.city}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{weather.temperature}°C</p>
              <p className="text-sm text-muted-foreground">Temperature</p>
            </div>
          </div>
          <div>
            <Badge variant="outline" className="mb-1">
              {weather.condition}
            </Badge>
            <p className="text-sm text-muted-foreground">Condition</p>
          </div>
          <div>
            <p className="text-xl font-semibold">{weather.humidity}%</p>
            <p className="text-sm text-muted-foreground">Humidity</p>
          </div>
          <div>
            <p className="text-xl font-semibold">{weather.windSpeed} km/h</p>
            <p className="text-sm text-muted-foreground">Wind Speed</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeatherDisplay;