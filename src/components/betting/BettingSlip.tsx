import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowLeft, Activity, Sparkles, Clock, Zap, Info, AlertTriangle, Loader2 } from 'lucide-react';
import { useDuplicateBetPrevention } from '@/hooks/useDuplicateBetPrevention';
import { getUser, addBet, updateUserPoints } from '@/lib/supabase-auth-storage';
import { CITIES, TEMPERATURE_RANGES, City, RAINFALL_RANGES, WIND_RANGES, DEW_POINT_RANGES, PRESSURE_RANGES, CLOUD_COVERAGE_RANGES } from '@/types/supabase-betting';
import { useToast } from '@/hooks/use-toast';
import WeatherDisplay from './WeatherDisplay';
import CategoryTimingInfo from './CategoryTimingInfo';
import TimeSlotSelector from './TimeSlotSelector';
import { useChallengeTracker } from '@/hooks/useChallengeTracker';
import { useAchievementTracker } from '@/hooks/useAchievementTracker';
import { useLevelSystem } from '@/hooks/useLevelSystem';
import { calculateDynamicOdds, formatLiveOdds, getProbabilityPercentage } from '@/lib/dynamic-odds';
import { supabase } from '@/integrations/supabase/client';
import { getActivePurchases, getActiveMultipliers, getMaxStakeBoost, PurchaseWithItem, useItem } from '@/lib/supabase-shop';
import { recordBonusEarning } from '@/lib/supabase-bonus-tracker';
import { z } from 'zod';
import { format, addDays, startOfDay, endOfDay, setHours, setMinutes, setSeconds } from 'date-fns';
import { useCurrencyMode } from '@/contexts/CurrencyModeContext';
import { formatCurrency } from '@/lib/currency';
import { DuplicateBetDialog } from './DuplicateBetDialog';
import { BettingCategory, getCategoryTiming, getDefaultTimeSlot, getTimeSlot, hasMultipleTimeSlots } from '@/lib/betting-timing';

// Get user's timezone
const getUserTimezone = () => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

// Get next 7 days (excluding today)
const getNext7Days = () => {
  const days = [];
  const today = startOfDay(new Date());
  for (let i = 1; i <= 7; i++) {
    days.push(addDays(today, i));
  }
  return days;
};

// Get deadline for a specific bet day (day before at 11:59 PM)
const getDeadlineForDay = (betDay: Date) => {
  const dayBefore = addDays(betDay, -1);
  return setSeconds(setMinutes(setHours(dayBefore, 23), 59), 59);
};

const betSchema = z.object({
  city: z.string().trim().min(1, 'City is required'),
  stake: z.number().int('Stake must be a whole number').min(10, 'Minimum stake is 10 points').max(100000, 'Maximum stake is 100,000 points'),
  predictionType: z.enum(['rain', 'temperature', 'rainfall', 'snow', 'wind', 'dew_point', 'pressure', 'cloud_coverage'] as const, { errorMap: () => ({ message: 'Invalid prediction type' }) }),
});

interface BettingSlipProps {
  onBack: () => void;
  onBetPlaced: () => void;
}

