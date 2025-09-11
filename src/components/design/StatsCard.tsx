import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: {
    value: number;
    period: string;
  };
  icon?: LucideIcon;
  variant?: "default" | "compact" | "detailed";
  trend?: "up" | "down" | "stable";
}

export function StatsCard({ 
  title, 
  value, 
  subtitle,
  change,
  icon: Icon,
  variant = "default",
  trend = "stable"
}: StatsCardProps) {
  const getTrendIcon = () => {
    if (trend === "up") return <TrendingUp className="h-4 w-4 text-success" />;
    if (trend === "down") return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getTrendColor = () => {
    if (trend === "up") return "text-success";
    if (trend === "down") return "text-destructive";
    return "text-muted-foreground";
  };

  if (variant === "compact") {
    return (
      <Card className="bg-card border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {Icon && <Icon className="h-4 w-4 text-primary" />}
              <span className="text-sm font-medium text-foreground">{title}</span>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-foreground">{value}</p>
              {change && (
                <div className="flex items-center space-x-1">
                  {getTrendIcon()}
                  <span className={`text-xs ${getTrendColor()}`}>
                    {change.value > 0 ? '+' : ''}{change.value}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === "detailed") {
    return (
      <Card className="bg-gradient-subtle border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {Icon && <Icon className="h-5 w-5 text-primary" />}
              <span className="text-foreground">{title}</span>
            </div>
            {getTrendIcon()}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-3xl font-bold text-foreground">{value}</p>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          {change && (
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground">
                vs {change.period}
              </span>
              <div className="flex items-center space-x-1">
                <Badge 
                  variant={trend === "up" ? "default" : trend === "down" ? "destructive" : "secondary"}
                  className="text-xs"
                >
                  {change.value > 0 ? '+' : ''}{change.value}%
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border/50 hover:shadow-elegant transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          <div className="flex items-center space-x-2">
            {Icon && <Icon className="h-4 w-4 text-primary" />}
            <span className="text-muted-foreground">{title}</span>
          </div>
          {change && getTrendIcon()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-2xl font-bold text-foreground">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
          {change && (
            <div className="flex items-center space-x-2">
              <span className={`text-sm font-medium ${getTrendColor()}`}>
                {change.value > 0 ? '+' : ''}{change.value}%
              </span>
              <span className="text-xs text-muted-foreground">
                vs {change.period}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}