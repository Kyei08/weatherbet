import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cloud, Sun, CloudRain, Snowflake, Wind } from "lucide-react";

interface WeatherCardProps {
  location: string;
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  variant?: "default" | "compact" | "detailed";
}

const getWeatherIcon = (condition: string) => {
  const lower = condition.toLowerCase();
  if (lower.includes('rain')) return CloudRain;
  if (lower.includes('snow')) return Snowflake;
  if (lower.includes('cloud')) return Cloud;
  if (lower.includes('wind')) return Wind;
  return Sun;
};

export function WeatherCard({ 
  location, 
  temperature, 
  condition, 
  humidity, 
  windSpeed,
  variant = "default" 
}: WeatherCardProps) {
  const WeatherIcon = getWeatherIcon(condition);

  if (variant === "compact") {
    return (
      <Card className="bg-gradient-subtle border-border/50">
        <CardContent className="p-4 flex items-center space-x-3">
          <WeatherIcon className="h-8 w-8 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">{location}</p>
            <p className="text-2xl font-bold text-foreground">{temperature}°</p>
          </div>
          <Badge variant="secondary">{condition}</Badge>
        </CardContent>
      </Card>
    );
  }

  if (variant === "detailed") {
    return (
      <Card className="bg-gradient-subtle border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span className="text-foreground">{location}</span>
            <WeatherIcon className="h-6 w-6 text-primary" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-3xl font-bold text-foreground">{temperature}°</span>
            <Badge variant="outline">{condition}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Humidity</span>
              <span className="text-foreground font-medium">{humidity}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Wind</span>
              <span className="text-foreground font-medium">{windSpeed} mph</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-subtle border-border/50 hover:shadow-elegant transition-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2">
          <WeatherIcon className="h-5 w-5 text-primary" />
          <span className="text-foreground">{location}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-foreground">{temperature}°</span>
          <div className="text-right">
            <Badge variant="secondary" className="mb-1">{condition}</Badge>
            <p className="text-xs text-muted-foreground">
              {humidity}% humidity • {windSpeed} mph wind
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}