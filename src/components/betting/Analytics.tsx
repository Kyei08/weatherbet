import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, TrendingUp, TrendingDown, Trophy, Target, Zap, MapPin } from 'lucide-react';
import { getBets } from '@/lib/supabase-auth-storage';
import { Bet } from '@/types/supabase-betting';
import {
  calculateBettingStats,
  getCityPerformance,
  getProfitLossOverTime,
  getPredictionTypeStats,
} from '@/lib/betting-analytics';
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';

interface AnalyticsProps {
  onBack: () => void;
}

const Analytics = ({ onBack }: AnalyticsProps) => {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBets();
  }, []);

  const loadBets = async () => {
    try {
      setLoading(true);
      const data = await getBets();
      setBets(data);
    } catch (error) {
      console.error('Error loading bets:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  const stats = calculateBettingStats(bets);
  const cityPerformance = getCityPerformance(bets);
  const profitLoss = getProfitLossOverTime(bets);
  const predictionStats = getPredictionTypeStats(bets);

  const profitLossConfig = {
    cumulativeProfit: {
      label: 'Cumulative Profit',
      color: stats.netProfit >= 0 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))',
    },
  };

  const cityColors = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">📊 Analytics Dashboard</h1>
            <p className="text-muted-foreground">Your complete betting performance overview</p>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <div className="text-3xl font-bold text-primary">{stats.totalBets}</div>
                <div className="text-sm text-muted-foreground">Total Bets</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <div className="text-3xl font-bold text-primary">{stats.winRate.toFixed(1)}%</div>
                <div className="text-sm text-muted-foreground">Win Rate</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <div className={`text-3xl font-bold ${stats.netProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {stats.netProfit >= 0 ? '+' : ''}{stats.netProfit.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Net Profit</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <div className="text-3xl font-bold text-primary">{stats.currentStreak}</div>
                <div className="text-sm text-muted-foreground">Current Streak</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profit/Loss Over Time */}
        {profitLoss.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {stats.netProfit >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-primary" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-destructive" />
                )}
                Profit/Loss Over Time
              </CardTitle>
              <CardDescription>
                Track your betting performance and cumulative profit
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={profitLossConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={profitLoss}>
                    <defs>
                      <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor={stats.netProfit >= 0 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'}
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor={stats.netProfit >= 0 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'}
                          stopOpacity={0}
                        />
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
                      dataKey="cumulativeProfit"
                      stroke={stats.netProfit >= 0 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'}
                      fillOpacity={1}
                      fill="url(#profitGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {/* Performance Stats */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Detailed Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Betting Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Total Wins</div>
                  <div className="text-2xl font-bold text-primary">{stats.totalWins}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Total Losses</div>
                  <div className="text-2xl font-bold text-destructive">{stats.totalLosses}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Pending Bets</div>
                  <div className="text-2xl font-bold">{stats.pendingBets}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Cash Outs</div>
                  <div className="text-2xl font-bold">{stats.totalCashOuts}</div>
                </div>
              </div>
              
              <div className="pt-4 border-t space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Staked</span>
                  <span className="font-semibold">{stats.totalStaked.toLocaleString()} pts</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Winnings</span>
                  <span className="font-semibold text-primary">{stats.totalWinnings.toLocaleString()} pts</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Average Stake</span>
                  <span className="font-semibold">{Math.round(stats.averageStake)} pts</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Average Odds</span>
                  <span className="font-semibold">{stats.averageOdds.toFixed(2)}x</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Streaks & Records */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Streaks & Records
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg">
                  <div>
                    <div className="text-sm text-muted-foreground">Current Win Streak</div>
                    <div className="text-3xl font-bold text-primary">{stats.currentStreak}</div>
                  </div>
                  <Zap className="h-12 w-12 text-primary/50" />
                </div>

                <div className="flex items-center justify-between p-4 bg-secondary/10 rounded-lg">
                  <div>
                    <div className="text-sm text-muted-foreground">Longest Win Streak</div>
                    <div className="text-3xl font-bold text-secondary">{stats.longestStreak}</div>
                  </div>
                  <Trophy className="h-12 w-12 text-secondary/50" />
                </div>
              </div>

              <div className="pt-4 border-t space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Best City</span>
                  <span className="font-semibold text-primary">{stats.bestCity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Worst City</span>
                  <span className="font-semibold text-destructive">{stats.worstCity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Rain Win Rate</span>
                  <span className="font-semibold">{stats.rainWinRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Temp Win Rate</span>
                  <span className="font-semibold">{stats.tempWinRate.toFixed(1)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* City Performance */}
        {cityPerformance.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Performance by City
              </CardTitle>
              <CardDescription>See which cities bring you the most success</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cityPerformance}>
                    <XAxis dataKey="city" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="bg-background border rounded-lg p-3 shadow-lg">
                            <div className="font-semibold mb-2">{data.city}</div>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Bets:</span>
                                <span className="font-medium">{data.bets}</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Win Rate:</span>
                                <span className="font-medium">{data.winRate.toFixed(1)}%</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Net Profit:</span>
                                <span className={`font-medium ${data.netProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                                  {data.netProfit >= 0 ? '+' : ''}{data.netProfit}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="netProfit" radius={[8, 8, 0, 0]}>
                      {cityPerformance.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.netProfit >= 0 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>

              <div className="mt-4 grid gap-2">
                {cityPerformance.slice(0, 5).map((city, index) => (
                  <div key={city.city} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-8 rounded"
                        style={{ backgroundColor: cityColors[index % cityColors.length] }}
                      />
                      <div>
                        <div className="font-medium">{city.city}</div>
                        <div className="text-sm text-muted-foreground">
                          {city.wins}W / {city.losses}L ({city.winRate.toFixed(0)}%)
                        </div>
                      </div>
                    </div>
                    <div className={`font-semibold ${city.netProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {city.netProfit >= 0 ? '+' : ''}{city.netProfit}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Prediction Type Comparison */}
        {predictionStats.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Prediction Type Performance</CardTitle>
              <CardDescription>Compare your success with rain vs temperature predictions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {predictionStats.map((stat) => (
                  <div key={stat.type} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg">{stat.type}</h3>
                      <span className="text-2xl">{stat.type === 'Rain' ? '🌧️' : '🌡️'}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Bets</span>
                        <span className="font-medium">{stat.bets}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Wins</span>
                        <span className="font-medium text-primary">{stat.wins}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Win Rate</span>
                        <span className="font-medium">{stat.winRate.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2 mt-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${stat.winRate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Analytics;
