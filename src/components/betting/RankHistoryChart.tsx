import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp } from 'lucide-react';
import { getRankHistory, type RankHistoryEntry } from '@/lib/supabase-rank-history';
import { format } from 'date-fns';

interface RankHistoryChartProps {
  userId: string;
  username: string;
}

const RankHistoryChart = ({ userId, username }: RankHistoryChartProps) => {
  const [data, setData] = useState<RankHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortType, setSortType] = useState<string>('points');

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const history = await getRankHistory(userId, sortType, 30);
      setData(history);
      setLoading(false);
    };
    fetch();
  }, [userId, sortType]);

  const chartData = data.map((entry) => ({
    date: format(new Date(entry.recorded_at), 'MMM d'),
    rank: entry.rank,
    points: entry.points,
  }));

  // Invert rank axis so #1 is at top
  const maxRank = chartData.length > 0 ? Math.max(...chartData.map((d) => d.rank)) : 10;

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-primary" />
            Rank History
          </CardTitle>
          <Select value={sortType} onValueChange={setSortType}>
            <SelectTrigger className="w-[120px] h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="points">Points</SelectItem>
              <SelectItem value="followers">Followers</SelectItem>
              <SelectItem value="following">Following</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <Skeleton className="h-[160px] w-full rounded-md" />
        ) : chartData.length < 2 ? (
          <div className="h-[120px] flex items-center justify-center">
            <p className="text-xs text-muted-foreground text-center">
              Not enough data yet. Rank history is recorded each time the leaderboard is viewed.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                className="fill-muted-foreground"
                tickLine={false}
              />
              <YAxis
                reversed
                domain={[1, maxRank + 1]}
                tick={{ fontSize: 10 }}
                className="fill-muted-foreground"
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'hsl(var(--popover-foreground))',
                }}
                formatter={(value: number) => [`#${value}`, 'Rank']}
              />
              <Line
                type="monotone"
                dataKey="rank"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                activeDot={{ r: 5, fill: 'hsl(var(--primary))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default RankHistoryChart;
