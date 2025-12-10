import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, TrendingUp, AlertTriangle, Cloud, Droplets, Thermometer, Snowflake, Wind, Droplet, Gauge, CloudFog, Loader2, Clock } from 'lucide-react';
import { useDuplicateBetPrevention } from '@/hooks/useDuplicateBetPrevention';
import { CITIES, City, TEMPERATURE_RANGES, RAINFALL_RANGES, WIND_RANGES, DEW_POINT_RANGES, PRESSURE_RANGES, CLOUD_COVERAGE_RANGES } from '@/types/supabase-betting';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@/types/supabase-betting';
import { z } from 'zod';
import { createCombinedBet } from '@/lib/supabase-combined-bets';
import { calculateDynamicOdds, calculateCategoryOdds } from '@/lib/dynamic-odds';
import WeatherDisplay from './WeatherDisplay';
import CategoryTimingInfo from './CategoryTimingInfo';
import TimeSlotSelector from './TimeSlotSelector';
import { formatCurrency } from '@/lib/currency';
import { useCurrencyMode } from '@/contexts/CurrencyModeContext';
import { DuplicateBetDialog } from './DuplicateBetDialog';
import { format } from 'date-fns';
import { BettingCategory, getCategoryTiming, getDefaultTimeSlot, getTimeSlot, hasMultipleTimeSlots } from '@/lib/betting-timing';

const getUserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const getNext7Days = () => {
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (let i = 1; i <= 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    days.push(date);
  }
  return days;
};

const getDeadlineForDay = (betDay: Date) => {
  const deadline = new Date(betDay);
  deadline.setDate(deadline.getDate() - 1);
  deadline.setHours(23, 59, 59, 999);
  return deadline;
};

// Dynamic schema that adjusts based on currency mode
const getCombinedBetSchema = (mode: 'real' | 'virtual') => z.object({
  city: z.string().min(1, 'Please select a city'),
  stake: mode === 'real' 
    ? z.number().min(100, 'Minimum stake is R1').max(10000, 'Maximum stake is R100')
    : z.number().min(10, 'Minimum stake is 10 points').max(1000, 'Maximum stake is 1000 points'),
  categories: z.array(z.string()).min(1, 'Select at least 1 category').max(5, 'Maximum 5 categories allowed')
});

interface CombinedBettingSlipProps {
  onBack: () => void;
  onBetPlaced: () => void;
}

interface CategorySelection {
  type: string;
  value: string;
  odds: number;
  timeSlotId?: string;
}

