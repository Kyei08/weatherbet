import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Clock } from "lucide-react";

interface BettingCardProps {
  title: string;
  odds: number;
  stake?: number;
  potentialWin?: number;
  status?: "active" | "won" | "lost" | "pending";
  timeRemaining?: string;
  trend?: "up" | "down" | "stable";
  variant?: "default" | "compact" | "featured";
}

export function BettingCard({ 
  title, 
  odds, 
  stake, 
  potentialWin,
  status = "active",
  timeRemaining,
  trend = "stable",
  variant = "default"
}: BettingCardProps) {
  const getTrendIcon = () => {
    if (trend === "up") return <TrendingUp className="h-4 w-4 text-success" />;
    if (trend === "down") return <TrendingDown className="h-4 w-4 text-destructive" />;
    return null;
  };

  const getStatusBadge = () => {
    const variants = {
      active: "default",
      won: "default", // Using success colors from theme
      lost: "destructive",
      pending: "secondary"
    } as const;

    return <Badge variant={variants[status]}>{status.toUpperCase()}</Badge>;
  };

  if (variant === "compact") {
    return (
      <Card className="bg-card border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="font-medium text-foreground text-sm">{title}</p>
              <p className="text-xs text-muted-foreground">Odds: {odds.toFixed(2)}</p>
            </div>
            <div className="flex items-center space-x-2">
              {getTrendIcon()}
              {getStatusBadge()}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === "featured") {
    return (
      <Card className="bg-gradient-primary text-primary-foreground border-primary/20 shadow-glow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{title}</CardTitle>
            {getTrendIcon()}
          </div>
          {timeRemaining && (
            <div className="flex items-center space-x-1 text-sm opacity-80">
              <Clock className="h-3 w-3" />
              <span>{timeRemaining}</span>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80">Odds</p>
              <p className="text-2xl font-bold">{odds.toFixed(2)}</p>
            </div>
            {potentialWin && (
              <div className="text-right">
                <p className="text-sm opacity-80">Potential Win</p>
                <p className="text-xl font-semibold">${potentialWin.toFixed(2)}</p>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <Button variant="secondary" size="sm">
              Place Bet
            </Button>
            {getStatusBadge()}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border/50 hover:shadow-elegant transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-foreground">{title}</CardTitle>
          {getTrendIcon()}
        </div>
        {timeRemaining && (
          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{timeRemaining}</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Odds</p>
            <p className="text-xl font-bold text-foreground">{odds.toFixed(2)}</p>
          </div>
          {stake && (
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Stake</p>
              <p className="text-lg font-semibold text-foreground">${stake.toFixed(2)}</p>
            </div>
          )}
        </div>
        {potentialWin && (
          <div className="pt-2 border-t border-border">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Potential Win</span>
              <span className="font-medium text-success">${potentialWin.toFixed(2)}</span>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between pt-2">
          <Button size="sm" variant="outline">
            Edit Bet
          </Button>
          {getStatusBadge()}
        </div>
      </CardContent>
    </Card>
  );
}