import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, LineChart, Line } from 'recharts';
import { MapPin, TrendingUp, ArrowLeft, Target, Activity, Scale, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CITIES } from '@/types/supabase-betting';
import { calculateVolatilityMultiplier } from '@/lib/volatility-odds';

interface AccuracySummary {
  city: string;
  category: string;
  month: string;
  avg_accuracy: number;
  total_predictions: number;
  min_accuracy: number;
  max_accuracy: number;
}

interface CityStats {
  city: string;
  avgAccuracy: number;
  totalPredictions: number;
  volatilityBonus: number;
  categories: Record<string, { accuracy: number; predictions: number }>;
}

interface CityVolatilityComparisonProps {
  onBack?: () => void;
}

const CITY_COLORS: Record<string, string> = {
  'Cape Town': 'hsl(210, 100%, 50%)',
  'Johannesburg': 'hsl(45, 90%, 50%)',
  'Durban': 'hsl(160, 70%, 45%)',
  'Pretoria': 'hsl(280, 60%, 55%)',
  'Port Elizabeth': 'hsl(0, 70%, 55%)',
  'Bloemfontein': 'hsl(30, 80%, 50%)',
  'East London': 'hsl(180, 60%, 45%)',
  'Polokwane': 'hsl(330, 70%, 55%)',
};

const CATEGORIES = ['rain', 'temperature', 'rainfall', 'wind', 'cloud_coverage'];

