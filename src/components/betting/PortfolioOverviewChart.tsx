import { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { generateCashOutHistory, generateParlayCashOutHistory, CashOutHistoryPoint } from '@/lib/cashout-history';
import { formatCurrency } from '@/lib/currency';
import { Bet } from '@/types/supabase-betting';
import { ParlayWithLegs } from '@/lib/supabase-parlays';

interface PortfolioOverviewChartProps {
  bets: Bet[];
  parlays: ParlayWithLegs[];
  combinedBets: any[];
  currencyMode: 'virtual' | 'real';
}

interface AggregatedPoint {
  label: string;
  timestamp: number;
  totalValue: number;
  totalStake: number;
  betCount: number;
}

const PortfolioOverviewChart = ({
  bets,
  parlays,
  combinedBets,
  currencyMode,
}: PortfolioOverviewChartProps) => {
  const [aggregatedData, setAggregatedData] = useState<AggregatedPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const totalStake = useMemo(() => {
    const singleStake = bets.reduce((sum, b) => sum + b.stake, 0);
    const parlayStake = parlays.reduce((sum, p) => sum + p.total_stake, 0);
    const combinedStake = combinedBets.reduce((sum, cb) => sum + cb.total_stake, 0);
    return singleStake + parlayStake + combinedStake;
  }, [bets, parlays, combinedBets]);

  const totalBets = bets.length + parlays.length + combinedBets.length;

  useEffect(() => {
    if (totalBets === 0) {
      setLoading(false);
      return;
    }

    const fetchAllHistories = async () => {
      setLoading(true);
      try {
        const historyPromises: Promise<CashOutHistoryPoint[]>[] = [];

        // Single bets
        for (const bet of bets) {
          historyPromises.push(
            generateCashOutHistory(
              bet.stake,
              bet.odds,
              bet.city,
              bet.prediction_type,
              bet.prediction_value,
              bet.created_at,
              bet.expires_at
            )
          );
        }

        // Parlays
        for (const parlay of parlays) {
          historyPromises.push(
            generateParlayCashOutHistory(
              parlay.total_stake,
              parlay.combined_odds,
              parlay.parlay_legs || [],
              parlay.created_at,
              parlay.expires_at
            )
          );
        }

        // Combined bets (use similar logic to parlays)
        for (const cb of combinedBets) {
          const legs = (cb.combined_bet_categories || []).map((cat: any) => ({
            city: cb.city,
            prediction_type: cat.prediction_type,
            prediction_value: cat.prediction_value,
          }));
          historyPromises.push(
            generateParlayCashOutHistory(
              cb.total_stake,
              cb.combined_odds,
              legs,
              cb.created_at,
              cb.expires_at
            )
          );
        }

        const allHistories = await Promise.all(historyPromises);

        // Normalize all histories to 10 evenly-spaced time slots and aggregate
        const NUM_SLOTS = 10;
        const now = Date.now();
        const earliestCreation = Math.min(
          ...bets.map(b => new Date(b.created_at).getTime()),
          ...parlays.map(p => new Date(p.created_at).getTime()),
          ...combinedBets.map(cb => new Date(cb.created_at).getTime()),
        );
        const timeRange = now - earliestCreation;

        const aggregated: AggregatedPoint[] = [];

        for (let i = 0; i < NUM_SLOTS; i++) {
          const progress = i / (NUM_SLOTS - 1);
          const targetTime = earliestCreation + timeRange * progress;

          let totalValue = 0;
          let activeCount = 0;

          for (const history of allHistories) {
            if (history.length === 0) continue;

            // Find the closest point at or before this time
            const betStart = history[0].timestamp;
            if (targetTime < betStart) continue; // Bet doesn't exist yet at this time

            activeCount++;
            // Interpolate value at target time
            let value = history[0].amount;
            for (let j = 0; j < history.length; j++) {
              if (history[j].timestamp <= targetTime) {
                value = history[j].amount;
              } else {
                // Interpolate between j-1 and j
                if (j > 0) {
                  const ratio = (targetTime - history[j - 1].timestamp) / (history[j].timestamp - history[j - 1].timestamp);
                  value = history[j - 1].amount + (history[j].amount - history[j - 1].amount) * ratio;
                }
                break;
              }
            }
            totalValue += Math.round(value);
          }

          const date = new Date(targetTime);
          const label = i === 0 ? 'Start' :
            i === NUM_SLOTS - 1 ? 'Now' :
              date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

          aggregated.push({
            label,
            timestamp: targetTime,
            totalValue,
            totalStake,
            betCount: activeCount,
          });
        }

        setAggregatedData(aggregated);
      } catch (error) {
        console.error('Error generating portfolio overview:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllHistories();
  }, [bets, parlays, combinedBets, totalBets, totalStake]);

  if (totalBets === 0) return null;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
          <span className="text-sm text-muted-foreground">Building portfolio overview...</span>
        </CardContent>
      </Card>
    );
  }

  if (aggregatedData.length < 2) return null;

  const currentValue = aggregatedData[aggregatedData.length - 1].totalValue;
  const startValue = aggregatedData[0].totalValue;
  const change = currentValue - startValue;
  const changePercent = startValue > 0 ? ((change / startValue) * 100).toFixed(1) : '0';
  const profitLoss = currentValue - totalStake;
  const trend = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';

  const minValue = Math.min(...aggregatedData.map(d => d.totalValue));
  const maxValue = Math.max(...aggregatedData.map(d => d.totalValue));

  const gradientId = 'portfolioGradient';
  const strokeColor = profitLoss >= 0 ? 'hsl(142, 76%, 36%)' : 'hsl(0, 84%, 60%)';
  const gradientColor = profitLoss >= 0 ? 'hsl(142, 76%, 36%)' : 'hsl(0, 84%, 60%)';

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            📊 Portfolio Overview
            <Badge variant="outline" className="text-xs">
              {totalBets} active
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
            {trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
            {trend === 'stable' && <Minus className="h-4 w-4 text-muted-foreground" />}
            <span className={`text-sm font-semibold ${
              profitLoss >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
              {profitLoss >= 0 ? '+' : ''}{formatCurrency(profitLoss, currencyMode)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
          <span>Total Stake: {formatCurrency(totalStake, currencyMode)}</span>
          <span>•</span>
          <span>Current Value: {formatCurrency(currentValue, currencyMode)}</span>
          <span>•</span>
          <span className={change >= 0 ? 'text-green-500' : 'text-red-500'}>
            {change >= 0 ? '↑' : '↓'} {changePercent}% since start
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={aggregatedData}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={gradientColor} stopOpacity={0.25} />
                <stop offset="95%" stopColor={gradientColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis
              dataKey="label"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              stroke="hsl(var(--border))"
            />
            <YAxis
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              stroke="hsl(var(--border))"
              domain={[minValue * 0.95, maxValue * 1.05]}
              tickFormatter={(v) => currencyMode === 'real' ? `R${v}` : `${v}`}
            />
            <ReferenceLine
              y={totalStake}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 4"
              opacity={0.5}
              label={{
                value: 'Stake',
                position: 'right',
                fill: 'hsl(var(--muted-foreground))',
                fontSize: 10,
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                fontSize: '12px',
              }}
              formatter={(value: number, name: string) => {
                if (name === 'totalValue') return [formatCurrency(value, currencyMode), 'Portfolio Value'];
                return [value, name];
              }}
              labelFormatter={(label) => `Time: ${label}`}
            />
            <Area
              type="monotone"
              dataKey="totalValue"
              stroke={strokeColor}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Summary row */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div className="bg-muted/50 rounded p-2 text-center">
            <p className="text-muted-foreground mb-1">Low</p>
            <p className="font-semibold">{formatCurrency(minValue, currencyMode)}</p>
          </div>
          <div className="bg-muted/50 rounded p-2 text-center">
            <p className="text-muted-foreground mb-1">Current</p>
            <p className="font-semibold text-primary">{formatCurrency(currentValue, currencyMode)}</p>
          </div>
          <div className="bg-muted/50 rounded p-2 text-center">
            <p className="text-muted-foreground mb-1">High</p>
            <p className="font-semibold">{formatCurrency(maxValue, currencyMode)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PortfolioOverviewChart;
