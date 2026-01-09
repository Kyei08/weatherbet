import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BETTING_CONFIG, calculateTimeDecayMultiplier } from '@/lib/betting-config';
import { Clock, TrendingUp, Sparkles } from 'lucide-react';

interface TimeDecayChartProps {
  currentDaysAhead: number;
  baseOdds?: number;
}

const TimeDecayChart = ({ currentDaysAhead, baseOdds = 2.0 }: TimeDecayChartProps) => {
  const { maxBonusDays, maxEarlyBirdBonus, enabled } = BETTING_CONFIG.timeDecay;

  const chartData = useMemo(() => {
    const data = [];
    for (let day = 0; day <= maxBonusDays; day++) {
      const multiplier = calculateTimeDecayMultiplier(day);
      const bonusPercentage = Math.round((multiplier - 1) * 100);
      const adjustedOdds = baseOdds * multiplier;
      data.push({
        day,
        multiplier,
        bonusPercentage,
        adjustedOdds: parseFloat(adjustedOdds.toFixed(2)),
        isCurrent: day === Math.min(currentDaysAhead, maxBonusDays),
      });
    }
    return data;
  }, [currentDaysAhead, baseOdds, maxBonusDays]);

  if (!enabled) return null;

  const maxBarHeight = 100;
  const currentData = chartData.find(d => d.isCurrent) || chartData[0];

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Early Bird Odds Bonus
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current bonus indicator */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Your Bonus:</span>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold text-primary">
              +{currentData.bonusPercentage}%
            </span>
            <span className="text-xs text-muted-foreground ml-2">
              ({currentData.multiplier.toFixed(2)}x odds)
            </span>
          </div>
        </div>

        {/* Visual bar chart */}
        <div className="space-y-2">
          <div className="flex items-end justify-between gap-1.5 h-24">
            {chartData.map((data) => {
              const heightPercent = (data.bonusPercentage / (maxEarlyBirdBonus * 100)) * maxBarHeight;
              const isActive = data.day <= currentDaysAhead;
              const isCurrent = data.isCurrent;

              return (
                <div
                  key={data.day}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <div
                    className={`w-full rounded-t-sm transition-all duration-300 ${
                      isCurrent
                        ? 'bg-primary shadow-lg shadow-primary/30'
                        : isActive
                        ? 'bg-primary/60'
                        : 'bg-muted'
                    }`}
                    style={{
                      height: `${Math.max(heightPercent, 8)}%`,
                      minHeight: '4px',
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Day labels */}
          <div className="flex justify-between gap-1.5">
            {chartData.map((data) => (
              <div
                key={data.day}
                className={`flex-1 text-center text-xs ${
                  data.isCurrent
                    ? 'text-primary font-bold'
                    : 'text-muted-foreground'
                }`}
              >
                {data.day === 0 ? 'Today' : `${data.day}d`}
              </div>
            ))}
          </div>
        </div>

        {/* Bonus scale */}
        <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Same day: No bonus</span>
          </div>
          <div className="flex items-center gap-1">
            <span>{maxBonusDays}+ days: +{Math.round(maxEarlyBirdBonus * 100)}% max</span>
          </div>
        </div>

        {/* Example odds preview */}
        {baseOdds > 0 && (
          <div className="grid grid-cols-3 gap-2 pt-2">
            {[1, Math.ceil(maxBonusDays / 2), maxBonusDays].map((day) => {
              const data = chartData.find(d => d.day === day);
              if (!data) return null;
              return (
                <div
                  key={day}
                  className={`text-center p-2 rounded-md ${
                    day === Math.min(currentDaysAhead, maxBonusDays)
                      ? 'bg-primary/20 border border-primary/30'
                      : 'bg-muted/50'
                  }`}
                >
                  <div className="text-xs text-muted-foreground">{day} day{day > 1 ? 's' : ''}</div>
                  <div className="text-sm font-semibold">{data.adjustedOdds.toFixed(2)}x</div>
                  <div className="text-xs text-primary">+{data.bonusPercentage}%</div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TimeDecayChart;
