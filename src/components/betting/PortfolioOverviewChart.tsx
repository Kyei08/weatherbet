import { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Minus, RefreshCw, Layers, BarChart3 } from 'lucide-react';
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

interface BetMeta {
  id: string;
  label: string;
  type: 'single' | 'parlay' | 'combined';
  stake: number;
}

const NUM_SLOTS = 10;

// Distinct colors for stacked areas (HSL values for good contrast)
const STACK_COLORS = [
  'hsl(210, 80%, 55%)',
  'hsl(150, 65%, 45%)',
  'hsl(35, 90%, 55%)',
  'hsl(280, 65%, 55%)',
  'hsl(0, 75%, 55%)',
  'hsl(180, 60%, 45%)',
  'hsl(60, 80%, 45%)',
  'hsl(320, 70%, 55%)',
  'hsl(100, 60%, 45%)',
  'hsl(240, 60%, 60%)',
];

function interpolateValue(history: CashOutHistoryPoint[], targetTime: number): number | null {
  if (history.length === 0) return null;
  const betStart = history[0].timestamp;
  if (targetTime < betStart) return null;

  let value = history[0].amount;
  for (let j = 0; j < history.length; j++) {
    if (history[j].timestamp <= targetTime) {
      value = history[j].amount;
    } else {
      if (j > 0) {
        const ratio = (targetTime - history[j - 1].timestamp) / (history[j].timestamp - history[j - 1].timestamp);
        value = history[j - 1].amount + (history[j].amount - history[j - 1].amount) * ratio;
      }
      break;
    }
  }
  return Math.round(value);
}