export function CityVolatilityComparison({ onBack }: CityVolatilityComparisonProps) {
  const [data, setData] = useState<AccuracySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCities, setSelectedCities] = useState<string[]>(CITIES.slice(0, 3));
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

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

  const toggleCity = (city: string) => {
    setSelectedCities(prev => {
      if (prev.includes(city)) {
        return prev.filter(c => c !== city);
      }
      if (prev.length >= 5) {
        return [...prev.slice(1), city];
      }
      return [...prev, city];
    });
  };

  // Calculate stats for each city
  const cityStats = useMemo(() => {
    const stats: Record<string, CityStats> = {};
    
    data.forEach(item => {
      if (!selectedCities.includes(item.city)) return;
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return;
      
      if (!stats[item.city]) {
        stats[item.city] = {
          city: item.city,
          avgAccuracy: 0,
          totalPredictions: 0,
          volatilityBonus: 0,
          categories: {},
        };
      }
      
      const cityData = stats[item.city];
      const newTotal = cityData.avgAccuracy * cityData.totalPredictions + item.avg_accuracy * item.total_predictions;
      const newCount = cityData.totalPredictions + item.total_predictions;
      cityData.avgAccuracy = newTotal / newCount;
      cityData.totalPredictions = newCount;
      cityData.volatilityBonus = Math.round((calculateVolatilityMultiplier(cityData.avgAccuracy) - 1) * 100);
      
      // Track by category
      if (!cityData.categories[item.category]) {
        cityData.categories[item.category] = { accuracy: 0, predictions: 0 };
      }
      const catStats = cityData.categories[item.category];
      const catNewTotal = catStats.accuracy * catStats.predictions + item.avg_accuracy * item.total_predictions;
      const catNewCount = catStats.predictions + item.total_predictions;
      catStats.accuracy = catNewTotal / catNewCount;
      catStats.predictions = catNewCount;
    });
    
    return Object.values(stats).sort((a, b) => b.avgAccuracy - a.avgAccuracy);
  }, [data, selectedCities, selectedCategory]);

  // Bar chart data for side-by-side comparison
  const comparisonData = useMemo(() => {
    return cityStats.map(city => ({
      city: city.city,
      accuracy: Math.round(city.avgAccuracy * 10) / 10,
      volatility: city.volatilityBonus,
      predictions: city.totalPredictions,
    }));
  }, [cityStats]);

  // Radar data for category breakdown
  const radarData = useMemo(() => {
    const categories = new Set<string>();
    cityStats.forEach(city => {
      Object.keys(city.categories).forEach(cat => categories.add(cat));
    });
    
    return Array.from(categories).map(category => {
      const entry: Record<string, number | string> = {
        category: category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      };
      cityStats.forEach(city => {
        entry[city.city] = city.categories[category]?.accuracy || 0;
      });
      return entry;
    });
  }, [cityStats]);

  // Monthly trend data for line chart
  const trendData = useMemo(() => {
    const monthlyData: Record<string, Record<string, number>> = {};
    
    data.forEach(item => {
      if (!selectedCities.includes(item.city)) return;
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return;
      
      const month = item.month.substring(0, 7);
      if (!monthlyData[month]) {
        monthlyData[month] = {};
      }
      
      if (!monthlyData[month][item.city]) {
        monthlyData[month][item.city] = item.avg_accuracy;
      } else {
        monthlyData[month][item.city] = (monthlyData[month][item.city] + item.avg_accuracy) / 2;
      }
    });
    
    return Object.entries(monthlyData)
      .map(([month, cities]) => ({ month, ...cities }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [data, selectedCities, selectedCategory]);

  const formatMonth = (month: string) => {
    const date = new Date(month + '-01');
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex-1">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Scale className="h-7 w-7 text-primary" />
              City Volatility Comparison
            </h1>
            <p className="text-muted-foreground">Compare forecast accuracy and volatility bonuses across cities side by side</p>
          </div>
        </div>

        {/* City Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Select Cities to Compare (up to 5)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {CITIES.map(city => (
                <label
                  key={city}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                    selectedCities.includes(city)
                      ? 'bg-primary/10 border-primary'
                      : 'bg-muted/30 border-border hover:border-primary/50'
                  }`}
                >
                  <Checkbox
                    checked={selectedCities.includes(city)}
                    onCheckedChange={() => toggleCity(city)}
                  />
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: CITY_COLORS[city] || 'hsl(var(--primary))' }}
                  />
                  <span className="text-sm font-medium">{city}</span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-4">
              <span className="text-sm text-muted-foreground">Filter by category:</span>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-44">
                  <SelectValue />
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
          </CardContent>
        </Card>

        {selectedCities.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Select cities to compare</p>
              <p className="text-sm text-muted-foreground">Choose at least one city above to see the comparison</p>
            </CardContent>
          </Card>
        ) : cityStats.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No data available</p>
              <p className="text-sm text-muted-foreground">No accuracy data found for the selected cities</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {cityStats.map(city => (
                <Card key={city.city} className="relative overflow-hidden">
                  <div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{ backgroundColor: CITY_COLORS[city.city] || 'hsl(var(--primary))' }}
                  />
                  <CardContent className="pt-5">
                    <div className="text-center space-y-2">
                      <h3 className="font-semibold text-sm">{city.city}</h3>
                      <div className="text-3xl font-bold text-primary">
                        {city.avgAccuracy.toFixed(1)}%
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        +{city.volatilityBonus}% bonus
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {city.totalPredictions} predictions
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Side-by-Side Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Accuracy & Volatility Comparison
                </CardTitle>
                <CardDescription>
                  Compare forecast accuracy and odds bonuses across selected cities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={comparisonData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="city"
                      width={100}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === 'accuracy') return [`${value}%`, 'Accuracy'];
                        if (name === 'volatility') return [`+${value}%`, 'Volatility Bonus'];
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Bar dataKey="accuracy" name="Accuracy %" radius={[0, 4, 4, 0]}>
                      {comparisonData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CITY_COLORS[entry.city] || `hsl(${index * 45}, 70%, 50%)`}
                        />
                      ))}
                    </Bar>
                    <Bar dataKey="volatility" name="Volatility Bonus %" fill="hsl(35, 90%, 50%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Category Radar Chart */}
            {radarData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Category Performance by City
                  </CardTitle>
                  <CardDescription>
                    See how each city performs across different weather prediction categories
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {selectedCities.map(city => (
                      <Badge key={city} variant="outline" className="text-xs">
                        <span
                          className="w-2 h-2 rounded-full mr-1.5"
                          style={{ backgroundColor: CITY_COLORS[city] || 'hsl(var(--primary))' }}
                        />
                        {city}
                      </Badge>
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={350}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis
                        dataKey="category"
                        tick={{ fontSize: 11 }}
                        className="text-muted-foreground"
                      />
                      <PolarRadiusAxis
                        angle={30}
                        domain={[0, 100]}
                        tick={{ fontSize: 10 }}
                        className="text-muted-foreground"
                      />
                      {selectedCities.map(city => (
                        <Radar
                          key={city}
                          name={city}
                          dataKey={city}
                          stroke={CITY_COLORS[city] || 'hsl(var(--primary))'}
                          fill={CITY_COLORS[city] || 'hsl(var(--primary))'}
                          fillOpacity={0.15}
                          strokeWidth={2}
                        />
                      ))}
                      <Legend />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number) => [`${value.toFixed(1)}%`, 'Accuracy']}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Trend Over Time */}
            {trendData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Accuracy Trends Over Time
                  </CardTitle>
                  <CardDescription>
                    Track how prediction accuracy has changed month over month
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="month"
                        tickFormatter={formatMonth}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        labelFormatter={formatMonth}
                        formatter={(value: number) => [`${value.toFixed(1)}%`, 'Accuracy']}
                      />
                      <Legend />
                      {selectedCities.map(city => (
                        <Line
                          key={city}
                          type="monotone"
                          dataKey={city}
                          stroke={CITY_COLORS[city] || 'hsl(var(--primary))'}
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Insights */}
            <Card className="bg-muted/30">
              <CardContent className="pt-6">
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-4 bg-card rounded-lg border">
                    <h4 className="font-semibold text-sm mb-2">🏆 Most Accurate</h4>
                    <p className="text-2xl font-bold text-primary">
                      {cityStats[0]?.city || 'N/A'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {cityStats[0]?.avgAccuracy.toFixed(1)}% accuracy
                    </p>
                  </div>
                  <div className="p-4 bg-card rounded-lg border">
                    <h4 className="font-semibold text-sm mb-2">💰 Best Odds Bonus</h4>
                    <p className="text-2xl font-bold text-orange-500">
                      {cityStats.sort((a, b) => b.volatilityBonus - a.volatilityBonus)[0]?.city || 'N/A'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      +{cityStats.sort((a, b) => b.volatilityBonus - a.volatilityBonus)[0]?.volatilityBonus || 0}% bonus
                    </p>
                  </div>
                  <div className="p-4 bg-card rounded-lg border">
                    <h4 className="font-semibold text-sm mb-2">📊 Most Predictions</h4>
                    <p className="text-2xl font-bold text-primary">
                      {cityStats.sort((a, b) => b.totalPredictions - a.totalPredictions)[0]?.city || 'N/A'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {cityStats.sort((a, b) => b.totalPredictions - a.totalPredictions)[0]?.totalPredictions || 0} predictions
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
