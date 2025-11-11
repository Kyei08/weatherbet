import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { generateOddsHistory, generateParlayOddsHistory, OddsHistoryPoint } from '@/lib/odds-history';

interface OddsHistoryChartProps {
  city?: string;
  predictionType?: string;
  predictionValue?: string;
  createdAt: string;
  expiresAt?: string | null;
  currentOdds: number;
  isParlay?: boolean;
  parlayLegs?: Array<{
    city: string;
    prediction_type: string;
    prediction_value: string;
  }>;
  combinedOdds?: number;
}

const OddsHistoryChart = ({
  city,
  predictionType,
  predictionValue,
  createdAt,
  expiresAt,
  currentOdds,
  isParlay = false,
  parlayLegs = [],
  combinedOdds,
}: OddsHistoryChartProps) => {
  const [historyData, setHistoryData] = useState<OddsHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        let data: OddsHistoryPoint[];
        
        if (isParlay && parlayLegs.length > 0 && combinedOdds) {
          data = await generateParlayOddsHistory(
            parlayLegs,
            combinedOdds,
            createdAt,
            expiresAt
          );
        } else if (city && predictionType && predictionValue) {
          data = await generateOddsHistory(
            city,
            predictionType as 'rain' | 'temperature',
            predictionValue,
            createdAt,
            expiresAt
          );
        } else {
          data = [];
        }
        
        setHistoryData(data);
      } catch (error) {
        console.error('Error generating odds history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [city, predictionType, predictionValue, createdAt, expiresAt, isParlay, parlayLegs, combinedOdds]);

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
          Loading Odds History...
        </Button>
      </div>
    );
  }

  if (historyData.length === 0) {
    return null;
  }

  const startOdds = historyData[0].odds;
  const currentHistoricalOdds = historyData[historyData.length - 1].odds;
  const change = currentHistoricalOdds - startOdds;
  const changePercent = ((change / startOdds) * 100).toFixed(1);

  return (
    <div className="space-y-2 py-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-xs text-muted-foreground hover:text-foreground"
      >
        <TrendingUp className="h-3 w-3 mr-1" />
        Odds History
        <span className={`ml-2 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {change >= 0 ? '+' : ''}{change.toFixed(2)}x ({changePercent}%)
        </span>
        {isExpanded ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
      </Button>

      {isExpanded && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Odds Evolution Over Time</span>
              <span className="text-xs font-normal text-muted-foreground">
                Current: {currentOdds.toFixed(2)}x
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={historyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis 
                  dataKey="label" 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  stroke="hsl(var(--border))"
                />
                <YAxis 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  stroke="hsl(var(--border))"
                  domain={['auto', 'auto']}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === 'odds') return [`${value}x`, 'Odds'];
                    if (name === 'probability') return [`${value}%`, 'Win Probability'];
                    return [value, name];
                  }}
                  labelFormatter={(label) => `Time: ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="odds"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
            
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="bg-accent/10 rounded p-2">
                <p className="text-muted-foreground mb-1">Starting Odds</p>
                <p className="font-semibold text-primary">
                  {startOdds.toFixed(2)}x
                </p>
              </div>
              <div className="bg-accent/10 rounded p-2">
                <p className="text-muted-foreground mb-1">Current Probability</p>
                <p className="font-semibold text-accent-foreground">
                  {historyData[historyData.length - 1].probability.toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="mt-2 text-xs text-muted-foreground">
              <p>📊 Odds update based on weather forecast changes</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OddsHistoryChart;
