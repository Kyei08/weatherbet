import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { getTimeDecayInfo, BETTING_CONFIG } from '@/lib/betting-config';
import { useVolatilityOdds } from '@/hooks/useVolatilityOdds';
import { getVolatilityInfo, VOLATILITY_CONFIG, preloadVolatilityData } from '@/lib/volatility-odds';
import { VolatilityBadge } from './VolatilityBadge';
import { DifficultyRating } from './DifficultyRating';
import TimeDecayChart from './TimeDecayChart';
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

  // Fetch volatility data for current city/category
  const { volatilityData } = useVolatilityOdds({
    city: city || '',
    category: predictionType || 'temperature',
    enabled: VOLATILITY_CONFIG.enabled && !!city && !!predictionType,
  });

  // Preload volatility data when city changes
  useEffect(() => {
    if (city && VOLATILITY_CONFIG.enabled) {
      const categories = ['rain', 'temperature', 'rainfall', 'snow', 'wind', 'dew_point', 'pressure', 'cloud_coverage'];
      preloadVolatilityData([city], categories);
    }
  }, [city]);

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
        city: city || undefined, // Pass city for volatility calculation
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
        time_slot_id: selectedTimeSlot || undefined,
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

  // Helper to get the current prediction value
  const getCurrentPredictionValue = (): string => {
    if (predictionType === 'rain') return rainPrediction;
    if (predictionType === 'temperature') return tempRange;
    if (predictionType === 'rainfall') return rainfallRange;
    if (predictionType === 'snow') return snowPrediction;
    if (predictionType === 'wind') return windRange;
    if (predictionType === 'dew_point') return dewPointRange;
    if (predictionType === 'pressure') return pressureRange;
    if (predictionType === 'cloud_coverage') return cloudCoverageRange;
    return '';
  };

  // Helper to get prediction display label
  const getPredictionLabel = (): string => {
    const value = getCurrentPredictionValue();
    if (!value) return '';
    if (predictionType === 'rain') return `Rain: ${value}`;
    if (predictionType === 'snow') return `Snow: ${value}`;
    if (predictionType === 'temperature') return `Temp: ${TEMPERATURE_RANGES.find(r => r.value === value)?.label || value}`;
    if (predictionType === 'rainfall') return `Rainfall: ${RAINFALL_RANGES.find(r => r.value === value)?.label || value}`;
    if (predictionType === 'wind') return `Wind: ${WIND_RANGES.find(r => r.value === value)?.label || value}`;
    if (predictionType === 'dew_point') return `Dew Point: ${DEW_POINT_RANGES.find(r => r.value === value)?.label || value}`;
    if (predictionType === 'pressure') return `Pressure: ${PRESSURE_RANGES.find(r => r.value === value)?.label || value}`;
    if (predictionType === 'cloud_coverage') return `Cloud: ${CLOUD_COVERAGE_RANGES.find(r => r.value === value)?.label || value}`;
    return value;
  };

  // City flag emojis
  const cityFlags: Record<string, string> = {
    'New York': '🇺🇸', 'Tokyo': '🇯🇵', 'London': '🇬🇧', 'Paris': '🇫🇷',
    'Sydney': '🇦🇺', 'Cape Town': '🇿🇦', 'Sao Paulo': '🇧🇷',
    'Mumbai': '🇮🇳', 'Cairo': '🇪🇬', 'Toronto': '🇨🇦',
  };

  // Category icons
  const categoryConfig = [
    { value: 'rain', label: 'Rain', icon: '🌧️', desc: 'Yes / No' },
    { value: 'temperature', label: 'Temp', icon: '🌡️', desc: 'Range' },
    { value: 'rainfall', label: 'Rainfall', icon: '💧', desc: 'Amount' },
    { value: 'snow', label: 'Snow', icon: '❄️', desc: 'Yes / No' },
    { value: 'wind', label: 'Wind', icon: '💨', desc: 'Speed' },
    { value: 'dew_point', label: 'Dew Pt', icon: '💦', desc: 'Range' },
    { value: 'pressure', label: 'Pressure', icon: '📊', desc: 'hPa' },
    { value: 'cloud_coverage', label: 'Clouds', icon: '☁️', desc: 'Coverage' },
  ];

  // Quick stake presets
  const stakePresets = mode === 'real'
    ? [{ label: 'R5', value: 500 }, { label: 'R10', value: 1000 }, { label: 'R25', value: 2500 }, { label: 'R50', value: 5000 }, { label: 'R100', value: 10000 }]
    : [{ label: '10', value: 10 }, { label: '25', value: 25 }, { label: '50', value: 50 }, { label: '75', value: 75 }, { label: '100', value: 100 }];

  // Progress steps
  const completedSteps = [
    !!city,
    !!predictionType && !!getCurrentPredictionValue(),
    !!stake && parseInt(stake) >= getMinStake(),
  ];
  const currentStep = completedSteps.filter(Boolean).length;

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="max-w-2xl mx-auto space-y-4"
      >
        {/* Header with balance */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Place Bet</h1>
              <p className="text-xs text-muted-foreground">
                {format(selectedDay, 'EEEE, MMM d')} • Closes {format(getDeadlineForDay(selectedDay), 'EEE')} 11:59 PM
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Balance</p>
            <p className="text-sm font-bold">{formatCurrency(mode === 'real' ? (user.balance_cents || 0) : user.points, mode)}</p>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex gap-1.5">
          {['City', 'Prediction', 'Stake'].map((step, i) => (
            <div key={step} className="flex-1 space-y-1">
              <div className={`h-1.5 rounded-full transition-colors ${completedSteps[i] ? 'bg-primary' : 'bg-muted'}`} />
              <p className={`text-[10px] text-center ${completedSteps[i] ? 'text-primary font-medium' : 'text-muted-foreground'}`}>{step}</p>
            </div>
          ))}
        </div>

        {/* Active Bonuses - compact */}
        {activePurchases.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {activePurchases.map((purchase) => (
              <Badge key={purchase.id} variant="secondary" className="gap-1 text-xs">
                <span>{purchase.item.item_icon}</span>
                {purchase.item.item_type === 'temp_multiplier' && `${purchase.item.item_value}x`}
                {purchase.item.item_type === 'stake_boost' && `+${purchase.item.item_value}`}
                {purchase.item.item_type === 'bonus_points' && `+${purchase.item.item_value}`}
                {purchase.expires_at && (
                  <span className="text-muted-foreground">• {formatTimeRemaining(purchase.expires_at)}</span>
                )}
              </Badge>
            ))}
          </div>
        )}

        {/* Day Selection - compact horizontal scroll */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.3 }}
          className="space-y-2"
        >
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Target Day</Label>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {availableDays.map((day) => {
              const isPassed = isDeadlinePassed(day);
              const isSelected = day.toISOString() === selectedDay.toISOString();
              return (
                <button
                  key={day.toISOString()}
                  disabled={isPassed}
                  onClick={() => setSelectedDay(day)}
                  className={`flex-shrink-0 px-3 py-2 rounded-lg border text-center transition-all text-xs
                    ${isSelected ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border hover:border-primary/50'}
                    ${isPassed ? 'opacity-40 cursor-not-allowed line-through' : 'cursor-pointer'}`}
                >
                  <div className="font-medium">{format(day, 'EEE')}</div>
                  <div className="text-muted-foreground">{format(day, 'MMM d')}</div>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* City Selection - visual grid */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="space-y-2"
        >
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">City</Label>
          <div className="grid grid-cols-5 gap-2">
            {CITIES.map((cityName) => {
              const isSelected = city === cityName;
              return (
                <motion.button
                  key={cityName}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setCity(cityName as City)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-center transition-all
                    ${isSelected ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border hover:border-primary/50 hover:bg-accent/30'}
                    cursor-pointer`}
                >
                  <span className="text-lg">{cityFlags[cityName] || '🌍'}</span>
                  <span className={`text-[10px] leading-tight ${isSelected ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                    {cityName.split(' ')[0]}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Weather Display - only if city selected */}
        {city && <WeatherDisplay city={city} />}

        {/* Live Odds Banner */}
        {city && weatherForecast.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 rounded-lg border border-primary/10">
            <Activity className="h-3.5 w-3.5 text-primary animate-pulse" />
            <span className="text-xs font-medium">Live Odds</span>
            {predictionType && volatilityData && volatilityData.volatilityMultiplier > 1 && (
              <VolatilityBadge city={city} category={predictionType} showDetails />
            )}
            {(() => {
              const daysAhead = getDaysAhead();
              const timeDecay = getTimeDecayInfo(daysAhead);
              return timeDecay.isActive ? (
                <Badge variant="secondary" className="text-[10px] h-5 bg-amber-500/15 text-amber-600 border-amber-500/20 ml-auto">
                  +{timeDecay.bonusPercentage}% Early 🕐
                </Badge>
              ) : null;
            })()}
          </div>
        )}

        {/* Prediction Type - compact grid */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">What to predict</Label>
          <div className="grid grid-cols-4 gap-2">
            {categoryConfig.map((cat) => {
              const isSelected = predictionType === cat.value;
              return (
                <button
                  key={cat.value}
                  onClick={() => setPredictionType(cat.value as any)}
                  className={`flex flex-col items-center gap-0.5 p-2.5 rounded-lg border text-center transition-all
                    ${isSelected ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border hover:border-primary/50 hover:bg-accent/30'}
                    cursor-pointer`}
                >
                  <span className="text-base">{cat.icon}</span>
                  <span className={`text-[10px] font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>{cat.label}</span>
                  <span className="text-[9px] text-muted-foreground">{cat.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Timing info for selected category */}
        {predictionType && (
          <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
            <CategoryTimingInfo category={predictionType as BettingCategory} slotId={selectedTimeSlot} />
            {hasMultipleTimeSlots(predictionType as BettingCategory) && (
              <Badge variant="outline" className="text-[10px] h-5">Multiple slots</Badge>
            )}
          </div>
        )}

        {/* Time Slot Selection */}
        {predictionType && hasMultipleTimeSlots(predictionType as BettingCategory) && (
          <TimeSlotSelector
            category={predictionType as BettingCategory}
            selectedSlotId={selectedTimeSlot}
            onSlotChange={setSelectedTimeSlot}
          />
        )}

        {/* Prediction Value Selection */}
        {predictionType === 'rain' && (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Will it rain?</Label>
            <div className="grid grid-cols-2 gap-3">
              {[{ value: 'yes', label: 'Yes 🌧️', desc: 'Rain expected' }, { value: 'no', label: 'No ☀️', desc: 'Stay dry' }].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRainPrediction(opt.value as 'yes' | 'no')}
                  className={`p-3 rounded-lg border text-center transition-all
                    ${rainPrediction === opt.value ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border hover:border-primary/50'}
                    cursor-pointer`}
                >
                  <p className="font-medium text-sm">{opt.label}</p>
                  <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {predictionType === 'snow' && (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Will it snow?</Label>
            <div className="grid grid-cols-2 gap-3">
              {[{ value: 'yes', label: 'Yes ❄️', desc: 'Snow expected' }, { value: 'no', label: 'No 🌤️', desc: 'No snow' }].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSnowPrediction(opt.value as 'yes' | 'no')}
                  className={`p-3 rounded-lg border text-center transition-all
                    ${snowPrediction === opt.value ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border hover:border-primary/50'}
                    cursor-pointer`}
                >
                  <p className="font-medium text-sm">{opt.label}</p>
                  <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {predictionType === 'temperature' && (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Temperature Range</Label>
            <div className="grid grid-cols-3 gap-2">
              {TEMPERATURE_RANGES.map((range) => (
                <button
                  key={range.value}
                  onClick={() => setTempRange(range.value)}
                  className={`p-3 rounded-lg border text-center transition-all
                    ${tempRange === range.value ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border hover:border-primary/50'}
                    cursor-pointer`}
                >
                  <p className="font-medium text-sm">{range.label}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {predictionType === 'rainfall' && (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rainfall Amount</Label>
            <div className="grid grid-cols-2 gap-2">
              {RAINFALL_RANGES.map((range) => (
                <button
                  key={range.value}
                  onClick={() => setRainfallRange(range.value)}
                  className={`p-3 rounded-lg border text-center transition-all
                    ${rainfallRange === range.value ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border hover:border-primary/50'}
                    cursor-pointer`}
                >
                  <p className="font-medium text-sm">{range.label}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {predictionType === 'wind' && (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Wind Speed</Label>
            <div className="grid grid-cols-2 gap-2">
              {WIND_RANGES.map((range) => (
                <button
                  key={range.value}
                  onClick={() => setWindRange(range.value)}
                  className={`p-3 rounded-lg border text-center transition-all
                    ${windRange === range.value ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border hover:border-primary/50'}
                    cursor-pointer`}
                >
                  <p className="font-medium text-sm">{range.label}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {predictionType === 'dew_point' && (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dew Point</Label>
            <div className="grid grid-cols-2 gap-2">
              {DEW_POINT_RANGES.map((range) => (
                <button
                  key={range.value}
                  onClick={() => setDewPointRange(range.value)}
                  className={`p-3 rounded-lg border text-center transition-all
                    ${dewPointRange === range.value ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border hover:border-primary/50'}
                    cursor-pointer`}
                >
                  <p className="font-medium text-sm">{range.label}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {predictionType === 'pressure' && (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pressure</Label>
            <div className="grid grid-cols-3 gap-2">
              {PRESSURE_RANGES.map((range) => (
                <button
                  key={range.value}
                  onClick={() => setPressureRange(range.value)}
                  className={`p-3 rounded-lg border text-center transition-all
                    ${pressureRange === range.value ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border hover:border-primary/50'}
                    cursor-pointer`}
                >
                  <p className="font-medium text-xs">{range.label}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {predictionType === 'cloud_coverage' && (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cloud Coverage</Label>
            <div className="grid grid-cols-2 gap-2">
              {CLOUD_COVERAGE_RANGES.map((range) => (
                <button
                  key={range.value}
                  onClick={() => setCloudCoverageRange(range.value)}
                  className={`p-3 rounded-lg border text-center transition-all
                    ${cloudCoverageRange === range.value ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border hover:border-primary/50'}
                    cursor-pointer`}
                >
                  <p className="font-medium text-sm">{range.label}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stake Input with quick-select */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Stake
              {maxStakeBoost > 0 && (
                <Badge variant="secondary" className="ml-2 text-[10px] h-4">
                  +{mode === 'real' ? `R${maxStakeBoost}` : maxStakeBoost} boost
                </Badge>
              )}
            </Label>
            <span className="text-[10px] text-muted-foreground">
              {mode === 'real' ? 'R1 – R100' : `${getMinStake()} – ${getMaxStake()} pts`}
            </span>
          </div>
          <div className="flex gap-2">
            {stakePresets.map((preset) => (
              <button
                key={preset.value}
                onClick={() => setStake(String(preset.value))}
                className={`flex-1 py-2 rounded-md border text-xs font-medium transition-all
                  ${parseInt(stake) === preset.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'}
                  cursor-pointer`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <Input
            type="number"
            min={getMinStake()}
            max={getMaxStake()}
            step={mode === 'real' ? 100 : 1}
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            placeholder={mode === 'real' ? 'Custom amount (cents)' : 'Custom amount'}
            className="text-center font-medium"
          />
        </div>

        {/* Time Decay Chart - collapsed into details */}
        {BETTING_CONFIG.timeDecay.enabled && predictionType && getCurrentPredictionValue() && (
          <details className="group">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Early bird bonus details
            </summary>
            <div className="mt-2">
              <TimeDecayChart
                currentDaysAhead={getDaysAhead()}
                baseOdds={getCurrentOdds() > 0 ? getCurrentOdds() / getTimeDecayInfo(getDaysAhead()).multiplier : 2.0}
              />
            </div>
          </details>
        )}

        {/* Difficulty Rating */}
        {city && predictionType && getCurrentPredictionValue() && weatherForecast.length > 0 && (
          <DifficultyRating
            city={city}
            predictionType={predictionType}
            predictionValue={getCurrentPredictionValue()}
            forecast={weatherForecast}
            daysAhead={getDaysAhead()}
            showDetails
          />
        )}

        {/* Low Balance Warning */}
        {stake && isLowBalanceWarning() && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20 text-xs">
            <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
            <span>Remaining balance: <strong>{formatCurrency(getRemainingBalance(), mode)}</strong></span>
          </div>
        )}

        {/* Insurance toggle - compact */}
        {stake && parseInt(stake) >= getMinStake() && (
          <div className="flex items-center justify-between p-3 rounded-lg border border-primary/20 bg-primary/5">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="insurance"
                checked={hasInsurance}
                onChange={(e) => setHasInsurance(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <Label htmlFor="insurance" className="cursor-pointer text-sm font-medium">
                🛡️ Insurance
              </Label>
              <span className="text-[10px] text-muted-foreground">
                80% back if you lose • costs 15%
              </span>
            </div>
            {hasInsurance && (
              <span className="text-xs font-medium text-primary">
                +{formatCurrency(getInsuranceCost(), mode)}
              </span>
            )}
          </div>
        )}

        {/* Bet Summary Card */}
        {city && predictionType && getCurrentPredictionValue() && stake && parseInt(stake) >= getMinStake() && (
          <Card className="border-2 border-primary/20 bg-gradient-to-b from-primary/5 to-transparent">
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">Bet Summary</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <span className="text-muted-foreground">City</span>
                <span className="font-medium text-right">{cityFlags[city]} {city}</span>
                
                <span className="text-muted-foreground">Prediction</span>
                <span className="font-medium text-right">{getPredictionLabel()}</span>
                
                <span className="text-muted-foreground">Target</span>
                <span className="font-medium text-right">{format(selectedDay, 'EEE, MMM d')}</span>
                
                <span className="text-muted-foreground">Deadline</span>
                <span className="font-medium text-right">{format(getDeadlineForDay(selectedDay), 'EEE')} 11:59 PM</span>
              </div>
              
              <div className="border-t border-border pt-2 mt-2 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Stake</span>
                  <span className="font-medium">{formatCurrency(parseInt(stake), mode)}</span>
                </div>
                {hasInsurance && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Insurance</span>
                    <span>+{formatCurrency(getInsuranceCost(), mode)}</span>
                  </div>
                )}
                {hasInsurance && (
                  <div className="flex justify-between text-xs font-medium">
                    <span>Total Cost</span>
                    <span>{formatCurrency(getTotalCost(), mode)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    Odds
                    {weatherForecast.length > 0 && (
                      <Badge variant="outline" className="text-[9px] h-4 px-1 text-primary border-primary/30">LIVE</Badge>
                    )}
                  </span>
                  <span className="font-bold text-sm">{formatLiveOdds(getCurrentOdds())}</span>
                </div>
                {getCurrentProbability() !== null && (
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Win probability</span>
                    <span>{getCurrentProbability()}%</span>
                  </div>
                )}
                {activeMultiplier > 1 && (
                  <div className="flex justify-between text-xs text-primary">
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      {activeMultiplier}x Multiplier
                    </span>
                    <span>+{formatCurrency(getPotentialWin() - getBaseWin(), mode)}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-3 mt-2 flex justify-between items-center">
                <span className="text-sm font-semibold text-success">Potential Win</span>
                <span className="text-lg font-bold text-success">+{formatCurrency(getPotentialWin(), mode)}</span>
              </div>
              {hasInsurance && (
                <div className="flex justify-between text-xs text-primary">
                  <span>If lose (insured)</span>
                  <span>-{formatCurrency(parseInt(stake) - getInsurancePayout(), mode)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Place Bet Button */}
        <Button 
          className="w-full text-base" 
          size="lg"
          onClick={handlePlaceBet}
          disabled={!canPlaceBet() || loading || isDeadlinePassed(selectedDay)}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isDeadlinePassed(selectedDay) 
            ? '⏰ Deadline Passed' 
            : loading 
              ? 'Placing Bet...' 
              : getCurrentOdds() > 0 
                ? `Place Bet • ${formatLiveOdds(getCurrentOdds())}x`
                : 'Place Bet'
          }
        </Button>
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