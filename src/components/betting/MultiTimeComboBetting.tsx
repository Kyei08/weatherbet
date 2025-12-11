import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, TrendingUp, AlertTriangle, Thermometer, Droplets, Wind, Droplet, Gauge, CloudFog, Loader2, Zap, Clock } from 'lucide-react';
import { useDuplicateBetPrevention } from '@/hooks/useDuplicateBetPrevention';
import { CITIES, City, TEMPERATURE_RANGES, RAINFALL_RANGES, WIND_RANGES, DEW_POINT_RANGES, PRESSURE_RANGES, CLOUD_COVERAGE_RANGES } from '@/types/supabase-betting';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@/types/supabase-betting';
import { createCombinedBet } from '@/lib/supabase-combined-bets';
import { calculateCategoryOdds } from '@/lib/dynamic-odds';
import WeatherDisplay from './WeatherDisplay';
import MultiTimeSlotSelector from './MultiTimeSlotSelector';
import { formatCurrency } from '@/lib/currency';
import { useCurrencyMode } from '@/contexts/CurrencyModeContext';
import { DuplicateBetDialog } from './DuplicateBetDialog';
import { format } from 'date-fns';
import { BettingCategory, getCategoryTimeSlots, getTimeSlot, hasMultipleTimeSlots } from '@/lib/betting-timing';

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

// Categories that support multi-time betting (those with multiple time slots)
const ALL_MULTI_TIME_CATEGORIES = [
  { value: 'temperature' as BettingCategory, label: 'Temperature', icon: <Thermometer className="h-4 w-4" />, ranges: TEMPERATURE_RANGES as unknown as { value: string; label: string; odds: number }[] },
  { value: 'rainfall' as BettingCategory, label: 'Rainfall Amount', icon: <Droplets className="h-4 w-4" />, ranges: RAINFALL_RANGES as unknown as { value: string; label: string; odds: number }[] },
  { value: 'wind' as BettingCategory, label: 'Wind Speed', icon: <Wind className="h-4 w-4" />, ranges: WIND_RANGES as unknown as { value: string; label: string; odds: number }[] },
  { value: 'dew_point' as BettingCategory, label: 'Dew Point', icon: <Droplet className="h-4 w-4" />, ranges: DEW_POINT_RANGES as unknown as { value: string; label: string; odds: number }[] },
  { value: 'pressure' as BettingCategory, label: 'Atmospheric Pressure', icon: <Gauge className="h-4 w-4" />, ranges: PRESSURE_RANGES as unknown as { value: string; label: string; odds: number }[] },
  { value: 'cloud_coverage' as BettingCategory, label: 'Cloud Coverage', icon: <CloudFog className="h-4 w-4" />, ranges: CLOUD_COVERAGE_RANGES as unknown as { value: string; label: string; odds: number }[] },
];

const MULTI_TIME_CATEGORIES = ALL_MULTI_TIME_CATEGORIES.filter(cat => hasMultipleTimeSlots(cat.value));

interface MultiTimeComboBettingProps {
  onBack: () => void;
  onBetPlaced: () => void;
}