export function CombinedBettingSlip({ onBack, onBetPlaced }: CombinedBettingSlipProps) {
  const { mode } = useCurrencyMode();
  const [city, setCity] = useState<City>('New York');
  const [selectedDay, setSelectedDay] = useState<Date>(getNext7Days()[0]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categoryValues, setCategoryValues] = useState<Record<string, CategorySelection>>({});
  const [categoryTimeSlots, setCategoryTimeSlots] = useState<Record<string, string>>({});
  const [stake, setStake] = useState<number>(mode === 'real' ? 5000 : 50); // R50 = 5000 cents or 50 points
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const isPlacingBetRef = useRef(false);
  const { showDuplicateDialog, setShowDuplicateDialog, remainingCooldown, checkAndRecord } = useDuplicateBetPrevention();
  const [hasInsurance, setHasInsurance] = useState(false);
  const [weatherForecast, setWeatherForecast] = useState<any>(null);
  const [timezone] = useState(getUserTimezone());
  const { toast } = useToast();

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (city) {
      fetchWeatherForecast();
    }
  }, [city]);

  const loadUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error) throw error;
      setUser(data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchWeatherForecast = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-weather', {
        body: { city }
      });

      if (error) throw error;
      setWeatherForecast(data);
    } catch (error: any) {
      console.error('Error fetching weather:', error);
    }
  };

  const getDaysAhead = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const betDay = new Date(selectedDay);
    betDay.setHours(0, 0, 0, 0);
    return Math.floor((betDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const isDeadlinePassed = (day: Date) => {
    const deadline = getDeadlineForDay(day);
    return new Date() > deadline;
  };

  const handleCategoryToggle = (category: string) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories(prev => prev.filter(c => c !== category));
      const newValues = { ...categoryValues };
      delete newValues[category];
      setCategoryValues(newValues);
      // Clean up time slot selection
      const newTimeSlots = { ...categoryTimeSlots };
      delete newTimeSlots[category];
      setCategoryTimeSlots(newTimeSlots);
    } else {
      if (selectedCategories.length >= 5) {
        toast({
          title: "Maximum Reached",
          description: "You can select up to 5 categories per bet",
          variant: "destructive"
        });
        return;
      }
      setSelectedCategories(prev => [...prev, category]);
      // Initialize default time slot for this category
      const defaultSlot = getDefaultTimeSlot(category as BettingCategory);
      setCategoryTimeSlots(prev => ({ ...prev, [category]: defaultSlot.slotId }));
    }
  };

  const getTimeSlotMultiplier = (category: string): number => {
    const slotId = categoryTimeSlots[category];
    if (!slotId) return 1;
    const slot = getTimeSlot(category as BettingCategory, slotId);
    return slot?.oddsMultiplier || 1;
  };

  const getCategoryOddsWithSlot = (type: string, value: string): number => {
    const daysAhead = getDaysAhead();
    const timeSlotMultiplier = getTimeSlotMultiplier(type);
    
    if (type === 'rain' || type === 'snow') {
      if (weatherForecast) {
        const baseOdds = calculateDynamicOdds({
          predictionType: type as 'rain' | 'snow',
          predictionValue: value,
          forecast: weatherForecast,
          daysAhead
        });
        return parseFloat((baseOdds * timeSlotMultiplier).toFixed(2));
      }
      const baseOdds = value === 'yes' ? 2.5 : 2.0;
      return parseFloat((baseOdds * timeSlotMultiplier).toFixed(2));
    }

    if (type === 'temperature') {
      if (weatherForecast) {
        const baseOdds = calculateDynamicOdds({
          predictionType: type as 'temperature',
          predictionValue: value,
          forecast: weatherForecast,
          daysAhead
        });
        return parseFloat((baseOdds * timeSlotMultiplier).toFixed(2));
      }
      const tempRange = TEMPERATURE_RANGES.find(r => r.value === value);
      return parseFloat(((tempRange?.odds || 2.0) * timeSlotMultiplier).toFixed(2));
    }

    const baseOdds = calculateCategoryOdds(type as 'rainfall' | 'wind' | 'dew_point' | 'pressure' | 'cloud_coverage' | 'snow', value);
    return parseFloat((baseOdds * timeSlotMultiplier).toFixed(2));
  };

  const updateCategoryValue = (type: string, value: string) => {
    const odds = getCategoryOddsWithSlot(type, value);
    const timeSlotId = categoryTimeSlots[type];
    setCategoryValues(prev => ({
      ...prev,
      [type]: { type, value, odds, timeSlotId }
    }));
  };

  // Re-calculate odds when time slot changes
  const handleTimeSlotChange = (category: string, slotId: string) => {
    setCategoryTimeSlots(prev => ({ ...prev, [category]: slotId }));
    // Update odds if value already selected
    if (categoryValues[category]) {
      const newOdds = getCategoryOddsWithSlot(category, categoryValues[category].value);
      setCategoryValues(prev => ({
        ...prev,
        [category]: { ...prev[category], odds: newOdds, timeSlotId: slotId }
      }));
    }
  };

  const getCombinedOdds = (): number => {
    const validCategories = Object.values(categoryValues);
    if (validCategories.length === 0) return 1;
    return validCategories.reduce((total, cat) => total * cat.odds, 1);
  };

  const getInsuranceCost = (): number => {
    return hasInsurance ? Math.floor(stake * 0.2) : 0;
  };

  const getTotalCost = (): number => {
    return stake + getInsuranceCost();
  };

  const getPotentialWin = (): number => {
    return Math.floor(stake * getCombinedOdds());
  };

  const getRemainingBalance = () => {
    const userBalance = mode === 'real' ? user.balance_cents : user.points;
    return userBalance - getTotalCost();
  };

  const isLowBalanceWarning = () => {
    const remaining = getRemainingBalance();
    const threshold = mode === 'real' ? 1000 : 10; // R10 or 10 points
    return remaining >= 0 && remaining < threshold;
  };

  const canPlaceBet = (): boolean => {
    if (!user || placing || isDeadlinePassed(selectedDay)) return false;
    
    const validation = getCombinedBetSchema(mode).safeParse({
      city,
      stake,
      categories: selectedCategories
    });

    if (!validation.success) return false;
    if (Object.keys(categoryValues).length !== selectedCategories.length) return false;
    
    const userBalance = mode === 'real' ? user.balance_cents : user.points;
    if (getTotalCost() > userBalance) return false;

    return true;
  };

  const handlePlaceBet = async () => {
    // Prevent duplicate submissions using ref (synchronous check)
    if (isPlacingBetRef.current || placing || !canPlaceBet()) return;
    
    // Create a unique bet signature and check for duplicates
    const betSignature = `${city}|${Object.values(categoryValues).map(c => `${c.type}:${c.value}`).join('|')}|${stake}|${format(selectedDay, 'yyyy-MM-dd')}|${mode}`;
    if (!checkAndRecord(betSignature)) return;

    if (isDeadlinePassed(selectedDay)) {
      toast({
        title: "Deadline Passed",
        description: `The betting deadline for this day was ${getDeadlineForDay(selectedDay).toLocaleString()}`,
        variant: "destructive"
      });
      return;
    }

    try {
      isPlacingBetRef.current = true;
      setPlacing(true);

      const categories = Object.values(categoryValues).map(cat => ({
        predictionType: cat.type,
        predictionValue: cat.value,
        odds: cat.odds
      }));

      await createCombinedBet(city, stake, categories, selectedDay, hasInsurance, mode);

      toast({
        title: "Combined Bet Placed Successfully! 🎯",
        description: `${formatCurrency(stake, mode)} on ${city} • ${selectedCategories.length} categories • ${getCombinedOdds().toFixed(2)}x odds • Potential win: ${formatCurrency(getPotentialWin(), mode)}${hasInsurance ? ' (Insured)' : ''}`,
      });

      onBetPlaced();
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    } catch (error: any) {
      // Check if it's a duplicate combined bet error
      if (error?.message?.includes('wait a few seconds before placing another identical')) {
        setShowDuplicateDialog(true);
      } else {
        toast({
          title: "Error",
          description: error?.message || "Failed to place combined bet",
          variant: "destructive"
        });
      }
    } finally {
      setPlacing(false);
      isPlacingBetRef.current = false;
    }
  };

  if (loading || !user) {
    return <Card><CardContent className="p-6">Loading...</CardContent></Card>;
  }

  const availableDays = getNext7Days();
  const combinedOdds = getCombinedOdds();
  const deadlinePassed = isDeadlinePassed(selectedDay);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          <CardTitle>Combined Weather Bet</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Select multiple weather categories for the same city and date. <strong>All predictions must be correct to win!</strong> Combined odds multiply for bigger rewards.
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* User Balance */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <span className="text-sm text-muted-foreground">Available Balance</span>
          <span className="text-lg font-bold">{formatCurrency(mode === 'real' ? user.balance_cents : user.points, mode)}</span>
        </div>

        {/* Live Odds Indicator */}
        {weatherForecast && (
          <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Live Odds Active</span>
          </div>
        )}

        {/* Day Selection */}
        <div className="space-y-2">
          <Label>Select Target Day</Label>
          <Select
            value={selectedDay.toISOString()}
            onValueChange={(value) => setSelectedDay(new Date(value))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableDays.map(day => (
                <SelectItem key={day.toISOString()} value={day.toISOString()}>
                  {day.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Betting window closes: {getDeadlineForDay(selectedDay).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              timeZoneName: 'short'
            })}
          </p>
        </div>

        {/* City Selection */}
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Select value={city} onValueChange={(value) => setCity(value as City)}>
            <SelectTrigger id="city">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CITIES.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Weather Display */}
        <WeatherDisplay city={city} />

        {/* Category Selection */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base">Select Categories ({selectedCategories.length}/5)</Label>
            <span className="text-xs text-muted-foreground">Min: 1, Max: 5</span>
          </div>

          <div className="space-y-3">
            {/* Rain */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="rain"
                    checked={selectedCategories.includes('rain')}
                    onCheckedChange={() => handleCategoryToggle('rain')}
                  />
                  <Cloud className="h-4 w-4" />
                  <Label htmlFor="rain" className="cursor-pointer">Rain</Label>
                </div>
                <CategoryTimingInfo category="rain" slotId={categoryTimeSlots.rain} />
              </div>
              {selectedCategories.includes('rain') && (
                <>
                  {hasMultipleTimeSlots('rain') && (
                    <TimeSlotSelector
                      category="rain"
                      selectedSlotId={categoryTimeSlots.rain || ''}
                      onSlotChange={(slotId) => handleTimeSlotChange('rain', slotId)}
                    />
                  )}
                  <RadioGroup
                    value={categoryValues.rain?.value}
                    onValueChange={(value) => updateCategoryValue('rain', value)}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="rain-yes" />
                      <Label htmlFor="rain-yes">Yes ({getCategoryOddsWithSlot('rain', 'yes').toFixed(2)}x)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="rain-no" />
                      <Label htmlFor="rain-no">No ({getCategoryOddsWithSlot('rain', 'no').toFixed(2)}x)</Label>
                    </div>
                  </RadioGroup>
                </>
              )}
            </div>

            {/* Temperature */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="temperature"
                    checked={selectedCategories.includes('temperature')}
                    onCheckedChange={() => handleCategoryToggle('temperature')}
                  />
                  <Thermometer className="h-4 w-4" />
                  <Label htmlFor="temperature" className="cursor-pointer">Temperature Range</Label>
                </div>
                <CategoryTimingInfo category="temperature" slotId={categoryTimeSlots.temperature} />
              </div>
              {selectedCategories.includes('temperature') && (
                <>
                  {hasMultipleTimeSlots('temperature') && (
                    <TimeSlotSelector
                      category="temperature"
                      selectedSlotId={categoryTimeSlots.temperature || ''}
                      onSlotChange={(slotId) => handleTimeSlotChange('temperature', slotId)}
                    />
                  )}
                  <Select
                    value={categoryValues.temperature?.value}
                    onValueChange={(value) => updateCategoryValue('temperature', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPERATURE_RANGES.map(range => (
                        <SelectItem key={range.value} value={range.value}>
                          {range.label} ({getCategoryOddsWithSlot('temperature', range.value).toFixed(2)}x)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>

            {/* Rainfall */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="rainfall"
                    checked={selectedCategories.includes('rainfall')}
                    onCheckedChange={() => handleCategoryToggle('rainfall')}
                  />
                  <Droplets className="h-4 w-4" />
                  <Label htmlFor="rainfall" className="cursor-pointer flex-1">Rainfall Amount</Label>
                </div>
                <CategoryTimingInfo category="rainfall" slotId={categoryTimeSlots.rainfall} />
              </div>
              {selectedCategories.includes('rainfall') && (
                <>
                  {hasMultipleTimeSlots('rainfall') && (
                    <TimeSlotSelector
                      category="rainfall"
                      selectedSlotId={categoryTimeSlots.rainfall || ''}
                      onSlotChange={(slotId) => handleTimeSlotChange('rainfall', slotId)}
                    />
                  )}
                  <Select
                    value={categoryValues.rainfall?.value}
                    onValueChange={(value) => updateCategoryValue('rainfall', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      {RAINFALL_RANGES.map(range => (
                        <SelectItem key={range.value} value={range.value}>
                          {range.label} ({getCategoryOddsWithSlot('rainfall', range.value).toFixed(2)}x)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>

            {/* Snow */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="snow"
                    checked={selectedCategories.includes('snow')}
                    onCheckedChange={() => handleCategoryToggle('snow')}
                  />
                  <Snowflake className="h-4 w-4" />
                  <Label htmlFor="snow" className="cursor-pointer flex-1">Snow</Label>
                </div>
                <CategoryTimingInfo category="snow" slotId={categoryTimeSlots.snow} />
              </div>
              {selectedCategories.includes('snow') && (
                <RadioGroup
                  value={categoryValues.snow?.value}
                  onValueChange={(value) => updateCategoryValue('snow', value)}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="snow-yes" />
                    <Label htmlFor="snow-yes">Yes ({getCategoryOddsWithSlot('snow', 'yes').toFixed(2)}x)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="snow-no" />
                    <Label htmlFor="snow-no">No ({getCategoryOddsWithSlot('snow', 'no').toFixed(2)}x)</Label>
                  </div>
                </RadioGroup>
              )}
            </div>

            {/* Wind */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="wind"
                    checked={selectedCategories.includes('wind')}
                    onCheckedChange={() => handleCategoryToggle('wind')}
                  />
                  <Wind className="h-4 w-4" />
                  <Label htmlFor="wind" className="cursor-pointer flex-1">Wind Speed</Label>
                </div>
                <CategoryTimingInfo category="wind" slotId={categoryTimeSlots.wind} />
              </div>
              {selectedCategories.includes('wind') && (
                <>
                  {hasMultipleTimeSlots('wind') && (
                    <TimeSlotSelector
                      category="wind"
                      selectedSlotId={categoryTimeSlots.wind || ''}
                      onSlotChange={(slotId) => handleTimeSlotChange('wind', slotId)}
                    />
                  )}
                  <Select
                    value={categoryValues.wind?.value}
                    onValueChange={(value) => updateCategoryValue('wind', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      {WIND_RANGES.map(range => (
                        <SelectItem key={range.value} value={range.value}>
                          {range.label} ({getCategoryOddsWithSlot('wind', range.value).toFixed(2)}x)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>

            {/* Dew Point */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="dew_point"
                    checked={selectedCategories.includes('dew_point')}
                    onCheckedChange={() => handleCategoryToggle('dew_point')}
                  />
                  <Droplet className="h-4 w-4" />
                  <Label htmlFor="dew_point" className="cursor-pointer flex-1">Dew Point</Label>
                </div>
                <CategoryTimingInfo category="dew_point" slotId={categoryTimeSlots.dew_point} />
              </div>
              {selectedCategories.includes('dew_point') && (
                <>
                  {hasMultipleTimeSlots('dew_point') && (
                    <TimeSlotSelector
                      category="dew_point"
                      selectedSlotId={categoryTimeSlots.dew_point || ''}
                      onSlotChange={(slotId) => handleTimeSlotChange('dew_point', slotId)}
                    />
                  )}
                  <Select
                    value={categoryValues.dew_point?.value}
                    onValueChange={(value) => updateCategoryValue('dew_point', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEW_POINT_RANGES.map(range => (
                        <SelectItem key={range.value} value={range.value}>
                          {range.label} ({getCategoryOddsWithSlot('dew_point', range.value).toFixed(2)}x)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>

            {/* Pressure */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="pressure"
                    checked={selectedCategories.includes('pressure')}
                    onCheckedChange={() => handleCategoryToggle('pressure')}
                  />
                  <Gauge className="h-4 w-4" />
                  <Label htmlFor="pressure" className="cursor-pointer flex-1">Atmospheric Pressure</Label>
                </div>
                <CategoryTimingInfo category="pressure" slotId={categoryTimeSlots.pressure} />
              </div>
              {selectedCategories.includes('pressure') && (
                <>
                  {hasMultipleTimeSlots('pressure') && (
                    <TimeSlotSelector
                      category="pressure"
                      selectedSlotId={categoryTimeSlots.pressure || ''}
                      onSlotChange={(slotId) => handleTimeSlotChange('pressure', slotId)}
                    />
                  )}
                  <Select
                    value={categoryValues.pressure?.value}
                    onValueChange={(value) => updateCategoryValue('pressure', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRESSURE_RANGES.map(range => (
                        <SelectItem key={range.value} value={range.value}>
                          {range.label} ({getCategoryOddsWithSlot('pressure', range.value).toFixed(2)}x)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>

            {/* Cloud Coverage */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="cloud_coverage"
                    checked={selectedCategories.includes('cloud_coverage')}
                    onCheckedChange={() => handleCategoryToggle('cloud_coverage')}
                  />
                  <CloudFog className="h-4 w-4" />
                  <Label htmlFor="cloud_coverage" className="cursor-pointer flex-1">Cloud Coverage</Label>
                </div>
                <CategoryTimingInfo category="cloud_coverage" slotId={categoryTimeSlots.cloud_coverage} />
              </div>
              {selectedCategories.includes('cloud_coverage') && (
                <>
                  {hasMultipleTimeSlots('cloud_coverage') && (
                    <TimeSlotSelector
                      category="cloud_coverage"
                      selectedSlotId={categoryTimeSlots.cloud_coverage || ''}
                      onSlotChange={(slotId) => handleTimeSlotChange('cloud_coverage', slotId)}
                    />
                  )}
                  <Select
                    value={categoryValues.cloud_coverage?.value}
                    onValueChange={(value) => updateCategoryValue('cloud_coverage', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLOUD_COVERAGE_RANGES.map(range => (
                        <SelectItem key={range.value} value={range.value}>
                          {range.label} ({getCategoryOddsWithSlot('cloud_coverage', range.value).toFixed(2)}x)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Selected Categories Summary */}
        {selectedCategories.length > 0 && (
          <div className="space-y-2 p-4 bg-muted rounded-lg">
            <h4 className="font-semibold text-sm">Your Combined Bet:</h4>
            <div className="space-y-1">
              {Object.values(categoryValues).map((cat, i) => {
                const slotId = categoryTimeSlots[cat.type];
                const slot = slotId ? getTimeSlot(cat.type as BettingCategory, slotId) : null;
                return (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1">
                      ✓ {cat.type}: {cat.value}
                      {slot && (
                        <Badge variant="outline" className="text-xs ml-1">
                          {slot.label}
                        </Badge>
                      )}
                    </span>
                    <span className="font-mono">{cat.odds.toFixed(2)}x</span>
                  </div>
                );
              })}
            </div>
            <div className="pt-2 border-t border-border mt-2">
              <div className="flex items-center justify-between font-bold">
                <span>Combined Odds:</span>
                <span className="text-primary">{combinedOdds.toFixed(2)}x</span>
              </div>
            </div>
          </div>
        )}

        {/* Stake Input */}
        <div className="space-y-2">
          <Label htmlFor="stake">
            Stake Amount ({mode === 'real' ? 'R1-R100' : '10-1000 points'})
          </Label>
          <Input
            id="stake"
            type="number"
            min={mode === 'real' ? 100 : 10}
            max={mode === 'real' ? 10000 : 1000}
            step={mode === 'real' ? 100 : 1}
            value={stake}
            onChange={(e) => setStake(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">
            Min: {formatCurrency(10, mode)} - Max: {formatCurrency(1000, mode)}
          </p>
        </div>

        {/* Low Balance Warning */}
        {stake > 0 && isLowBalanceWarning() && (
          <Card className="border-2 border-yellow-500/50 bg-yellow-500/10">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-yellow-700 dark:text-yellow-400">
                    Low Balance Warning
                  </p>
                  <p className="text-sm text-yellow-600 dark:text-yellow-300 mt-1">
                    Your remaining balance will be {formatCurrency(getRemainingBalance(), mode)} after this bet.
                    Consider betting less to keep funds for future bets.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Insurance */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="space-y-1">
            <Label htmlFor="insurance">Bet Insurance</Label>
            <p className="text-xs text-muted-foreground">
              Get 80% of stake back if you lose (costs 20% of stake)
            </p>
          </div>
          <Switch
            id="insurance"
            checked={hasInsurance}
            onCheckedChange={setHasInsurance}
          />
        </div>

        {/* Warning */}
        {selectedCategories.length > 0 && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">All selections must win</p>
              <p className="text-xs text-muted-foreground">
                If any prediction is incorrect, the entire bet loses. Higher risk = higher reward!
              </p>
            </div>
          </div>
        )}

        {/* Bet Summary */}
        <div className="space-y-2 p-4 bg-primary/5 rounded-lg border border-primary/20">
          <div className="flex justify-between text-sm">
            <span>Stake:</span>
            <span className="font-mono">{formatCurrency(stake, mode)}</span>
          </div>
          {hasInsurance && (
            <div className="flex justify-between text-sm">
              <span>Insurance Cost:</span>
              <span className="font-mono text-destructive">-{formatCurrency(getInsuranceCost(), mode)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold border-t border-border pt-2">
            <span>Total Cost:</span>
            <span className="font-mono">{formatCurrency(getTotalCost(), mode)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Combined Odds:</span>
            <span className="font-mono text-primary">{combinedOdds.toFixed(2)}x</span>
          </div>
          <div className="flex justify-between font-bold text-lg border-t border-border pt-2">
            <span>Potential Win:</span>
            <span className="font-mono text-primary">{formatCurrency(getPotentialWin(), mode)}</span>
          </div>
        </div>

        {/* Place Bet Button */}
        <Button
          onClick={handlePlaceBet}
          disabled={!canPlaceBet() || placing}
          className="w-full"
          size="lg"
        >
          {placing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {deadlinePassed ? 'Deadline Passed' : placing ? 'Placing Bet...' : 'Place Combined Bet'}
        </Button>
      </CardContent>
    </Card>
    
    <DuplicateBetDialog 
      open={showDuplicateDialog} 
      onOpenChange={setShowDuplicateDialog}
      betType="combined"
      remainingSeconds={remainingCooldown}
    />
    </>
  );
}
