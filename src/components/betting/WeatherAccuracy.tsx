import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { CITIES, City } from '@/types/supabase-betting';
import { TrendingUp, Target, CheckCircle2, XCircle, Minus } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface AccuracyData {
  city: string;
  category: string;
  total_predictions: number;
  avg_accuracy: number;
  min_accuracy: number;
  max_accuracy: number;
  month: string;
}

interface AccuracyLog {
  id: string;
  city: string;
  category: string;
  predicted_value: string;
  actual_value: string;
  accuracy_score: number;
  target_date: string;
  metadata: any;
}

export const WeatherAccuracy = () => {
  const [selectedCity, setSelectedCity] = useState<City>('New York');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [summaryData, setSummaryData] = useState<AccuracyData[]>([]);
  const [recentLogs, setRecentLogs] = useState<AccuracyLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAccuracyData();
  }, [selectedCity, selectedCategory]);

  const fetchAccuracyData = async () => {
    setLoading(true);
    try {
      // Fetch summary data
      let summaryQuery = supabase
        .from('weather_accuracy_summary')
        .select('*')
        .eq('city', selectedCity)
        .order('month', { ascending: false })
        .limit(6);

      if (selectedCategory !== 'all') {
        summaryQuery = summaryQuery.eq('category', selectedCategory);
      }

      const { data: summary } = await summaryQuery;
      setSummaryData(summary || []);

      // Fetch recent logs
      let logsQuery = supabase
        .from('weather_accuracy_log')
        .select('*')
        .eq('city', selectedCity)
        .order('created_at', { ascending: false })
        .limit(10);

      if (selectedCategory !== 'all') {
        logsQuery = logsQuery.eq('category', selectedCategory);
      }

      const { data: logs } = await logsQuery;
      setRecentLogs(logs || []);
    } catch (error) {
      console.error('Error fetching accuracy data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAccuracyColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getAccuracyBadge = (score: number) => {
    if (score >= 80) return { variant: 'default' as const, icon: CheckCircle2, label: 'Excellent' };
    if (score >= 60) return { variant: 'secondary' as const, icon: Minus, label: 'Good' };
    return { variant: 'destructive' as const, icon: XCircle, label: 'Poor' };
  };

  const overallAccuracy = summaryData.length > 0
    ? summaryData.reduce((sum, d) => sum + d.avg_accuracy, 0) / summaryData.length
    : 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Target className="h-6 w-6" />
              Weather Prediction Accuracy
            </CardTitle>
            <CardDescription>
              Track how accurate weather forecasts are compared to actual outcomes
            </CardDescription>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${getAccuracyColor(overallAccuracy)}`}>
              {overallAccuracy.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">Overall Accuracy</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">City</label>
            <Select value={selectedCity} onValueChange={(value: City) => setSelectedCity(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CITIES.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Category</label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="rain">Rain</SelectItem>
                <SelectItem value="temperature">Temperature</SelectItem>
                <SelectItem value="rainfall">Rainfall</SelectItem>
                <SelectItem value="wind">Wind</SelectItem>
                <SelectItem value="snow">Snow</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading accuracy data...</div>
        ) : (
          <>
            {/* Summary Stats */}
            {summaryData.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Monthly Performance</h3>
                <div className="grid grid-cols-1 gap-4">
                  {summaryData.map((data, index) => {
                    const badge = getAccuracyBadge(data.avg_accuracy);
                    const BadgeIcon = badge.icon;
                    
                    return (
                      <div key={index} className="p-4 bg-card border rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium capitalize">{data.category}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(data.month).toLocaleDateString('en-US', { 
                                month: 'long', 
                                year: 'numeric' 
                              })}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={badge.variant} className="flex items-center gap-1">
                              <BadgeIcon className="h-3 w-3" />
                              {badge.label}
                            </Badge>
                            <span className={`text-xl font-bold ${getAccuracyColor(data.avg_accuracy)}`}>
                              {data.avg_accuracy}%
                            </span>
                          </div>
                        </div>
                        
                        <Progress value={data.avg_accuracy} className="h-2" />
                        
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{data.total_predictions} predictions</span>
                          <span>Range: {data.min_accuracy}% - {data.max_accuracy}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent Predictions */}
            {recentLogs.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Recent Predictions</h3>
                <div className="space-y-2">
                  {recentLogs.map((log) => (
                    <div key={log.id} className="p-3 bg-card border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium capitalize">{log.category}</span>
                            <Badge variant="outline" className="text-xs">
                              {new Date(log.target_date).toLocaleDateString()}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            Predicted: <span className="font-medium">{log.predicted_value}</span>
                            {' → '}
                            Actual: <span className="font-medium">{log.actual_value}</span>
                          </div>
                        </div>
                        <div className={`text-xl font-bold ${getAccuracyColor(log.accuracy_score)}`}>
                          {log.accuracy_score}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {summaryData.length === 0 && recentLogs.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No accuracy data available yet. Predictions will be tracked automatically as bets are resolved.
              </div>
            )}
          </>
        )}

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-4 border-t">
          <TrendingUp className="h-4 w-4" />
          <span>Accuracy scores are calculated when bets are resolved</span>
        </div>
      </CardContent>
    </Card>
  );
};
