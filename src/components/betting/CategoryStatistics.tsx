import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PredictionTypeStats } from '@/lib/betting-analytics';
import { 
  CloudRain, 
  Thermometer, 
  CloudDrizzle, 
  Snowflake, 
  Wind, 
  Droplets, 
  Gauge, 
  Cloud,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface CategoryStatisticsProps {
  stats: PredictionTypeStats[];
}

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  'Rain': CloudRain,
  'Temperature': Thermometer,
  'Rainfall': CloudDrizzle,
  'Snow': Snowflake,
  'Wind': Wind,
  'Dew Point': Droplets,
  'Pressure': Gauge,
  'Cloud Coverage': Cloud,
};

const CategoryStatistics = ({ stats }: CategoryStatisticsProps) => {
  if (stats.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Category Statistics</CardTitle>
          <CardDescription>No betting data available yet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Sort by ROI for best performing category
  const sortedByROI = [...stats].sort((a, b) => b.roi - a.roi);
  const bestCategory = sortedByROI[0];
  const worstCategory = sortedByROI[sortedByROI.length - 1];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Category Performance Overview</CardTitle>
          <CardDescription>
            Historical win rates and statistics for each weather category
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-success/10 border border-success/20">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-success" />
                <span className="font-semibold text-success">Best Category</span>
              </div>
              <div className="text-2xl font-bold">{bestCategory.type}</div>
              <div className="text-sm text-muted-foreground">
                {bestCategory.roi.toFixed(1)}% ROI • {bestCategory.winRate.toFixed(1)}% Win Rate
              </div>
            </div>
            
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-5 w-5 text-destructive" />
                <span className="font-semibold text-destructive">Needs Improvement</span>
              </div>
              <div className="text-2xl font-bold">{worstCategory.type}</div>
              <div className="text-sm text-muted-foreground">
                {worstCategory.roi.toFixed(1)}% ROI • {worstCategory.winRate.toFixed(1)}% Win Rate
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stats.map((stat) => {
          const Icon = categoryIcons[stat.type] || CloudRain;
          const isPositiveROI = stat.roi > 0;
          const isProfitable = stat.netProfit > 0;
          
          return (
            <Card key={stat.type} className="relative overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{stat.type}</CardTitle>
                  </div>
                  <Badge variant={isProfitable ? "default" : "destructive"}>
                    {isProfitable ? '+' : ''}{stat.netProfit.toLocaleString()} pts
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Win Rate Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Win Rate</span>
                    <span className="font-semibold">{stat.winRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={stat.winRate} className="h-2" />
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Total Bets</div>
                    <div className="text-lg font-bold">{stat.bets}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Wins/Losses</div>
                    <div className="text-lg font-bold">
                      <span className="text-success">{stat.wins}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-destructive">{stat.losses}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Avg Odds</div>
                    <div className="text-lg font-bold">{stat.avgOdds.toFixed(2)}x</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">ROI</div>
                    <div className={`text-lg font-bold ${isPositiveROI ? 'text-success' : 'text-destructive'}`}>
                      {isPositiveROI ? '+' : ''}{stat.roi.toFixed(1)}%
                    </div>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <div className="text-xs text-muted-foreground">Total Staked</div>
                    <div className="text-lg font-bold">{stat.totalStaked.toLocaleString()} pts</div>
                  </div>
                </div>

                {/* Performance Indicator */}
                <div className={`p-2 rounded-md text-center text-sm ${
                  stat.winRate >= 60 ? 'bg-success/10 text-success' :
                  stat.winRate >= 40 ? 'bg-warning/10 text-warning' :
                  'bg-destructive/10 text-destructive'
                }`}>
                  {stat.winRate >= 60 ? '🎯 Excellent Performance' :
                   stat.winRate >= 40 ? '⚠️ Average Performance' :
                   '📉 Consider Reviewing Strategy'}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryStatistics;