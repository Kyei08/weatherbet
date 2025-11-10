import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getBonusStats, getBonusEarningsOverTime, BonusStats } from '@/lib/supabase-bonus-tracker';
import { TrendingUp, Zap, Gift, Award, DollarSign } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';

export const BonusTracker = () => {
  const [stats, setStats] = useState<BonusStats | null>(null);
  const [chartData, setChartData] = useState<{ date: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [bonusStats, earningsOverTime] = await Promise.all([
        getBonusStats(),
        getBonusEarningsOverTime(30),
      ]);
      setStats(bonusStats);
      setChartData(earningsOverTime);
    } catch (error) {
      console.error('Error loading bonus tracker data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Bonus Tracker
          </CardTitle>
          <CardDescription>Loading bonus statistics...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!stats) return null;

  const chartConfig = {
    amount: {
      label: 'Bonus Points',
      color: 'hsl(var(--primary))',
    },
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Bonus Tracker
          </CardTitle>
          <CardDescription>
            Track your extra earnings from shop items and multipliers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Award className="h-4 w-4" />
                Total Bonus Earnings
              </div>
              <div className="text-2xl font-bold text-primary">
                +{stats.totalBonusEarnings.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">
                {stats.totalBonusCount} bonus{stats.totalBonusCount !== 1 ? 'es' : ''} applied
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                This Week
              </div>
              <div className="text-2xl font-bold">
                +{stats.earningsThisWeek.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">
                Last 7 days
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                This Month
              </div>
              <div className="text-2xl font-bold">
                +{stats.earningsThisMonth.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">
                Last 30 days
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Gift className="h-4 w-4" />
                Average Bonus
              </div>
              <div className="text-2xl font-bold">
                +{Math.round(stats.averageBonus).toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">
                Per bonus applied
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <h4 className="text-sm font-semibold">Bonus Breakdown</h4>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Multipliers</div>
                  <div className="text-lg font-bold text-primary">
                    +{stats.multiplierEarnings.toLocaleString()}
                  </div>
                </div>
                <Zap className="h-8 w-8 text-primary/50" />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Bonus Points</div>
                  <div className="text-lg font-bold text-primary">
                    +{stats.bonusPointsEarnings.toLocaleString()}
                  </div>
                </div>
                <Gift className="h-8 w-8 text-primary/50" />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Stake Boosts</div>
                  <div className="text-lg font-bold text-primary">
                    +{stats.stakeBoostEarnings.toLocaleString()}
                  </div>
                </div>
                <TrendingUp className="h-8 w-8 text-primary/50" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bonus Earnings Over Time</CardTitle>
            <CardDescription>Last 30 days of bonus point earnings</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getMonth() + 1}/${date.getDate()}`;
                    }}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="hsl(var(--primary))"
                    fillOpacity={1}
                    fill="url(#colorAmount)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