export function MultiTimeComboBetting({ onBack, onBetPlaced }: MultiTimeComboBettingProps) {
  const { mode } = useCurrencyMode();
  const [city, setCity] = useState<City>('New York');
  const [selectedDay, setSelectedDay] = useState<Date>(getNext7Days()[0]);
  const [selectedCategory, setSelectedCategory] = useState<BettingCategory>('temperature');
  const [selectedValue, setSelectedValue] = useState<string>('');
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([]);
  const [stake, setStake] = useState<number>(mode === 'real' ? 5000 : 50);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const isPlacingBetRef = useRef(false);
  const { showDuplicateDialog, setShowDuplicateDialog, remainingCooldown, checkAndRecord } = useDuplicateBetPrevention();
  const [hasInsurance, setHasInsurance] = useState(false);
  const [weatherForecast, setWeatherForecast] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (city) {
      fetchWeatherForecast();
    }
  }, [city]);

  // Reset time slots when category changes
  useEffect(() => {
    setSelectedTimeSlots([]);
    setSelectedValue('');
  }, [selectedCategory]);

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

  const isDeadlinePassed = (day: Date) => {
    const deadline = getDeadlineForDay(day);
    return new Date() > deadline;
  };

  const getCurrentCategoryConfig = () => {
    return MULTI_TIME_CATEGORIES.find(c => c.value === selectedCategory);
  };

  const getBaseOdds = (): number => {
    if (!selectedValue) return 1;
    const categoryConfig = getCurrentCategoryConfig();
    const range = categoryConfig?.ranges.find(r => r.value === selectedValue);
    return range?.odds || 2.0;
  };

  const getTimeMultiplier = (): number => {
    if (selectedTimeSlots.length === 0) return 1;
    const timeSlots = getCategoryTimeSlots(selectedCategory);
    return selectedTimeSlots.reduce((acc, slotId) => {
      const slot = timeSlots.find(s => s.slotId === slotId);
      return acc * (slot?.oddsMultiplier || 1);
    }, 1);
  };

  const getCombinedOdds = (): number => {
    const baseOdds = getBaseOdds();
    const timeMultiplier = getTimeMultiplier();
    // For multi-time bets, we multiply base odds by time multiplier, then apply combo bonus
    const comboBonus = selectedTimeSlots.length >= 2 ? 1 + (selectedTimeSlots.length * 0.1) : 1;
    return parseFloat((baseOdds * timeMultiplier * comboBonus).toFixed(2));
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
    if (!user) return 0;
    const userBalance = mode === 'real' ? user.balance_cents : user.points;
    return userBalance - getTotalCost();
  };

  const isLowBalanceWarning = () => {
    const remaining = getRemainingBalance();
    const threshold = mode === 'real' ? 1000 : 10;
    return remaining >= 0 && remaining < threshold;
  };

  const canPlaceBet = (): boolean => {
    if (!user || placing || isDeadlinePassed(selectedDay)) return false;
    if (!selectedValue || selectedTimeSlots.length < 2) return false;
    
    const userBalance = mode === 'real' ? user.balance_cents : user.points;
    if (getTotalCost() > userBalance) return false;

    return true;
  };

  const handlePlaceBet = async () => {
    if (isPlacingBetRef.current || placing || !canPlaceBet()) return;
    
    const betSignature = `multitime|${city}|${selectedCategory}:${selectedValue}|${selectedTimeSlots.sort().join(',')}|${stake}|${format(selectedDay, 'yyyy-MM-dd')}|${mode}`;
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

      // Create a category entry for each time slot
      const categories = selectedTimeSlots.map(slotId => {
        const slot = getTimeSlot(selectedCategory, slotId);
        const slotOdds = getBaseOdds() * (slot?.oddsMultiplier || 1);
        return {
          predictionType: `${selectedCategory}_${slotId}`,
          predictionValue: selectedValue,
          odds: parseFloat(slotOdds.toFixed(2))
        };
      });

      await createCombinedBet(city, stake, categories, selectedDay, hasInsurance, mode);

      toast({
        title: "Multi-Time Combo Bet Placed! ⚡",
        description: `${formatCurrency(stake, mode)} on ${selectedCategory} across ${selectedTimeSlots.length} time slots • ${getCombinedOdds().toFixed(2)}x odds • Potential win: ${formatCurrency(getPotentialWin(), mode)}`,
      });

      onBetPlaced();
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    } catch (error: any) {
      if (error?.message?.includes('wait a few seconds before placing another identical')) {
        setShowDuplicateDialog(true);
      } else {
        toast({
          title: "Error",
          description: error?.message || "Failed to place multi-time combo bet",
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
  const categoryConfig = getCurrentCategoryConfig();

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <CardTitle>Multi-Time Combo Bet</CardTitle>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Bet on the <strong>same weather category</strong> at <strong>multiple times</strong> throughout the day. All time predictions must be correct to win!
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
          <div className="space-y-2">
            <Label>Weather Category</Label>
            <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as BettingCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MULTI_TIME_CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <div className="flex items-center gap-2">
                      {cat.icon}
                      <span>{cat.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Value Selection */}
          {categoryConfig && (
            <div className="space-y-2">
              <Label>Prediction Value</Label>
              <Select value={selectedValue} onValueChange={setSelectedValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your prediction" />
                </SelectTrigger>
                <SelectContent>
                  {categoryConfig.ranges.map(range => (
                    <SelectItem key={range.value} value={range.value}>
                      {range.label} ({range.odds.toFixed(2)}x base)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Multi Time Slot Selection */}
          {selectedValue && (
            <MultiTimeSlotSelector
              category={selectedCategory}
              selectedSlotIds={selectedTimeSlots}
              onSlotsChange={setSelectedTimeSlots}
            />
          )}

          {/* Selected Time Slots Summary */}
          {selectedTimeSlots.length >= 2 && selectedValue && (
            <div className="space-y-2 p-4 bg-muted rounded-lg">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Your Multi-Time Combo:
              </h4>
              <div className="space-y-1">
                {selectedTimeSlots.map((slotId) => {
                  const slot = getTimeSlot(selectedCategory, slotId);
                  const slotOdds = getBaseOdds() * (slot?.oddsMultiplier || 1);
                  return (
                    <div key={slotId} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        {slot?.icon} {slot?.label}: {selectedValue}
                      </span>
                      <span className="font-mono">{slotOdds.toFixed(2)}x</span>
                    </div>
                  );
                })}
              </div>
              <div className="pt-2 border-t border-border mt-2 space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>Combo Bonus ({selectedTimeSlots.length} times):</span>
                  <span className="text-primary">+{(selectedTimeSlots.length * 10)}%</span>
                </div>
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
          {selectedTimeSlots.length >= 2 && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">All time predictions must win</p>
                <p className="text-xs text-muted-foreground">
                  Your prediction must be correct at ALL selected times. Higher risk = higher reward!
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
            {deadlinePassed ? 'Deadline Passed' : 
             selectedTimeSlots.length < 2 ? 'Select at least 2 time slots' :
             placing ? 'Placing Bet...' : 'Place Multi-Time Combo Bet'}
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
