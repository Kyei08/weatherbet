import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, TrendingUp, TrendingDown, Trophy, Target, Zap, MapPin, Calendar as CalendarIcon, ArrowUpDown, Activity, Clock, BarChart3, Percent } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { getBets } from '@/lib/supabase-auth-storage';
import { Bet } from '@/types/supabase-betting';
import {
  calculateBettingStats,
  getCityPerformance,
  getProfitLossOverTime,
  getPredictionTypeStats,
  getBettingPatterns,
  getROIOverTime,
} from '@/lib/betting-analytics';
import CategoryStatistics from './CategoryStatistics';
import { Area, AreaChart, Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, CartesianGrid, Legend } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { useNavigate } from 'react-router-dom';

interface AnalyticsProps {
  onBack: () => void;
}

type TimeFilter = 'today' | 'week' | 'month' | 'all' | 'custom';

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

const Analytics = ({ onBack }: AnalyticsProps) => {
  const navigate = useNavigate();
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [comparisonMode, setComparisonMode] = useState(false);
  const [compareTimeFilter, setCompareTimeFilter] = useState<TimeFilter>('all');
  const [compareDateRange, setCompareDateRange] = useState<DateRange>({ from: undefined, to: undefined });

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

  const getFilteredBets = (filter: TimeFilter = timeFilter, range: DateRange = dateRange) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    const startOfMonth = new Date(now);
    startOfMonth.setDate(now.getDate() - 30);

    switch (filter) {
      case 'today':
        return bets.filter(bet => new Date(bet.created_at) >= startOfToday);
      case 'week':
        return bets.filter(bet => new Date(bet.created_at) >= startOfWeek);
      case 'month':
        return bets.filter(bet => new Date(bet.created_at) >= startOfMonth);
      case 'custom':
        if (!range.from) return bets;
        return bets.filter(bet => {
          const betDate = new Date(bet.created_at);
          const fromDate = new Date(range.from!);
          fromDate.setHours(0, 0, 0, 0);
          const toDate = range.to ? new Date(range.to) : new Date();
          toDate.setHours(23, 59, 59, 999);
          return betDate >= fromDate && betDate <= toDate;
        });
      case 'all':
      default:
        return bets;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  const filteredBets = getFilteredBets();
  const stats = calculateBettingStats(filteredBets);
  const cityPerformance = getCityPerformance(filteredBets);
  const profitLoss = getProfitLossOverTime(filteredBets);
  const predictionStats = getPredictionTypeStats(filteredBets);
  const bettingPatterns = getBettingPatterns(filteredBets);
  const roiOverTime = getROIOverTime(filteredBets);

  const compareFilteredBets = comparisonMode ? getFilteredBets(compareTimeFilter, compareDateRange) : [];
  const compareStats = comparisonMode ? calculateBettingStats(compareFilteredBets) : null;

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
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold">📊 Analytics Dashboard</h1>
                <p className="text-muted-foreground">Your complete betting performance overview</p>
              </div>
            </div>
            <Button 
              variant="outline"
              onClick={() => navigate('/city-analytics')}
              className="gap-2"
            >
              <MapPin className="h-4 w-4" />
              City Deep Dive
            </Button>
          </div>

          {/* Time Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {/* Comparison Mode Toggle */}
                <div className="flex items-center gap-3 pb-3 border-b">
                  <Switch
                    id="comparison-mode"
                    checked={comparisonMode}
                    onCheckedChange={setComparisonMode}
                  />
                  <Label htmlFor="comparison-mode" className="flex items-center gap-2 cursor-pointer">
                    <ArrowUpDown className="h-4 w-4" />
                    <span className="font-medium">Comparison Mode</span>
                  </Label>
                  {comparisonMode && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      Compare two periods side-by-side
                    </span>
                  )}
                </div>

                {/* Period 1 Filters */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground mr-2">
                      {comparisonMode ? 'Period 1:' : 'Period:'}
                    </span>
                <Button
                  variant={timeFilter === 'today' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeFilter('today')}
                >
                  Today
                </Button>
                <Button
                  variant={timeFilter === 'week' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeFilter('week')}
                >
                  Last 7 Days
                </Button>
                <Button
                  variant={timeFilter === 'month' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeFilter('month')}
                >
                  Last 30 Days
                </Button>
                <Button
                  variant={timeFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeFilter('all')}
                >
                  All Time
                </Button>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={timeFilter === 'custom' ? 'default' : 'outline'}
                      size="sm"
                      className={cn(
                        "justify-start text-left font-normal",
                        !dateRange.from && timeFilter === 'custom' && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "MMM dd")} - {format(dateRange.to, "MMM dd, yyyy")}
                          </>
                        ) : (
                          format(dateRange.from, "MMM dd, yyyy")
                        )
                      ) : (
                        <span>Custom Range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={{ from: dateRange.from, to: dateRange.to }}
                      onSelect={(range) => {
                        setDateRange({ from: range?.from, to: range?.to });
                        if (range?.from) {
                          setTimeFilter('custom');
                        }
                      }}
                      numberOfMonths={2}
                      disabled={(date) => date > new Date()}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                  </div>
                </div>

                {/* Period 2 Filters (Comparison Mode) */}
                {comparisonMode && (
                  <div className="space-y-2 pt-3 border-t">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground mr-2">Period 2:</span>
                      <Button
                        variant={compareTimeFilter === 'today' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCompareTimeFilter('today')}
                      >
                        Today
                      </Button>
                      <Button
                        variant={compareTimeFilter === 'week' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCompareTimeFilter('week')}
                      >
                        Last 7 Days
                      </Button>
                      <Button
                        variant={compareTimeFilter === 'month' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCompareTimeFilter('month')}
                      >
                        Last 30 Days
                      </Button>
                      <Button
                        variant={compareTimeFilter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCompareTimeFilter('all')}
                      >
                        All Time
                      </Button>
                      
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={compareTimeFilter === 'custom' ? 'default' : 'outline'}
                            size="sm"
                            className={cn(
                              "justify-start text-left font-normal",
                              !compareDateRange.from && compareTimeFilter === 'custom' && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {compareDateRange.from ? (
                              compareDateRange.to ? (
                                <>
                                  {format(compareDateRange.from, "MMM dd")} - {format(compareDateRange.to, "MMM dd, yyyy")}
                                </>
                              ) : (
                                format(compareDateRange.from, "MMM dd, yyyy")
                              )
                            ) : (
                              <span>Custom Range</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="range"
                            selected={{ from: compareDateRange.from, to: compareDateRange.to }}
                            onSelect={(range) => {
                              setCompareDateRange({ from: range?.from, to: range?.to });
                              if (range?.from) {
                                setCompareTimeFilter('custom');
                              }
                            }}
                            numberOfMonths={2}
                            disabled={(date) => date > new Date()}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <div className="text-3xl font-bold text-primary">{stats.totalBets}</div>
                {comparisonMode && compareStats && (
                  <div className="flex items-center justify-center gap-1 text-xs">
                    <span className={stats.totalBets >= compareStats.totalBets ? 'text-primary' : 'text-destructive'}>
                      {stats.totalBets >= compareStats.totalBets ? '↑' : '↓'}
                      {Math.abs(stats.totalBets - compareStats.totalBets)}
                    </span>
                    <span className="text-muted-foreground">vs {compareStats.totalBets}</span>
                  </div>
                )}
                <div className="text-sm text-muted-foreground">Total Bets</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <div className="text-3xl font-bold text-primary">{stats.winRate.toFixed(1)}%</div>
                {comparisonMode && compareStats && (
                  <div className="flex items-center justify-center gap-1 text-xs">
                    <span className={stats.winRate >= compareStats.winRate ? 'text-primary' : 'text-destructive'}>
                      {stats.winRate >= compareStats.winRate ? '↑' : '↓'}
                      {Math.abs(stats.winRate - compareStats.winRate).toFixed(1)}%
                    </span>
                    <span className="text-muted-foreground">vs {compareStats.winRate.toFixed(1)}%</span>
                  </div>
                )}
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
                {comparisonMode && compareStats && (
                  <div className="flex items-center justify-center gap-1 text-xs">
                    <span className={stats.netProfit >= compareStats.netProfit ? 'text-primary' : 'text-destructive'}>
                      {stats.netProfit >= compareStats.netProfit ? '↑' : '↓'}
                      {Math.abs(stats.netProfit - compareStats.netProfit).toLocaleString()}
                    </span>
                    <span className="text-muted-foreground">vs {compareStats.netProfit >= 0 ? '+' : ''}{compareStats.netProfit.toLocaleString()}</span>
                  </div>
                )}
                <div className="text-sm text-muted-foreground">Net Profit</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <div className={`text-3xl font-bold ${stats.roi >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {stats.roi >= 0 ? '+' : ''}{stats.roi.toFixed(1)}%
                </div>
                {comparisonMode && compareStats && (
                  <div className="flex items-center justify-center gap-1 text-xs">
                    <span className={stats.roi >= compareStats.roi ? 'text-primary' : 'text-destructive'}>
                      {stats.roi >= compareStats.roi ? '↑' : '↓'}
                      {Math.abs(stats.roi - compareStats.roi).toFixed(1)}%
                    </span>
                    <span className="text-muted-foreground">vs {compareStats.roi >= 0 ? '+' : ''}{compareStats.roi.toFixed(1)}%</span>
                  </div>
                )}
                <div className="text-sm text-muted-foreground">ROI</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <div className="text-3xl font-bold text-primary">{stats.currentStreak}</div>
                {comparisonMode && compareStats && (
                  <div className="flex items-center justify-center gap-1 text-xs">
                    <span className={stats.currentStreak >= compareStats.currentStreak ? 'text-primary' : 'text-destructive'}>
                      {stats.currentStreak >= compareStats.currentStreak ? '↑' : '↓'}
                      {Math.abs(stats.currentStreak - compareStats.currentStreak)}
                    </span>
                    <span className="text-muted-foreground">vs {compareStats.currentStreak}</span>
                  </div>
                )}
                <div className="text-sm text-muted-foreground">Current Streak</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ROI Over Time */}
        {roiOverTime.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5 text-primary" />
                ROI Over Time
              </CardTitle>
              <CardDescription>
                Track your Return on Investment percentage over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{
                roi: { label: 'ROI %', color: stats.roi >= 0 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))' }
              }} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={roiOverTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return `${date.getMonth() + 1}/${date.getDate()}`;
                      }}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip content={<ChartTooltipContent formatter={(value) => `${Number(value).toFixed(2)}%`} />} />
                    <Line
                      type="monotone"
                      dataKey="roi"
                      stroke={stats.roi >= 0 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
              <div className="mt-4 grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                <div>
                  <div className="text-sm text-muted-foreground">Total Invested</div>
                  <div className="text-xl font-bold">{stats.totalStaked.toLocaleString()} pts</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Total Returned</div>
                  <div className="text-xl font-bold text-primary">{stats.totalWinnings.toLocaleString()} pts</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Betting Patterns */}
        {bettingPatterns.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Betting Activity Patterns
              </CardTitle>
              <CardDescription>
                Your betting frequency and stake patterns over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{
                betsPlaced: { label: 'Bets Placed', color: 'hsl(var(--primary))' },
                avgStake: { label: 'Avg Stake', color: 'hsl(var(--secondary))' }
              }} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bettingPatterns}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
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
                    <Legend />
                    <Bar dataKey="betsPlaced" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
              <div className="mt-4 grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <div>
                    <div className="text-sm text-muted-foreground">Most Active Hour</div>
                    <div className="text-xl font-bold">{stats.mostActiveBettingHour}:00</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <div>
                    <div className="text-sm text-muted-foreground">Avg Bets/Day</div>
                    <div className="text-xl font-bold">{stats.avgBetsPerDay.toFixed(1)}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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

        {/* Category Statistics Dashboard */}
        {predictionStats.length > 0 && (
          <CategoryStatistics stats={predictionStats} />
        )}
      </div>
    </div>
  );
};

export default Analytics;
