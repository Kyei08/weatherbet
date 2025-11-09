import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { generateCashOutHistory, generateParlayCashOutHistory, CashOutHistoryPoint } from '@/lib/cashout-history';

interface CashOutHistoryChartProps {
  stake: number;
  odds: number;
  city?: string;
  predictionType?: string;
  predictionValue?: string;
  createdAt: string;
  expiresAt?: string | null;
  isParlay?: boolean;
  parlayLegs?: Array<{
    city: string;
    prediction_type: string;
    prediction_value: string;
  }>;
  combinedOdds?: number;
  totalStake?: number;
}

const CashOutHistoryChart = ({
  stake,
  odds,
  city,
  predictionType,
  predictionValue,
  createdAt,
  expiresAt,
  isParlay = false,
  parlayLegs = [],
  combinedOdds,
  totalStake,
}: CashOutHistoryChartProps) => {
  const [historyData, setHistoryData] = useState<CashOutHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        let data: CashOutHistoryPoint[];
        
        if (isParlay && parlayLegs.length > 0 && combinedOdds && totalStake) {
          data = await generateParlayCashOutHistory(
            totalStake,
            combinedOdds,
            parlayLegs,
            createdAt,
            expiresAt
          );
        } else if (city && predictionType && predictionValue) {
          data = await generateCashOutHistory(
            stake,
            odds,
            city,
            predictionType,
            predictionValue,
            createdAt,
            expiresAt
          );
        } else {
          data = [];
        }
        
        setHistoryData(data);
      } catch (error) {
        console.error('Error generating cash-out history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [stake, odds, city, predictionType, predictionValue, createdAt, expiresAt, isParlay, parlayLegs, combinedOdds, totalStake]);

  if (loading) {
    return (
      <div className="space-y-2 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground"
          disabled
        >
          <TrendingUp className="h-3 w-3 mr-1" />
          Loading Cash-Out History...
        </Button>
      </div>
    );
  }

  if (historyData.length === 0) {
    return null;
  }

  const minAmount = Math.min(...historyData.map(d => d.amount));
  const maxAmount = Math.max(...historyData.map(d => d.amount));
  const currentAmount = historyData[historyData.length - 1].amount;
  const startAmount = historyData[0].amount;
  const change = currentAmount - startAmount;
  const changePercent = ((change / startAmount) * 100).toFixed(1);

  return (
    <div className="space-y-2 py-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-xs text-muted-foreground hover:text-foreground"
      >
        <TrendingUp className="h-3 w-3 mr-1" />
        Cash-Out History
        <span className={`ml-2 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {change >= 0 ? '+' : ''}{change} pts ({changePercent}%)
        </span>
        {isExpanded ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
      </Button>

      {isExpanded && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Cash-Out Value Over Time</span>
              <span className="text-xs font-normal text-muted-foreground">
                Range: {minAmount} - {maxAmount} pts
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={historyData}>
                <defs>
                  <linearGradient id="cashOutGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
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
                  domain={[minAmount * 0.95, maxAmount * 1.05]}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === 'amount') return [`${value} pts`, 'Cash-Out Value'];
                    return [value, name];
                  }}
                  labelFormatter={(label) => `Time: ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#cashOutGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
            
            {/* Bonus breakdown */}
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="bg-accent/10 rounded p-2">
                <p className="text-muted-foreground mb-1">Time Bonus</p>
                <p className="font-semibold text-primary">
                  {historyData[0].timeBonus}% → {historyData[historyData.length - 1].timeBonus}%
                </p>
              </div>
              <div className="bg-accent/10 rounded p-2">
                <p className="text-muted-foreground mb-1">Weather Bonus</p>
                <p className="font-semibold text-accent-foreground">
                  +{historyData[historyData.length - 1].weatherBonus}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CashOutHistoryChart;