const PortfolioOverviewChart = ({
  bets,
  parlays,
  combinedBets,
  currencyMode,
}: PortfolioOverviewChartProps) => {
  const [chartData, setChartData] = useState<Record<string, any>[]>([]);
  const [betMetas, setBetMetas] = useState<BetMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'aggregate' | 'stacked'>('aggregate');

  const totalStake = useMemo(() => {
    return bets.reduce((s, b) => s + b.stake, 0)
      + parlays.reduce((s, p) => s + p.total_stake, 0)
      + combinedBets.reduce((s, cb) => s + cb.total_stake, 0);
  }, [bets, parlays, combinedBets]);

  const totalBets = bets.length + parlays.length + combinedBets.length;

  useEffect(() => {
    if (totalBets === 0) { setLoading(false); return; }

    const fetchAllHistories = async () => {
      setLoading(true);
      try {
        const metas: BetMeta[] = [];
        const historyPromises: Promise<CashOutHistoryPoint[]>[] = [];

        for (const bet of bets) {
          metas.push({ id: bet.id, label: `${bet.city} · ${bet.prediction_value}`, type: 'single', stake: bet.stake });
          historyPromises.push(generateCashOutHistory(bet.stake, bet.odds, bet.city, bet.prediction_type, bet.prediction_value, bet.created_at, bet.expires_at));
        }

        for (const parlay of parlays) {
          const cities = (parlay.parlay_legs || []).map((l: any) => l.city).join(', ');
          metas.push({ id: parlay.id, label: `Parlay · ${cities || 'Multi'}`, type: 'parlay', stake: parlay.total_stake });
          historyPromises.push(generateParlayCashOutHistory(parlay.total_stake, parlay.combined_odds, parlay.parlay_legs || [], parlay.created_at, parlay.expires_at));
        }

        for (const cb of combinedBets) {
          const catCount = (cb.combined_bet_categories || []).length;
          metas.push({ id: cb.id, label: `Combined · ${cb.city} (${catCount})`, type: 'combined', stake: cb.total_stake });
          const legs = (cb.combined_bet_categories || []).map((cat: any) => ({ city: cb.city, prediction_type: cat.prediction_type, prediction_value: cat.prediction_value }));
          historyPromises.push(generateParlayCashOutHistory(cb.total_stake, cb.combined_odds, legs, cb.created_at, cb.expires_at));
        }

        const allHistories = await Promise.all(historyPromises);
        setBetMetas(metas);

        const now = Date.now();
        const allItems = [...bets, ...parlays, ...combinedBets];
        const earliestCreation = Math.min(...allItems.map(b => new Date(b.created_at).getTime()));
        const timeRange = now - earliestCreation;

        const data: Record<string, any>[] = [];

        for (let i = 0; i < NUM_SLOTS; i++) {
          const progress = i / (NUM_SLOTS - 1);
          const targetTime = earliestCreation + timeRange * progress;
          const date = new Date(targetTime);
          const label = i === 0 ? 'Start' : i === NUM_SLOTS - 1 ? 'Now' : date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

          const point: Record<string, any> = { label, timestamp: targetTime, totalValue: 0 };

          for (let b = 0; b < allHistories.length; b++) {
            const val = interpolateValue(allHistories[b], targetTime);
            const key = metas[b].id;
            point[key] = val ?? 0;
            point.totalValue += val ?? 0;
          }

          data.push(point);
        }

        setChartData(data);
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

  if (chartData.length < 2) return null;

  const currentValue = chartData[chartData.length - 1].totalValue;
  const startValue = chartData[0].totalValue;
  const change = currentValue - startValue;
  const changePercent = startValue > 0 ? ((change / startValue) * 100).toFixed(1) : '0';
  const profitLoss = currentValue - totalStake;
  const trend = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';

  const allValues = chartData.map(d => d.totalValue as number);
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);

  const aggregateStrokeColor = profitLoss >= 0 ? 'hsl(142, 76%, 36%)' : 'hsl(0, 84%, 60%)';
  const aggregateGradientColor = profitLoss >= 0 ? 'hsl(142, 76%, 36%)' : 'hsl(0, 84%, 60%)';

  const isStacked = viewMode === 'stacked';

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
          <div className="flex items-center gap-3">
            <div className="flex items-center border rounded-md overflow-hidden">
              <Button
                variant={viewMode === 'aggregate' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2 rounded-none text-xs"
                onClick={() => setViewMode('aggregate')}
              >
                <BarChart3 className="h-3 w-3 mr-1" />
                Total
              </Button>
              <Button
                variant={viewMode === 'stacked' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2 rounded-none text-xs"
                onClick={() => setViewMode('stacked')}
              >
                <Layers className="h-3 w-3 mr-1" />
                Breakdown
              </Button>
            </div>
            <div className="flex items-center gap-1">
              {trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
              {trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
              {trend === 'stable' && <Minus className="h-4 w-4 text-muted-foreground" />}
              <span className={`text-sm font-semibold ${profitLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {profitLoss >= 0 ? '+' : ''}{formatCurrency(profitLoss, currencyMode)}
              </span>
            </div>
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
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData} stackOffset={isStacked ? 'none' : undefined}>
            <defs>
              <linearGradient id="portfolioGradientAgg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={aggregateGradientColor} stopOpacity={0.25} />
                <stop offset="95%" stopColor={aggregateGradientColor} stopOpacity={0} />
              </linearGradient>
              {betMetas.map((meta, idx) => (
                <linearGradient key={meta.id} id={`stackGrad_${meta.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={STACK_COLORS[idx % STACK_COLORS.length]} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={STACK_COLORS[idx % STACK_COLORS.length]} stopOpacity={0.05} />
                </linearGradient>
              ))}
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
              tickFormatter={(v) => currencyMode === 'real' ? `R${v}` : `${v}`}
            />
            {!isStacked && (
              <ReferenceLine
                y={totalStake}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                opacity={0.5}
                label={{ value: 'Stake', position: 'right', fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              />
            )}
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                fontSize: '12px',
                maxWidth: '280px',
              }}
              formatter={(value: number, name: string) => {
                if (name === 'totalValue') return [formatCurrency(value, currencyMode), 'Portfolio Total'];
                const meta = betMetas.find(m => m.id === name);
                if (meta) return [formatCurrency(value, currencyMode), meta.label];
                return [formatCurrency(value, currencyMode), name];
              }}
              labelFormatter={(label) => `Time: ${label}`}
            />
            {isStacked ? (
              betMetas.map((meta, idx) => (
                <Area
                  key={meta.id}
                  type="monotone"
                  dataKey={meta.id}
                  stackId="portfolio"
                  stroke={STACK_COLORS[idx % STACK_COLORS.length]}
                  strokeWidth={1.5}
                  fill={`url(#stackGrad_${meta.id})`}
                />
              ))
            ) : (
              <Area
                type="monotone"
                dataKey="totalValue"
                stroke={aggregateStrokeColor}
                strokeWidth={2}
                fill="url(#portfolioGradientAgg)"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>

        {/* Legend for stacked view */}
        {isStacked && betMetas.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {betMetas.map((meta, idx) => {
              const currentBetValue = chartData[chartData.length - 1]?.[meta.id] ?? 0;
              const betPl = currentBetValue - meta.stake;
              return (
                <div
                  key={meta.id}
                  className="flex items-center gap-1.5 text-xs bg-muted/50 rounded px-2 py-1"
                >
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: STACK_COLORS[idx % STACK_COLORS.length] }}
                  />
                  <span className="truncate max-w-[120px]" title={meta.label}>{meta.label}</span>
                  <span className={`font-medium ${betPl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {betPl >= 0 ? '+' : ''}{formatCurrency(betPl, currencyMode)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Summary row */}
        {!isStacked && (
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
        )}
      </CardContent>
    </Card>
  );
};

export default PortfolioOverviewChart;
