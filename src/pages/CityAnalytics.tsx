import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MapPin, TrendingUp, TrendingDown, Clock, Calendar, Target, Zap, BarChart3, Sun, Cloud } from 'lucide-react';
import { getBets } from '@/lib/supabase-auth-storage';
import { Bet, CITIES } from '@/types/supabase-betting';
import { getCityAnalytics, getWeatherCorrelation, getBettingWindows } from '@/lib/city-analytics';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Area, AreaChart, Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { useNavigate } from 'react-router-dom';
import { useCurrencyMode } from '@/contexts/CurrencyModeContext';

const CityAnalytics = () => {
  const navigate = useNavigate();
  const { mode } = useCurrencyMode();
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState<string>(CITIES[0]);

  useEffect(() => {
    loadBets();
  }, [mode]);

  const loadBets = async () => {
    try {
      setLoading(true);
      const currencyType = mode === 'real' ? 'real' : 'virtual';
      const data = await getBets(undefined, currencyType);
      setBets(data);
      
      // Set default city to the one with most bets
      const cityCounts = data.reduce((acc, bet) => {
        acc[bet.city] = (acc[bet.city] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const mostBettedCity = Object.entries(cityCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0];
      
      if (mostBettedCity) {
        setSelectedCity(mostBettedCity);
      }
    } catch (error) {
      console.error('Error loading bets:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading city analytics...</p>
      </div>
    );
  }

  const cityAnalytics = getCityAnalytics(bets, selectedCity);
  const weatherCorrelation = getWeatherCorrelation(bets, selectedCity);
  const bettingWindows = getBettingWindows(bets, selectedCity);

  // Prepare radar chart data for prediction type performance
  const radarData = [
    { metric: 'Win Rate', rain: cityAnalytics.rainWinRate, temp: cityAnalytics.tempWinRate, fullMark: 100 },
    { metric: 'Total Bets', rain: cityAnalytics.rainBets, temp: cityAnalytics.tempBets, fullMark: Math.max(cityAnalytics.rainBets, cityAnalytics.tempBets) || 1 },
  ];

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold">🏙️ City Deep Dive</h1>
              <p className="text-muted-foreground">Detailed analytics for optimal betting strategy</p>
            </div>
          </div>

          {/* City Selector */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <MapPin className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Select City:</span>
                <Select value={selectedCity} onValueChange={setSelectedCity}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CITIES.map(city => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {cityAnalytics.totalBets === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">No betting data available for {selectedCity}. Place some bets to see analytics!</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Overview Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center space-y-2">
                    <div className="text-3xl font-bold text-primary">{cityAnalytics.totalBets}</div>
                    <div className="text-sm text-muted-foreground">Total Bets</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center space-y-2">
                    <div className="text-3xl font-bold text-primary">{cityAnalytics.winRate.toFixed(1)}%</div>
                    <div className="text-sm text-muted-foreground">Win Rate</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center space-y-2">
                    <div className={`text-3xl font-bold ${cityAnalytics.netProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {cityAnalytics.netProfit >= 0 ? '+' : ''}{cityAnalytics.netProfit.toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">Net Profit</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center space-y-2">
                    <div className="text-3xl font-bold text-primary">{cityAnalytics.avgOdds.toFixed(2)}x</div>
                    <div className="text-sm text-muted-foreground">Avg Odds</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Recent Form
                </CardTitle>
                <CardDescription>Last 10 settled bets in {selectedCity}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  {cityAnalytics.recentForm.map((result, i) => (
                    <div
                      key={i}
                      className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg ${
                        result === 'W' ? 'bg-primary text-primary-foreground' :
                        result === 'L' ? 'bg-destructive text-destructive-foreground' :
                        'bg-muted text-muted-foreground'
                      }`}
                    >
                      {result}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Prediction Type Performance */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Best Prediction Type
                  </CardTitle>
                  <CardDescription>Rain vs Temperature performance in {selectedCity}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg space-y-2 bg-primary/5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Cloud className="h-5 w-5 text-primary" />
                          <span className="font-semibold">Rain Predictions</span>
                        </div>
                        <span className="text-2xl">☔</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <div className="text-muted-foreground">Bets</div>
                          <div className="font-bold">{cityAnalytics.rainBets}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Wins</div>
                          <div className="font-bold text-primary">{cityAnalytics.rainWins}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Win Rate</div>
                          <div className="font-bold">{cityAnalytics.rainWinRate.toFixed(1)}%</div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sun className="h-5 w-5 text-secondary" />
                          <span className="font-semibold">Temperature Predictions</span>
                        </div>
                        <span className="text-2xl">🌡️</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <div className="text-muted-foreground">Bets</div>
                          <div className="font-bold">{cityAnalytics.tempBets}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Wins</div>
                          <div className="font-bold text-primary">{cityAnalytics.tempWins}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Win Rate</div>
                          <div className="font-bold">{cityAnalytics.tempWinRate.toFixed(1)}%</div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-accent/20 rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">Recommended:</div>
                      <div className="text-xl font-bold text-primary">
                        {cityAnalytics.bestPredictionType} {cityAnalytics.bestPredictionType === 'Rain' ? '☔' : '🌡️'}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Weather Correlation */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Weather Pattern Insights
                  </CardTitle>
                  <CardDescription>Odds correlation and optimal ranges</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                      <span className="text-sm text-muted-foreground">Avg Winning Odds</span>
                      <span className="font-bold text-primary">{weatherCorrelation.avgWinningOdds.toFixed(2)}x</span>
                    </div>
                    <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                      <span className="text-sm text-muted-foreground">Avg Losing Odds</span>
                      <span className="font-bold text-destructive">{weatherCorrelation.avgLosingOdds.toFixed(2)}x</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">High Odds (&gt;2.5x)</span>
                      <span className="font-semibold">{weatherCorrelation.highOddsWinRate.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${weatherCorrelation.highOddsWinRate}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Low Odds (≤2.5x)</span>
                      <span className="font-semibold">{weatherCorrelation.lowOddsWinRate.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${weatherCorrelation.lowOddsWinRate}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="text-sm text-muted-foreground mb-2">Optimal Odds Range:</div>
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <div className="text-2xl font-bold text-primary text-center">
                        {weatherCorrelation.optimalOddsRange.min.toFixed(1)}x - {weatherCorrelation.optimalOddsRange.max.toFixed(1)}x
                      </div>
                      <div className="text-xs text-center text-muted-foreground mt-1">
                        Most profitable range based on history
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Optimal Betting Windows */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Optimal Betting Windows
                </CardTitle>
                <CardDescription>Best times to place bets in {selectedCity}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Hourly Performance
                    </h4>
                    <div className="p-4 bg-primary/10 rounded-lg">
                      <div className="text-sm text-muted-foreground">Best Hour</div>
                      <div className="text-3xl font-bold text-primary">{bettingWindows.bestHour}:00</div>
                    </div>
                    <div className="p-4 bg-destructive/10 rounded-lg">
                      <div className="text-sm text-muted-foreground">Worst Hour</div>
                      <div className="text-3xl font-bold text-destructive">{bettingWindows.worstHour}:00</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Daily Performance
                    </h4>
                    <div className="p-4 bg-primary/10 rounded-lg">
                      <div className="text-sm text-muted-foreground">Best Day</div>
                      <div className="text-3xl font-bold text-primary">{bettingWindows.bestDay}</div>
                    </div>
                    <div className="p-4 bg-destructive/10 rounded-lg">
                      <div className="text-sm text-muted-foreground">Worst Day</div>
                      <div className="text-3xl font-bold text-destructive">{bettingWindows.worstDay}</div>
                    </div>
                  </div>
                </div>

                {/* Hourly Performance Chart */}
                {bettingWindows.hourlyPerformance.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold">Profit by Hour</h4>
                    <ChartContainer config={{
                      profit: { label: 'Profit', color: 'hsl(var(--primary))' }
                    }} className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={bettingWindows.hourlyPerformance}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                          <XAxis
                            dataKey="hour"
                            tickFormatter={(value) => `${value}:00`}
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                          />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <Tooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="profit" radius={[8, 8, 0, 0]}>
                            {bettingWindows.hourlyPerformance.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={entry.profit >= 0 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </div>
                )}

                {/* Daily Performance Chart */}
                {bettingWindows.dailyPerformance.length > 0 && (
                  <div className="space-y-3 mt-6">
                    <h4 className="font-semibold">Profit by Day of Week</h4>
                    <ChartContainer config={{
                      profit: { label: 'Profit', color: 'hsl(var(--primary))' }
                    }} className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={bettingWindows.dailyPerformance}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                          <XAxis
                            dataKey="day"
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                          />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <Tooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="profit" radius={[8, 8, 0, 0]}>
                            {bettingWindows.dailyPerformance.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={entry.profit >= 0 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pro Tips */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Strategy Recommendations
                </CardTitle>
                <CardDescription>AI-powered insights for {selectedCity}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                    <div className="mt-0.5">💡</div>
                    <div>
                      <div className="font-semibold">Best Prediction Type</div>
                      <div className="text-sm text-muted-foreground">
                        Focus on <span className="font-semibold text-foreground">{cityAnalytics.bestPredictionType}</span> predictions with a {cityAnalytics.bestPredictionType === 'Rain' ? cityAnalytics.rainWinRate.toFixed(1) : cityAnalytics.tempWinRate.toFixed(1)}% win rate
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                    <div className="mt-0.5">⏰</div>
                    <div>
                      <div className="font-semibold">Optimal Timing</div>
                      <div className="text-sm text-muted-foreground">
                        Place bets on <span className="font-semibold text-foreground">{bettingWindows.bestDay}</span> around <span className="font-semibold text-foreground">{bettingWindows.bestHour}:00</span> for best results
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                    <div className="mt-0.5">🎯</div>
                    <div>
                      <div className="font-semibold">Smart Odds Selection</div>
                      <div className="text-sm text-muted-foreground">
                        Target odds between <span className="font-semibold text-foreground">{weatherCorrelation.optimalOddsRange.min.toFixed(1)}x-{weatherCorrelation.optimalOddsRange.max.toFixed(1)}x</span> for optimal profitability
                      </div>
                    </div>
                  </div>

                  {cityAnalytics.avgStake > 0 && (
                    <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                      <div className="mt-0.5">💰</div>
                      <div>
                        <div className="font-semibold">Recommended Stake</div>
                        <div className="text-sm text-muted-foreground">
                          Your average stake is <span className="font-semibold text-foreground">{Math.round(cityAnalytics.avgStake)} points</span> - maintain consistency for better tracking
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default CityAnalytics;