const BettingSlip = ({ onBack, onBetPlaced }: BettingSlipProps) => {
  const { mode } = useCurrencyMode();
  const [city, setCity] = useState<City | ''>('');
  const [predictionType, setPredictionType] = useState<'rain' | 'temperature' | 'rainfall' | 'snow' | 'wind' | 'dew_point' | 'pressure' | 'cloud_coverage' | ''>('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [rainPrediction, setRainPrediction] = useState<'yes' | 'no' | ''>('');
  const [snowPrediction, setSnowPrediction] = useState<'yes' | 'no' | ''>('');
  const [tempRange, setTempRange] = useState<string>('');
  const [rainfallRange, setRainfallRange] = useState<string>('');
  const [windRange, setWindRange] = useState<string>('');
  const [dewPointRange, setDewPointRange] = useState<string>('');
  const [pressureRange, setPressureRange] = useState<string>('');
  const [cloudCoverageRange, setCloudCoverageRange] = useState<string>('');
  const [stake, setStake] = useState<string>('');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const isPlacingBetRef = useRef(false);
  const { showDuplicateDialog, setShowDuplicateDialog, remainingCooldown, checkAndRecord } = useDuplicateBetPrevention();
  const [userTimezone] = useState(() => getUserTimezone());
  const [availableDays] = useState(() => getNext7Days());
  const [selectedDay, setSelectedDay] = useState<Date>(getNext7Days()[0]); // Default to tomorrow
  const [weatherForecast, setWeatherForecast] = useState<any[]>([]);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [hasInsurance, setHasInsurance] = useState(false);
  const [activePurchases, setActivePurchases] = useState<PurchaseWithItem[]>([]);
  const [activeMultiplier, setActiveMultiplier] = useState(1);
  const [maxStakeBoost, setMaxStakeBoost] = useState(0);
  const { toast } = useToast();
  const { checkAndUpdateChallenges } = useChallengeTracker();
  const { checkAchievements } = useAchievementTracker();
  const { awardXPForAction } = useLevelSystem();

  // Update selected time slot when prediction type changes
  useEffect(() => {
    if (predictionType) {
      const defaultSlot = getDefaultTimeSlot(predictionType as BettingCategory);
      setSelectedTimeSlot(defaultSlot.slotId);
    } else {
      setSelectedTimeSlot('');
    }
  }, [predictionType]);

  // Get the odds multiplier for the selected time slot
  const getTimeSlotOddsMultiplier = () => {
    if (!predictionType || !selectedTimeSlot) return 1;
    const slot = getTimeSlot(predictionType as BettingCategory, selectedTimeSlot);
    return slot?.oddsMultiplier || 1;
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await getUser();
        setUser(userData);
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };
    fetchUser();
  }, []);

  // Fetch active shop bonuses
  useEffect(() => {
    const fetchBonuses = async () => {
      try {
        const [purchases, multiplier, stakeBoost] = await Promise.all([
          getActivePurchases(),
          getActiveMultipliers(),
          getMaxStakeBoost(),
        ]);
        setActivePurchases(purchases);
        setActiveMultiplier(multiplier);
        setMaxStakeBoost(stakeBoost);
      } catch (error) {
        console.error('Error fetching bonuses:', error);
      }
    };
    fetchBonuses();
  }, []);

  // Fetch weather forecast when city changes
  useEffect(() => {
    const fetchWeather = async () => {
      if (!city) {
        setWeatherForecast([]);
        return;
      }

      setLoadingWeather(true);
      try {
        const { data, error } = await supabase.functions.invoke('get-weather', {
          body: { city },
        });

        if (error) throw error;
        if (data?.forecast) {
          setWeatherForecast(data.forecast);
        }
      } catch (error) {
        console.error('Error fetching weather:', error);
      } finally {
        setLoadingWeather(false);
      }
    };

    fetchWeather();
  }, [city]);

  const getDaysAhead = () => {
    const today = startOfDay(new Date());
    const daysDiff = Math.ceil((selectedDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff;
  };

  const getCurrentOdds = () => {
    if (!predictionType) return 0;
    
    let predictionValue = '';
    if (predictionType === 'rain') predictionValue = rainPrediction;
    else if (predictionType === 'temperature') predictionValue = tempRange;
    else if (predictionType === 'rainfall') predictionValue = rainfallRange;
    else if (predictionType === 'snow') predictionValue = snowPrediction;
    else if (predictionType === 'wind') predictionValue = windRange;
    else if (predictionType === 'dew_point') predictionValue = dewPointRange;
    else if (predictionType === 'pressure') predictionValue = pressureRange;
    else if (predictionType === 'cloud_coverage') predictionValue = cloudCoverageRange;
    
    if (!predictionValue) return 0;

    // Get time slot odds multiplier
    const timeSlotMultiplier = getTimeSlotOddsMultiplier();

    // Use dynamic odds if we have forecast data
    if (weatherForecast.length > 0) {
      const baseOdds = calculateDynamicOdds({
        predictionType,
        predictionValue,
        forecast: weatherForecast,
        daysAhead: getDaysAhead(),
      });
      return parseFloat((baseOdds * timeSlotMultiplier).toFixed(2));
    }

    // Fallback to static odds with time slot multiplier
    if (predictionType === 'rain') return parseFloat((2.0 * timeSlotMultiplier).toFixed(2));
    const range = TEMPERATURE_RANGES.find(r => r.value === tempRange);
    return parseFloat(((range?.odds || 2.0) * timeSlotMultiplier).toFixed(2));
  };

  const getCurrentProbability = () => {
    if (!predictionType || weatherForecast.length === 0) return null;
    
    const predictionValue = predictionType === 'rain' ? rainPrediction : tempRange;
    if (!predictionValue) return null;

    return getProbabilityPercentage(
      predictionType,
      predictionValue,
      weatherForecast,
      getDaysAhead()
    );
  };

  const getInsuranceCost = () => {
    const stakeNum = parseInt(stake) || 0;
    return Math.floor(stakeNum * 0.15); // 15% of stake
  };

  const getInsurancePayout = () => {
    const stakeNum = parseInt(stake) || 0;
    return Math.floor(stakeNum * 0.8); // Get back 80% of stake on loss
  };

  const getTotalCost = () => {
    const stakeNum = parseInt(stake) || 0;
    return hasInsurance ? stakeNum + getInsuranceCost() : stakeNum;
  };

  const getPotentialWin = () => {
    const stakeNum = parseInt(stake) || 0;
    const baseWin = Math.floor(stakeNum * getCurrentOdds());
    const multipliedWin = Math.floor(baseWin * activeMultiplier);
    return hasInsurance ? multipliedWin - getInsuranceCost() : multipliedWin;
  };

  const getBaseWin = () => {
    const stakeNum = parseInt(stake) || 0;
    return Math.floor(stakeNum * getCurrentOdds());
  };

  const getMaxStake = () => {
    // R100 = 10000 cents for real money, 100 points for virtual
    const baseMax = mode === 'real' ? 10000 : 100;
    return baseMax + (mode === 'real' ? maxStakeBoost * 100 : maxStakeBoost);
  };

  const getMinStake = () => {
    // R1 = 100 cents for real money, 10 points for virtual
    return mode === 'real' ? 100 : 10;
  };

  const getRemainingBalance = () => {
    const userBalance = mode === 'real' ? (user?.balance_cents || 0) : (user?.points || 0);
    return userBalance - getTotalCost();
  };

  const isLowBalanceWarning = () => {
    const remaining = getRemainingBalance();
    const threshold = mode === 'real' ? 1000 : 10; // R10 or 10 points
    return remaining >= 0 && remaining < threshold;
  };

  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const getBetDeadline = () => {
    return getDeadlineForDay(selectedDay).toISOString();
  };

  const isDeadlinePassed = (betDay: Date) => {
    const deadline = getDeadlineForDay(betDay);
    return new Date() > deadline;
  };

  const canPlaceBet = () => {
    // Check if deadline has passed
    if (isDeadlinePassed(selectedDay)) {
      return false;
    }
    
    const stakeNum = parseInt(stake) || 0;
    const totalCost = getTotalCost();
    const userBalance = mode === 'real' ? (user.balance_cents || 0) : user.points;
    
    // Get the prediction value based on type
    let predictionValue = '';
    if (predictionType === 'rain') predictionValue = rainPrediction;
    else if (predictionType === 'temperature') predictionValue = tempRange;
    else if (predictionType === 'rainfall') predictionValue = rainfallRange;
    else if (predictionType === 'snow') predictionValue = snowPrediction;
    else if (predictionType === 'wind') predictionValue = windRange;
    else if (predictionType === 'dew_point') predictionValue = dewPointRange;
    else if (predictionType === 'pressure') predictionValue = pressureRange;
    else if (predictionType === 'cloud_coverage') predictionValue = cloudCoverageRange;
    
    return (
      city &&
      predictionType &&
      predictionValue &&
      stakeNum >= 10 &&
      stakeNum <= getMaxStake() &&
      totalCost <= userBalance
    );
  };

  const handlePlaceBet = async () => {
    // Prevent duplicate submissions using ref (synchronous check)
    if (isPlacingBetRef.current || loading) return;
    
    // Get prediction value for duplicate check
    let predictionValue = '';
    if (predictionType === 'rain') predictionValue = rainPrediction;
    else if (predictionType === 'temperature') predictionValue = tempRange;
    else if (predictionType === 'rainfall') predictionValue = rainfallRange;
    else if (predictionType === 'snow') predictionValue = snowPrediction;
    else if (predictionType === 'wind') predictionValue = windRange;
    else if (predictionType === 'dew_point') predictionValue = dewPointRange;
    else if (predictionType === 'pressure') predictionValue = pressureRange;
    else if (predictionType === 'cloud_coverage') predictionValue = cloudCoverageRange;
    
    // Create a unique bet signature and check for duplicates
    const betSignature = `${city}|${predictionType}|${predictionValue}|${stake}|${format(selectedDay, 'yyyy-MM-dd')}|${mode}`;
    if (!checkAndRecord(betSignature)) return;
    
    isPlacingBetRef.current = true;
    setLoading(true);
    
    // Check if deadline has passed
    if (isDeadlinePassed(selectedDay)) {
      toast({
        title: 'Deadline Passed',
        description: `The betting deadline for ${format(selectedDay, 'EEEE, MMMM dd')} has already passed. Please select a different day.`,
        variant: 'destructive',
      });
      setLoading(false);
      isPlacingBetRef.current = false;
      return;
    }

    if (!canPlaceBet()) {
      setLoading(false);
      isPlacingBetRef.current = false;
      return;
    }

    // Validate inputs
    const validation = betSchema.safeParse({
      city,
      stake: parseInt(stake),
      predictionType,
    });

    if (!validation.success) {
      const errors = validation.error.flatten().fieldErrors;
      const errorMessage = Object.values(errors).flat()[0] || 'Invalid bet parameters';
      toast({
        title: 'Validation Error',
        description: errorMessage,
        variant: 'destructive',
      });
      setLoading(false);
      isPlacingBetRef.current = false;
      return;
    }

    // Validate city is in allowed list
    if (!CITIES.includes(city as City)) {
      toast({
        title: 'Invalid City',
        description: 'Please select a valid city from the list.',
        variant: 'destructive',
      });
      setLoading(false);
      isPlacingBetRef.current = false;
      return;
    }

    try {
      const stakeNum = parseInt(stake);
      
      // Get the prediction value based on type
      let predictionValue = '';
      if (predictionType === 'rain') predictionValue = rainPrediction;
      else if (predictionType === 'temperature') predictionValue = tempRange;
      else if (predictionType === 'rainfall') predictionValue = rainfallRange;
      else if (predictionType === 'snow') predictionValue = snowPrediction;
      else if (predictionType === 'wind') predictionValue = windRange;
      else if (predictionType === 'dew_point') predictionValue = dewPointRange;
      else if (predictionType === 'pressure') predictionValue = pressureRange;
      else if (predictionType === 'cloud_coverage') predictionValue = cloudCoverageRange;
      
      const totalCost = getTotalCost();
      const currencyType = mode === 'real' ? 'real' : 'virtual';

      // Add bet (target date is selected day, expires at deadline)
      // Note: create_bet_atomic handles both bet creation and points deduction atomically
      const betDeadline = getBetDeadline();
      const targetDateEnd = endOfDay(selectedDay);
      const betData = await addBet({
        city: city as City,
        prediction_type: predictionType as any,
        prediction_value: predictionValue as string,
        stake: stakeNum,
        odds: getCurrentOdds(),
        result: 'pending',
        target_date: targetDateEnd.toISOString(),
        expires_at: betDeadline,
        bet_duration_days: getDaysAhead(),
        has_insurance: hasInsurance,
        insurance_cost: hasInsurance ? getInsuranceCost() : 0,
        insurance_payout_percentage: 0.8,
        currency_type: mode,
      } as any);

      // Record bonus earnings if multiplier was applied
      if (activeMultiplier > 1) {
        const baseWin = getBaseWin();
        const totalWin = getPotentialWin();
        const bonusAmount = totalWin - baseWin;
        await recordBonusEarning(
          'multiplier',
          bonusAmount,
          baseWin,
          undefined,
          betData?.id
        );
        
        // Mark one-time multiplier items as used (those without expiration)
        const oneTimeMultipliers = activePurchases.filter(
          p => p.item.item_type === 'temp_multiplier' && !p.used && !p.expires_at
        );
        for (const purchase of oneTimeMultipliers) {
          await useItem(purchase.id);
        }
      }

      // Record bonus if stake boost was used
      const normalMaxStake = 100;
      if (stakeNum > normalMaxStake) {
        const boostAmount = stakeNum - normalMaxStake;
        await recordBonusEarning(
          'stake_boost',
          boostAmount,
          normalMaxStake,
          undefined,
          betData?.id
        );
        
        // Mark stake boost item as used (one-time use)
        const stakeBoostPurchase = activePurchases.find(p => p.item.item_type === 'stake_boost' && !p.used);
        if (stakeBoostPurchase) {
          await useItem(stakeBoostPurchase.id);
        }
      }

      // Mark insurance item as used if it was purchased
      if (hasInsurance) {
        const insurancePurchase = activePurchases.find(p => p.item.item_type === 'insurance' && !p.used);
        if (insurancePurchase) {
          await useItem(insurancePurchase.id);
        }
      }

      // Track challenge progress
      await checkAndUpdateChallenges('bet_placed', { 
        stake: stakeNum, 
        city: city as string 
      });

      // Check for newly unlocked achievements
      await checkAchievements();

      // Award XP for placing bet
      await awardXPForAction('BET_PLACED');

      toast({
        title: "Bet Placed Successfully! 🎯",
        description: `${formatCurrency(stakeNum, mode)} on ${city} • ${getCurrentOdds().toFixed(2)}x odds • Potential win: ${formatCurrency(getPotentialWin(), mode)}${hasInsurance ? ' (Insured)' : ''}`,
      });

      onBetPlaced();
      onBack();
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    } catch (error: any) {
      console.error('Error placing bet:', error);
      
      // Check if it's a duplicate bet error
      if (error?.message?.includes('wait a few seconds before placing another identical')) {
        setShowDuplicateDialog(true);
      } else {
        toast({
          title: "Error",
          description: error?.message || "Failed to place bet. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
      isPlacingBetRef.current = false;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Place Your Bet</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Betting Slip</CardTitle>
            <p className="text-muted-foreground">
              Available Balance: {formatCurrency(mode === 'real' ? (user.balance_cents || 0) : user.points, mode)}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Active Shop Bonuses */}
            {activePurchases.length > 0 && (
              <Card className="border-2 border-primary/30 bg-primary/5">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="font-semibold">Active Bonuses</span>
                  </div>
                  <div className="space-y-2">
                    {activePurchases.map((purchase) => (
                      <div key={purchase.id} className="flex items-center justify-between p-2 bg-background/50 rounded">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{purchase.item.item_icon}</span>
                          <div>
                            <p className="text-sm font-medium">{purchase.item.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {purchase.item.item_type === 'temp_multiplier' && `${purchase.item.item_value}x Multiplier`}
                              {purchase.item.item_type === 'stake_boost' && `+${purchase.item.item_value} Max Stake`}
                              {purchase.item.item_type === 'bonus_points' && `+${purchase.item.item_value} Points`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {purchase.expires_at ? (
                            <Badge variant="secondary" className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTimeRemaining(purchase.expires_at)}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Zap className="h-3 w-3" />
                              One-time
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Day Selection */}
            <div className="space-y-2">
              <Label htmlFor="day-select" className="text-base font-semibold">Select Bet Day</Label>
              <Select 
                value={selectedDay.toISOString()} 
                onValueChange={(value) => setSelectedDay(new Date(value))}
              >
                <SelectTrigger id="day-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableDays.map((day) => {
                    const deadline = getDeadlineForDay(day);
                    const isPassed = isDeadlinePassed(day);
                    return (
                      <SelectItem 
                        key={day.toISOString()} 
                        value={day.toISOString()}
                        disabled={isPassed}
                      >
                        <div className="flex items-center justify-between w-full gap-4">
                          <span className={isPassed ? 'text-muted-foreground line-through' : ''}>
                            {format(day, 'EEEE, MMM dd')}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {isPassed ? '(Expired)' : `Bet by: ${format(deadline, 'EEE')} 11:59 PM`}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Betting Window Info */}
            <Card className="border-2 border-primary/30 bg-primary/5">
              <CardContent className="pt-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Betting Window</span>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="text-xs cursor-help">
                            <Clock className="h-3 w-3 mr-1" />
                            {userTimezone}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>All times shown in your local timezone</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <Clock className="h-4 w-4 mt-0.5 text-primary" />
                      <div>
                        <p className="font-medium">Betting on: {format(selectedDay, 'EEEE, MMMM dd')}</p>
                        <p className="text-muted-foreground text-xs">
                          Predict weather for this day
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <Clock className="h-4 w-4 mt-0.5 text-destructive" />
                      <div>
                        <p className="font-medium">
                          Deadline: {format(getDeadlineForDay(selectedDay), 'EEEE')} at 11:59 PM
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Bets lock at: <strong>{format(getDeadlineForDay(selectedDay), 'PPp')}</strong>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      ✅ No cheating - you can't bet on weather you're experiencing<br />
                      ✅ True prediction - requires actual forecasting skill<br />
                      ✅ Daily engagement - come back each day for new bets
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Weather Display */}
            {city && <WeatherDisplay city={city} />}
            
            {/* City Selection */}
            <div className="space-y-2">
              <Label>Select City</Label>
              <Select value={city} onValueChange={(value) => setCity(value as City)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a city" />
                </SelectTrigger>
                <SelectContent>
                  {CITIES.map((cityName) => (
                    <SelectItem key={cityName} value={cityName}>
                      {cityName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Live Odds Indicator */}
            {city && weatherForecast.length > 0 && (
              <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg">
                <Activity className="h-4 w-4 text-primary animate-pulse" />
                <span className="text-sm font-medium">Live Odds Active</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  Based on current forecast
                </span>
              </div>
            )}

            {/* Prediction Type */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Prediction Type</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-xs cursor-help">
                        <Info className="h-3 w-3 mr-1" />
                        Smart Timing
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-semibold mb-1">⏱️ Smart Timing System</p>
                      <p className="text-xs">Each category is measured at its optimal time for accurate predictions. Click any category to see when it's measured.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <RadioGroup value={predictionType} onValueChange={(value) => setPredictionType(value as any)}>
                <div className="flex items-center justify-between space-x-2 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="rain" id="rain" />
                    <Label htmlFor="rain" className="cursor-pointer">🌧️ Rain (Yes/No)</Label>
                  </div>
                  <CategoryTimingInfo category="rain" />
                </div>
                <div className="flex items-center justify-between space-x-2 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="temperature" id="temperature" />
                    <Label htmlFor="temperature" className="cursor-pointer">🌡️ Temperature Range</Label>
                  </div>
                  <CategoryTimingInfo category="temperature" />
                </div>
                <div className="flex items-center justify-between space-x-2 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="rainfall" id="rainfall" />
                    <Label htmlFor="rainfall" className="cursor-pointer">💧 Rainfall Amount</Label>
                  </div>
                  <CategoryTimingInfo category="rainfall" />
                </div>
                <div className="flex items-center justify-between space-x-2 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="snow" id="snow" />
                    <Label htmlFor="snow" className="cursor-pointer">❄️ Snow (Yes/No)</Label>
                  </div>
                  <CategoryTimingInfo category="snow" />
                </div>
                <div className="flex items-center justify-between space-x-2 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="wind" id="wind" />
                    <Label htmlFor="wind" className="cursor-pointer">💨 Wind Speed</Label>
                  </div>
                  <CategoryTimingInfo category="wind" />
                </div>
                <div className="flex items-center justify-between space-x-2 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dew_point" id="dew_point" />
                    <Label htmlFor="dew_point" className="cursor-pointer">💦 Dew Point</Label>
                  </div>
                  <CategoryTimingInfo category="dew_point" />
                </div>
                <div className="flex items-center justify-between space-x-2 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pressure" id="pressure" />
                    <Label htmlFor="pressure" className="cursor-pointer">📊 Atmospheric Pressure</Label>
                  </div>
                  <CategoryTimingInfo category="pressure" />
                </div>
                <div className="flex items-center justify-between space-x-2 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cloud_coverage" id="cloud_coverage" />
                    <Label htmlFor="cloud_coverage" className="cursor-pointer">☁️ Cloud Coverage</Label>
                  </div>
                  <CategoryTimingInfo category="cloud_coverage" />
                </div>
              </RadioGroup>
            </div>

            {/* Time Slot Selection - for categories with multiple measurement times */}
            {predictionType && hasMultipleTimeSlots(predictionType as BettingCategory) && (
              <TimeSlotSelector
                category={predictionType as BettingCategory}
                selectedSlotId={selectedTimeSlot}
                onSlotChange={setSelectedTimeSlot}
              />
            )}

            {/* Selected Category Timing Details */}
            {predictionType && (
              <CategoryTimingInfo 
                category={predictionType as BettingCategory} 
                showFull 
                slotId={selectedTimeSlot}
              />
            )}

            {/* Rain Options */}
            {predictionType === 'rain' && (
              <div className="space-y-3">
                <Label>Will it rain?</Label>
                <RadioGroup value={rainPrediction} onValueChange={(value) => setRainPrediction(value as 'yes' | 'no')}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="rain-yes" />
                    <Label htmlFor="rain-yes">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="rain-no" />
                    <Label htmlFor="rain-no">No</Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            {/* Temperature Options */}
            {predictionType === 'temperature' && (
              <div className="space-y-2">
                <Label>Temperature Range</Label>
                <Select value={tempRange} onValueChange={setTempRange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose temperature range" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPERATURE_RANGES.map((range) => (
                      <SelectItem key={range.value} value={range.value}>
                        {range.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Rainfall Options */}
            {predictionType === 'rainfall' && (
              <div className="space-y-2">
                <Label>Rainfall Amount</Label>
                <Select value={rainfallRange} onValueChange={setRainfallRange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose rainfall range" />
                  </SelectTrigger>
                  <SelectContent>
                    {RAINFALL_RANGES.map((range) => (
                      <SelectItem key={range.value} value={range.value}>
                        {range.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Snow Options */}
            {predictionType === 'snow' && (
              <div className="space-y-3">
                <Label>Will it snow?</Label>
                <RadioGroup value={snowPrediction} onValueChange={(value) => setSnowPrediction(value as 'yes' | 'no')}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="snow-yes" />
                    <Label htmlFor="snow-yes">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="snow-no" />
                    <Label htmlFor="snow-no">No</Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            {/* Wind Options */}
            {predictionType === 'wind' && (
              <div className="space-y-2">
                <Label>Wind Speed Range</Label>
                <Select value={windRange} onValueChange={setWindRange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose wind speed range" />
                  </SelectTrigger>
                  <SelectContent>
                    {WIND_RANGES.map((range) => (
                      <SelectItem key={range.value} value={range.value}>
                        {range.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Dew Point Options */}
            {predictionType === 'dew_point' && (
              <div className="space-y-2">
                <Label>Dew Point Range</Label>
                <Select value={dewPointRange} onValueChange={setDewPointRange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose dew point range" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEW_POINT_RANGES.map((range) => (
                      <SelectItem key={range.value} value={range.value}>
                        {range.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Pressure Options */}
            {predictionType === 'pressure' && (
              <div className="space-y-2">
                <Label>Atmospheric Pressure Range</Label>
                <Select value={pressureRange} onValueChange={setPressureRange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose pressure range" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESSURE_RANGES.map((range) => (
                      <SelectItem key={range.value} value={range.value}>
                        {range.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Cloud Coverage Options */}
            {predictionType === 'cloud_coverage' && (
              <div className="space-y-2">
                <Label>Cloud Coverage Range</Label>
                <Select value={cloudCoverageRange} onValueChange={setCloudCoverageRange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose cloud coverage range" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLOUD_COVERAGE_RANGES.map((range) => (
                      <SelectItem key={range.value} value={range.value}>
                        {range.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Stake */}
            <div className="space-y-2">
              <Label>
                Stake ({mode === 'real' ? 'R1-R100' : `${getMinStake()}-${getMaxStake()} points`})
                {maxStakeBoost > 0 && (
                  <span className="ml-2 text-xs text-primary font-medium">
                    +{mode === 'real' ? `R${maxStakeBoost}` : `${maxStakeBoost} points`} from boost!
                  </span>
                )}
              </Label>
              <Input
                type="number"
                min={getMinStake()}
                max={getMaxStake()}
                step={mode === 'real' ? 100 : 1}
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                placeholder={mode === 'real' ? 'Enter stake (R1-R100)' : 'Enter stake amount'}
              />
            </div>

            {/* Low Balance Warning */}
            {stake && isLowBalanceWarning() && (
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

            {/* Bet Insurance */}
            {stake && parseInt(stake) >= 10 && (
              <Card className="border-2 border-primary/20">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="insurance"
                          checked={hasInsurance}
                          onChange={(e) => setHasInsurance(e.target.checked)}
                          className="h-4 w-4 rounded border-border"
                        />
                        <Label htmlFor="insurance" className="font-semibold cursor-pointer">
                          🛡️ Bet Insurance
                        </Label>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Protect your bet! If you lose, get back <span className="font-medium text-foreground">{formatCurrency(getInsurancePayout(), mode)}</span> (80% of stake)
                      </p>
                      <div className="flex items-center justify-between text-sm">
                        <span>Insurance Cost:</span>
                        <span className="font-medium">{formatCurrency(getInsuranceCost(), mode)} (15% of stake)</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Bet Summary */}
            {city && predictionType && (predictionType === 'rain' ? rainPrediction : tempRange) && stake && (
              <Card className="bg-muted">
                <CardContent className="pt-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>City:</span>
                      <span className="font-medium">{city}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Prediction:</span>
                      <span className="font-medium">
                        {predictionType === 'rain' 
                          ? `Rain: ${rainPrediction}` 
                          : `Temperature: ${TEMPERATURE_RANGES.find(r => r.value === tempRange)?.label}`
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Betting On:</span>
                      <span className="font-medium">
                        {format(selectedDay, 'EEEE (MMM d)')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Deadline:</span>
                      <span className="font-medium">
                        {format(getDeadlineForDay(selectedDay), 'EEE')} 11:59 PM
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Stake:</span>
                      <span className="font-medium">{formatCurrency(parseInt(stake), mode)}</span>
                    </div>
                    {hasInsurance && (
                      <>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Insurance:</span>
                          <span>+{formatCurrency(getInsuranceCost(), mode)}</span>
                        </div>
                        <div className="flex justify-between font-medium border-t pt-2">
                          <span>Total Cost:</span>
                          <span>{formatCurrency(getTotalCost(), mode)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between">
                      <span className="flex items-center gap-1">
                        Odds:
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <div className="space-y-2">
                                <p className="font-semibold">10% House Edge</p>
                                <p className="text-xs">Our odds include a 10% house edge, which is <strong>better than most betting sites</strong>:</p>
                                <ul className="text-xs space-y-1 list-disc list-inside">
                                  <li>Traditional sportsbooks: 5-15% edge</li>
                                  <li>Casino games: 2-25% edge</li>
                                  <li>Weather betting: 10% edge (transparent)</li>
                                </ul>
                                <p className="text-xs">This means for every 100 {mode === 'real' ? 'currency' : 'points'} wagered across all bets, the house keeps 10 {mode === 'real' ? 'currency' : 'points'} on average to maintain the platform.</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </span>
                      <span className="font-medium flex items-center gap-2">
                        {formatLiveOdds(getCurrentOdds())}
                        {weatherForecast.length > 0 && (
                          <span className="text-xs text-primary">LIVE</span>
                        )}
                      </span>
                    </div>
                    {getCurrentProbability() !== null && (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Win Probability:</span>
                        <span className="font-medium">{getCurrentProbability()}%</span>
                      </div>
                    )}
                    {activeMultiplier > 1 && (
                      <>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Base Win:</span>
                          <span>{formatCurrency(getBaseWin(), mode)}</span>
                        </div>
                        <div className="flex justify-between text-primary">
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            Multiplier ({activeMultiplier}x):
                          </span>
                          <span>+{formatCurrency(getPotentialWin() - getBaseWin(), mode)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between font-bold text-success">
                      <span>If Win:</span>
                      <span>+{formatCurrency(getPotentialWin(), mode)}</span>
                    </div>
                    {hasInsurance && (
                      <div className="flex justify-between font-bold text-primary">
                        <span>If Lose (Insured):</span>
                        <span>-{formatCurrency(parseInt(stake) - getInsurancePayout(), mode)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Place Bet Button */}
            <Button 
              className="w-full" 
              size="lg"
              onClick={handlePlaceBet}
              disabled={!canPlaceBet() || loading || isDeadlinePassed(selectedDay)}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isDeadlinePassed(selectedDay) 
                ? 'Deadline Passed' 
                : loading 
                  ? 'Placing Bet...' 
                  : 'Place Bet'
              }
            </Button>
          </CardContent>
        </Card>
      </div>
      
      <DuplicateBetDialog 
        open={showDuplicateDialog} 
        onOpenChange={setShowDuplicateDialog}
        betType="single"
        remainingSeconds={remainingCooldown}
      />
    </div>
  );
};

export default BettingSlip;