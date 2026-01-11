import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { TrendingUp, Activity, BarChart3, Target, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CITIES } from '@/types/supabase-betting';
import { calculateVolatilityMultiplier, VOLATILITY_CONFIG } from '@/lib/volatility-odds';

interface AccuracySummary {
  city: string;
  category: string;
  month: string;
  avg_accuracy: number;
  total_predictions: number;
  min_accuracy: number;
  max_accuracy: number;
}

interface VolatilityChartProps {
  defaultCity?: string;
  compact?: boolean;
}

const CATEGORIES = ['rain', 'temperature', 'rainfall', 'snow', 'wind', 'dew_point', 'pressure', 'cloud_coverage'];

const CATEGORY_COLORS: Record<string, string> = {
  rain: 'hsl(210, 100%, 50%)',
  temperature: 'hsl(0, 85%, 55%)',
  rainfall: 'hsl(200, 80%, 45%)',
  snow: 'hsl(190, 30%, 70%)',
  wind: 'hsl(160, 60%, 45%)',
  dew_point: 'hsl(280, 60%, 55%)',
  pressure: 'hsl(45, 80%, 50%)',
  cloud_coverage: 'hsl(220, 15%, 55%)',
};

export function VolatilityChart({ defaultCity, compact = false }: VolatilityChartProps) {
  const [selectedCity, setSelectedCity] = useState<string>(defaultCity || 'all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [data, setData] = useState<AccuracySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAccuracyData();
  }, []);

  const fetchAccuracyData = async () => {
    try {
      const { data: summaryData, error } = await supabase
        .from('weather_accuracy_summary')
        .select('*')
        .order('month', { ascending: true });

      if (error) throw error;
      setData(summaryData || []);
    } catch (error) {
      console.error('Error fetching accuracy data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter data based on selections
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const cityMatch = selectedCity === 'all' || item.city === selectedCity;
      const categoryMatch = selectedCategory === 'all' || item.category === selectedCategory;
      return cityMatch && categoryMatch;
    });
  }, [data, selectedCity, selectedCategory]);

  // Prepare data for accuracy over time chart
  const timeSeriesData = useMemo(() => {
    const groupedByMonth: Record<string, { month: string; [key: string]: number | string }> = {};
    
    filteredData.forEach(item => {
      const monthKey = item.month.substring(0, 7); // YYYY-MM format
      if (!groupedByMonth[monthKey]) {
        groupedByMonth[monthKey] = { month: monthKey };
      }
      
      const key = selectedCity === 'all' ? item.city : item.category;
      if (!groupedByMonth[monthKey][key]) {
        groupedByMonth[monthKey][key] = 0;
      }
      // Weight by predictions
      const currentValue = groupedByMonth[monthKey][key] as number;
      const currentCount = (groupedByMonth[monthKey][`${key}_count`] as number) || 0;
      const newTotal = currentValue * currentCount + item.avg_accuracy * item.total_predictions;
      const newCount = currentCount + item.total_predictions;
      groupedByMonth[monthKey][key] = newTotal / newCount;
      groupedByMonth[monthKey][`${key}_count`] = newCount;
    });
    
    return Object.values(groupedByMonth).sort((a, b) => 
      String(a.month).localeCompare(String(b.month))
    );
  }, [filteredData, selectedCity]);

  // Prepare data for city comparison bar chart
  const cityComparisonData = useMemo(() => {
    const cityStats: Record<string, { city: string; avgAccuracy: number; totalPredictions: number; volatilityBonus: number }> = {};
    
    filteredData.forEach(item => {
      if (!cityStats[item.city]) {
        cityStats[item.city] = { city: item.city, avgAccuracy: 0, totalPredictions: 0, volatilityBonus: 0 };
      }
      const stats = cityStats[item.city];
      const newTotal = stats.avgAccuracy * stats.totalPredictions + item.avg_accuracy * item.total_predictions;
      const newCount = stats.totalPredictions + item.total_predictions;
      stats.avgAccuracy = newTotal / newCount;
      stats.totalPredictions = newCount;
      stats.volatilityBonus = Math.round((calculateVolatilityMultiplier(stats.avgAccuracy) - 1) * 100);
    });
    
    return Object.values(cityStats).sort((a, b) => a.avgAccuracy - b.avgAccuracy);
  }, [filteredData]);

  // Prepare data for category radar chart
  const categoryRadarData = useMemo(() => {
    const categoryStats: Record<string, { category: string; accuracy: number; volatility: number; predictions: number }> = {};
    
    filteredData.forEach(item => {
      if (!categoryStats[item.category]) {
        categoryStats[item.category] = { category: item.category, accuracy: 0, volatility: 0, predictions: 0 };
      }
      const stats = categoryStats[item.category];
      const newTotal = stats.accuracy * stats.predictions + item.avg_accuracy * item.total_predictions;
      const newCount = stats.predictions + item.total_predictions;
      stats.accuracy = newTotal / newCount;
      stats.predictions = newCount;
      stats.volatility = Math.round((calculateVolatilityMultiplier(stats.accuracy) - 1) * 100);
    });
    
    return Object.values(categoryStats).map(stat => ({
      ...stat,
      category: stat.category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    }));
  }, [filteredData]);

  // Get unique lines for the time series chart
  const uniqueKeys = useMemo(() => {
    if (timeSeriesData.length === 0) return [];
    const keys = new Set<string>();
    timeSeriesData.forEach(item => {
      Object.keys(item).forEach(key => {
        if (key !== 'month' && !key.endsWith('_count')) {
          keys.add(key);
        }
      });
    });
    return Array.from(keys);
  }, [timeSeriesData]);

  const formatMonth = (month: string) => {
    const date = new Date(month + '-01');
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Activity className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No Accuracy Data Yet</p>
          <p className="text-sm text-muted-foreground mt-2">
            Volatility data will appear here once bets are resolved and accuracy is tracked.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Accuracy Overview
            </CardTitle>
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {CITIES.map(city => (
                  <SelectItem key={city} value={city}>{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={cityComparisonData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="city" tick={{ fontSize: 10 }} className="text-muted-foreground" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} className="text-muted-foreground" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                formatter={(value: number, name: string) => [
                  `${value.toFixed(1)}%`,
                  name === 'avgAccuracy' ? 'Accuracy' : name
                ]}
              />
              <Bar dataKey="avgAccuracy" name="Accuracy" radius={[4, 4, 0, 0]}>
                {cityComparisonData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.avgAccuracy >= 70 ? 'hsl(var(--primary))' : 
                          entry.avgAccuracy >= 50 ? 'hsl(45, 80%, 50%)' : 
                          'hsl(0, 70%, 55%)'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Volatility & Accuracy Analysis
          </CardTitle>
          <div className="flex gap-2">
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Select city" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {CITIES.map(city => (
                  <SelectItem key={city} value={city}>{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>
                    {cat.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Lower accuracy = higher volatility = better odds bonus. Track how prediction difficulty varies.
        </p>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="trends" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="trends" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Trends
            </TabsTrigger>
            <TabsTrigger value="cities" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Cities
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Categories
            </TabsTrigger>
          </TabsList>

          {/* Accuracy Trends Over Time */}
          <TabsContent value="trends" className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {uniqueKeys.slice(0, 6).map(key => (
                <Badge key={key} variant="outline" className="text-xs">
                  <span 
                    className="w-2 h-2 rounded-full mr-1.5" 
                    style={{ backgroundColor: CATEGORY_COLORS[key.toLowerCase()] || `hsl(${Math.random() * 360}, 70%, 50%)` }}
                  />
                  {key}
                </Badge>
              ))}
            </div>
            
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="month" 
                  tickFormatter={formatMonth}
                  className="text-muted-foreground"
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  domain={[0, 100]} 
                  className="text-muted-foreground"
                  tick={{ fontSize: 12 }}
                  label={{ value: 'Accuracy %', angle: -90, position: 'insideLeft', className: 'text-muted-foreground' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  labelFormatter={formatMonth}
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Accuracy']}
                />
                <Legend />
                {uniqueKeys.map((key, index) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={CATEGORY_COLORS[key.toLowerCase()] || `hsl(${index * 45}, 70%, 50%)`}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold text-primary">
                  {filteredData.reduce((sum, d) => sum + d.total_predictions, 0)}
                </p>
                <p className="text-xs text-muted-foreground">Total Predictions</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold text-primary">
                  {(filteredData.reduce((sum, d) => sum + d.avg_accuracy * d.total_predictions, 0) / 
                    Math.max(1, filteredData.reduce((sum, d) => sum + d.total_predictions, 0))).toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">Avg Accuracy</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold text-orange-500">
                  +{Math.round((calculateVolatilityMultiplier(
                    filteredData.reduce((sum, d) => sum + d.avg_accuracy * d.total_predictions, 0) / 
                    Math.max(1, filteredData.reduce((sum, d) => sum + d.total_predictions, 0))
                  ) - 1) * 100)}%
                </p>
                <p className="text-xs text-muted-foreground">Avg Volatility Bonus</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold text-primary">
                  {new Set(filteredData.map(d => d.city)).size}
                </p>
                <p className="text-xs text-muted-foreground">Cities Tracked</p>
              </div>
            </div>
          </TabsContent>

          {/* City Comparison */}
          <TabsContent value="cities" className="space-y-4">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={cityComparisonData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" domain={[0, 100]} className="text-muted-foreground" tick={{ fontSize: 12 }} />
                <YAxis 
                  type="category" 
                  dataKey="city" 
                  width={80}
                  className="text-muted-foreground"
                  tick={{ fontSize: 11 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === 'avgAccuracy') return [`${value.toFixed(1)}%`, 'Accuracy'];
                    if (name === 'volatilityBonus') return [`+${value}%`, 'Odds Bonus'];
                    if (name === 'totalPredictions') return [value, 'Predictions'];
                    return [value, name];
                  }}
                />
                <Legend />
                <Bar dataKey="avgAccuracy" name="Accuracy %" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="volatilityBonus" name="Volatility Bonus %" fill="hsl(35, 90%, 50%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            
            <div className="bg-muted/30 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">💡 Tip:</strong> Cities with lower historical accuracy offer higher volatility bonuses. 
                This reflects the increased difficulty in predicting weather for those locations.
              </p>
            </div>
          </TabsContent>

          {/* Category Analysis */}
          <TabsContent value="categories" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium mb-4">Category Accuracy Distribution</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={categoryRadarData}>
                    <PolarGrid className="stroke-muted" />
                    <PolarAngleAxis dataKey="category" className="text-muted-foreground" tick={{ fontSize: 10 }} />
                    <PolarRadiusAxis domain={[0, 100]} className="text-muted-foreground" tick={{ fontSize: 10 }} />
                    <Radar
                      name="Accuracy"
                      dataKey="accuracy"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.3}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [`${value.toFixed(1)}%`, 'Accuracy']}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              
              <div>
                <h4 className="text-sm font-medium mb-4">Volatility Bonus by Category</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={categoryRadarData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="category" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={60} className="text-muted-foreground" />
                    <YAxis className="text-muted-foreground" tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === 'accuracy') return [`${value.toFixed(1)}%`, 'Accuracy'];
                        if (name === 'volatility') return [`+${value}%`, 'Bonus'];
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Bar dataKey="accuracy" name="Accuracy %" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="volatility" name="Volatility Bonus %" fill="hsl(35, 90%, 50%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t">
              {categoryRadarData.slice(0, 4).map(cat => (
                <div key={cat.category} className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-lg font-bold" style={{ color: CATEGORY_COLORS[cat.category.toLowerCase().replace(' ', '_')] }}>
                    {cat.accuracy.toFixed(0)}%
                  </p>
                  <p className="text-xs text-muted-foreground">{cat.category}</p>
                  {cat.volatility > 0 && (
                    <Badge variant="secondary" className="text-xs mt-1">+{cat.volatility}%</Badge>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default VolatilityChart;
