import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft, Plus, X, TrendingUp, Activity, AlertTriangle, Loader2 } from 'lucide-react';
import { useDuplicateBetPrevention } from '@/hooks/useDuplicateBetPrevention';
import { CITIES, TEMPERATURE_RANGES, RAINFALL_RANGES, WIND_RANGES, DEW_POINT_RANGES, PRESSURE_RANGES, CLOUD_COVERAGE_RANGES } from '@/types/betting';
import { createParlay, ParlayPrediction } from '@/lib/supabase-parlays';
import { getUser, updateUserPoints } from '@/lib/supabase-auth-storage';
import { useToast } from '@/hooks/use-toast';
import { useChallengeTracker } from '@/hooks/useChallengeTracker';
import { useAchievementTracker } from '@/hooks/useAchievementTracker';
import { useLevelSystem } from '@/hooks/useLevelSystem';
import { calculateDynamicOdds, formatLiveOdds, getProbabilityPercentage } from '@/lib/dynamic-odds';
import { getTimeDecayInfo } from '@/lib/betting-config';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { format, addDays, startOfDay, endOfDay, setHours, setMinutes, setSeconds } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/currency';
import { useCurrencyMode } from '@/contexts/CurrencyModeContext';
import { DuplicateBetDialog } from './DuplicateBetDialog';
import { DifficultyRating } from './DifficultyRating';
import { VolatilityBadge } from './VolatilityBadge';

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

const parlaySchema = z.object({
  stake: z.number().int('Stake must be a whole number').min(10, 'Minimum stake is 10 points').max(100000, 'Maximum stake is 100,000 points'),
  predictions: z.array(z.object({
    city: z.string().trim().min(1, 'City is required'),
    predictionType: z.enum(['rain', 'temperature', 'rainfall', 'snow', 'wind', 'dew_point', 'pressure', 'cloud_coverage'] as const),
  })).min(2, 'Parlay must have at least 2 predictions').max(5, 'Maximum 5 predictions per parlay'),
});

interface ParlayBettingSlipProps {
  onBack: () => void;
  onBetPlaced: () => void;
}

interface PredictionFormData {
  id: string;
  city: string;
  predictionType: 'rain' | 'temperature' | 'rainfall' | 'snow' | 'wind' | 'dew_point' | 'pressure' | 'cloud_coverage';
  rainPrediction: 'yes' | 'no';
  snowPrediction: 'yes' | 'no';
  temperatureRange: string;
  rainfallRange: string;
  windRange: string;
  dewPointRange: string;
  pressureRange: string;
  cloudCoverageRange: string;
}

const ParlayBettingSlip = ({ onBack, onBetPlaced }: ParlayBettingSlipProps) => {
  const { mode } = useCurrencyMode();
  const [predictions, setPredictions] = useState<PredictionFormData[]>([
    {
      id: crypto.randomUUID(),
      city: '',
      predictionType: 'rain',
      rainPrediction: 'yes',
      snowPrediction: 'no',
      temperatureRange: '20-25',
      rainfallRange: '0-5',
      windRange: '0-10',
      dewPointRange: '0-10',
      pressureRange: '1000-1020',
      cloudCoverageRange: '0-25',
    },
  ]);
  const [stake, setStake] = useState('');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const isPlacingBetRef = useRef(false);
  const { showDuplicateDialog, setShowDuplicateDialog, remainingCooldown, checkAndRecord } = useDuplicateBetPrevention();
  const [weatherForecasts, setWeatherForecasts] = useState<Record<string, any[]>>({});
  const [hasInsurance, setHasInsurance] = useState(false);
  const [userTimezone] = useState(() => getUserTimezone());
  const [availableDays] = useState(() => getNext7Days());
  const [selectedDay, setSelectedDay] = useState<Date>(getNext7Days()[0]); // Default to tomorrow
  const { toast } = useToast();
  const { checkAndUpdateChallenges } = useChallengeTracker();
  const { checkAchievements } = useAchievementTracker();
  const { awardXPForAction } = useLevelSystem();

  useEffect(() => {
    loadUser();
  }, []);

  // Fetch weather forecasts for all selected cities
  useEffect(() => {
    const fetchWeatherForCities = async () => {
      const citiesToFetch = predictions
        .map(p => p.city)
        .filter(city => city && !weatherForecasts[city]);

      if (citiesToFetch.length === 0) return;

      const newForecasts: Record<string, any[]> = { ...weatherForecasts };

      for (const city of citiesToFetch) {
        try {
          const { data, error } = await supabase.functions.invoke('get-weather', {
            body: { city },
          });

          if (!error && data?.forecast) {
            newForecasts[city] = data.forecast;
          }
        } catch (error) {
          console.error(`Error fetching weather for ${city}:`, error);
        }
      }

      setWeatherForecasts(newForecasts);
    };

    fetchWeatherForCities();
  }, [predictions.map(p => p.city).join(',')]);

  const loadUser = async () => {
    try {
      const userData = await getUser();
      setUser(userData);
    } catch (error) {
      console.error('Error loading user:', error);
      toast({
        title: 'Error',
        description: 'Failed to load user data',
        variant: 'destructive',
      });
    }
  };

  const getDaysAhead = () => {
    const today = startOfDay(new Date());
    const daysDiff = Math.ceil((selectedDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff;
  };

  const isDeadlinePassed = (betDay: Date) => {
    const deadline = getDeadlineForDay(betDay);
    return new Date() > deadline;
  };

  const addPrediction = () => {
    if (predictions.length >= 10) {
      toast({
        title: 'Maximum Reached',
        description: 'You can only add up to 10 predictions in a parlay',
        variant: 'destructive',
      });
      return;
    }

    setPredictions([
      ...predictions,
      {
        id: crypto.randomUUID(),
        city: '',
        predictionType: 'rain',
        rainPrediction: 'yes',
        snowPrediction: 'no',
        temperatureRange: '20-25',
        rainfallRange: '0-5',
        windRange: '0-10',
        dewPointRange: '0-10',
        pressureRange: '1000-1020',
        cloudCoverageRange: '0-25',
      },
    ]);
  };

  const removePrediction = (id: string) => {
    if (predictions.length <= 1) {
      toast({
        title: 'Cannot Remove',
        description: 'A parlay must have at least 2 predictions',
        variant: 'destructive',
      });
      return;
    }
    setPredictions(predictions.filter(p => p.id !== id));
  };

  const updatePrediction = (id: string, updates: Partial<PredictionFormData>) => {
    setPredictions(predictions.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const getPredictionOdds = (pred: PredictionFormData): number => {
    if (!pred.city) return 2.0;

    let predictionValue = '';
    if (pred.predictionType === 'rain') predictionValue = pred.rainPrediction;
    else if (pred.predictionType === 'temperature') predictionValue = pred.temperatureRange;
    else if (pred.predictionType === 'rainfall') predictionValue = pred.rainfallRange;
    else if (pred.predictionType === 'snow') predictionValue = pred.snowPrediction;
    else if (pred.predictionType === 'wind') predictionValue = pred.windRange;
    else if (pred.predictionType === 'dew_point') predictionValue = pred.dewPointRange;
    else if (pred.predictionType === 'pressure') predictionValue = pred.pressureRange;
    else if (pred.predictionType === 'cloud_coverage') predictionValue = pred.cloudCoverageRange;

    // Use dynamic odds if we have forecast data for this city
    const forecast = weatherForecasts[pred.city];
    if (forecast && forecast.length > 0) {
      const daysAhead = getDaysAhead();
      return calculateDynamicOdds({
        predictionType: pred.predictionType,
        predictionValue,
        forecast,
        daysAhead,
      });
    }

    // Fallback to static odds
    return 2.0;
  };

  const getCombinedOdds = (): number => {
    return predictions.reduce((total, pred) => {
      if (!pred.city) return total;
      return total * getPredictionOdds(pred);
    }, 1);
  };

  const getInsuranceCost = () => {
    const stakeNum = parseInt(stake) || 0;
    return Math.floor(stakeNum * 0.2); // 20% of stake for parlays (higher risk)
  };

  const getInsurancePayout = () => {
    const stakeNum = parseInt(stake) || 0;
    return Math.floor(stakeNum * 0.75); // Get back 75% of stake on loss
  };

  const getTotalCost = () => {
    const stakeNum = parseInt(stake) || 0;
    return hasInsurance ? stakeNum + getInsuranceCost() : stakeNum;
  };

  const getPotentialWin = (): number => {
    const stakeNum = parseInt(stake) || 0;
    const winAmount = Math.floor(stakeNum * getCombinedOdds());
    return hasInsurance ? winAmount - getInsuranceCost() : winAmount;
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

  const canPlaceParlay = (): boolean => {
    // Check if deadline has passed
    if (isDeadlinePassed(selectedDay)) {
      return false;
    }
    
    if (predictions.length < 2) return false;
    if (!predictions.every(p => p.city)) return false;
    
    const stakeNum = parseInt(stake);
    const totalCost = getTotalCost();
    const userBalance = mode === 'real' ? (user?.balance_cents || 0) : (user?.points || 0);
    const minStake = mode === 'real' ? 100 : 10; // R1 = 100 cents, 10 points
    if (!stakeNum || stakeNum < minStake || totalCost > userBalance) return false;
    
    // Check for duplicate city predictions
    const cities = predictions.map(p => p.city);
    const uniqueCities = new Set(cities);
    if (cities.length !== uniqueCities.size) return false;

    return true;
  };

  const handlePlaceParlay = async () => {
    // Prevent duplicate submissions using ref (synchronous check)
    if (isPlacingBetRef.current || loading) return;
    
    // Create a unique bet signature and check for duplicates
    const betSignature = predictions.map(p => 
      `${p.city}|${p.predictionType}|${p.rainPrediction || p.temperatureRange || p.rainfallRange || p.snowPrediction || p.windRange || p.dewPointRange || p.pressureRange || p.cloudCoverageRange}`
    ).join('||') + `|${stake}|${format(selectedDay, 'yyyy-MM-dd')}|${mode}`;
    
    if (!checkAndRecord(betSignature)) return;
    
    // Check if deadline has passed
    if (isDeadlinePassed(selectedDay)) {
      toast({
        title: 'Deadline Passed',
        description: `The betting deadline for ${format(selectedDay, 'EEEE, MMMM dd')} has already passed. Please select a different day.`,
        variant: 'destructive',
      });
      return;
    }

    if (!canPlaceParlay()) return;

    isPlacingBetRef.current = true;
    setLoading(true);

    // Validate inputs
    const validation = parlaySchema.safeParse({
      stake: parseInt(stake),
      predictions: predictions.map(p => ({ city: p.city, predictionType: p.predictionType })),
    });

    if (!validation.success) {
      const errors = validation.error.flatten().fieldErrors;
      const errorMessage = Object.values(errors).flat()[0] || 'Invalid parlay parameters';
      toast({
        title: 'Validation Error',
        description: errorMessage,
        variant: 'destructive',
      });
      setLoading(false);
      isPlacingBetRef.current = false;
      return;
    }

    // Validate all cities are in allowed list
    const invalidCity = predictions.find(p => !CITIES.includes(p.city as any));
    if (invalidCity) {
      toast({
        title: 'Invalid City',
        description: 'Please select valid cities from the list.',
        variant: 'destructive',
      });
      setLoading(false);
      isPlacingBetRef.current = false;
      return;
    }

    try {
      const stakeNum = parseInt(stake);
      const totalCost = getTotalCost();
      
      // Convert predictions to the format needed
      const parlayPredictions: ParlayPrediction[] = predictions.map(pred => {
        let predictionValue = '';
        if (pred.predictionType === 'rain') predictionValue = pred.rainPrediction;
        else if (pred.predictionType === 'temperature') predictionValue = pred.temperatureRange;
        else if (pred.predictionType === 'rainfall') predictionValue = pred.rainfallRange;
        else if (pred.predictionType === 'snow') predictionValue = pred.snowPrediction;
        else if (pred.predictionType === 'wind') predictionValue = pred.windRange;
        else if (pred.predictionType === 'dew_point') predictionValue = pred.dewPointRange;
        else if (pred.predictionType === 'pressure') predictionValue = pred.pressureRange;
        else if (pred.predictionType === 'cloud_coverage') predictionValue = pred.cloudCoverageRange;
        
        return {
          city: pred.city,
          predictionType: pred.predictionType,
          predictionValue,
          odds: getPredictionOdds(pred),
        };
      });

      // Create parlay with insurance and currency type
      const parlayId = await createParlay(stakeNum, parlayPredictions, getDaysAhead(), selectedDay, hasInsurance, mode);
      
      // Update parlay with insurance details if purchased
      if (hasInsurance) {
        const { supabase } = await import('@/integrations/supabase/client');
        await supabase
          .from('parlays')
          .update({
            has_insurance: true,
            insurance_cost: getInsuranceCost(),
            insurance_payout_percentage: 0.75,
          })
          .eq('id', parlayId);
      }

      // Track achievements and challenges
      await checkAndUpdateChallenges('bet_placed', { 
        stake: stakeNum, 
        city: predictions[0].city 
      });
      await checkAchievements();
      await awardXPForAction('BET_PLACED');

      toast({
        title: 'Parlay Placed Successfully! 🎯',
        description: `${formatCurrency(stakeNum, mode)} • ${predictions.length} legs • ${getCombinedOdds().toFixed(2)}x odds • Potential win: ${formatCurrency(getPotentialWin(), mode)}${hasInsurance ? ' (Insured)' : ''}`,
      });

      onBetPlaced();
      onBack();
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    } catch (error: any) {
      console.error('Error placing parlay:', error);
      
      // Check if it's a duplicate parlay error
      if (error?.message?.includes('wait a few seconds before placing another identical')) {
        setShowDuplicateDialog(true);
      } else {
        toast({
          title: 'Error',
          description: error?.message || 'Failed to place parlay',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
      isPlacingBetRef.current = false;
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <CardTitle className="text-xl">Parlay Bet</CardTitle>
            <div className="w-20" />
          </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-primary/10 p-4 rounded-lg">
          <p className="text-sm font-medium mb-2">💡 What's a Parlay?</p>
          <p className="text-sm text-muted-foreground">
            Combine 2-10 predictions for multiplied odds! All predictions must win for the parlay to pay out.
          </p>
        </div>

        {/* Live Odds Indicator */}
        {predictions.some(p => p.city && weatherForecasts[p.city]) && (
          <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
            <Activity className="h-4 w-4 text-primary animate-pulse" />
            <span className="text-sm font-medium">Live Odds Active</span>
            <div className="flex items-center gap-2 ml-auto">
              {(() => {
                const daysAhead = getDaysAhead();
                const timeDecay = getTimeDecayInfo(daysAhead);
                return timeDecay.isActive ? (
                  <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-600 border-amber-500/30">
                    +{timeDecay.bonusPercentage}% Early Bird 🕐
                  </Badge>
                ) : null;
              })()}
              {predictions[0]?.city && (
                <VolatilityBadge city={predictions[0].city} category={predictions[0].predictionType} />
              )}
            </div>
          </div>
        )}

        {/* Predictions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">
              Predictions ({predictions.length})
            </Label>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={addPrediction}
              disabled={predictions.length >= 10}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Leg
            </Button>
          </div>

          {predictions.map((pred, index) => (
            <Card key={pred.id} className="p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Leg {index + 1}</span>
                  {predictions.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removePrediction(pred.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div>
                  <Label>City</Label>
                  <Select 
                    value={pred.city} 
                    onValueChange={(value) => updatePrediction(pred.id, { city: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select city" />
                    </SelectTrigger>
                    <SelectContent>
                      {CITIES.map(city => (
                        <SelectItem key={city} value={city}>{city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Prediction Type</Label>
                  <RadioGroup
                    value={pred.predictionType}
                    onValueChange={(value) => 
                      updatePrediction(pred.id, { predictionType: value as any })
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="rain" id={`${pred.id}-rain`} />
                      <Label htmlFor={`${pred.id}-rain`}>Rain (Yes/No)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="temperature" id={`${pred.id}-temp`} />
                      <Label htmlFor={`${pred.id}-temp`}>Temperature</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="rainfall" id={`${pred.id}-rainfall`} />
                      <Label htmlFor={`${pred.id}-rainfall`}>Rainfall</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="snow" id={`${pred.id}-snow`} />
                      <Label htmlFor={`${pred.id}-snow`}>Snow (Yes/No)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="wind" id={`${pred.id}-wind`} />
                      <Label htmlFor={`${pred.id}-wind`}>Wind Speed</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="dew_point" id={`${pred.id}-dew`} />
                      <Label htmlFor={`${pred.id}-dew`}>Dew Point</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="pressure" id={`${pred.id}-pressure`} />
                      <Label htmlFor={`${pred.id}-pressure`}>Pressure</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="cloud_coverage" id={`${pred.id}-cloud`} />
                      <Label htmlFor={`${pred.id}-cloud`}>Cloud Coverage</Label>
                    </div>
                  </RadioGroup>
                </div>

                {pred.predictionType === 'rain' && (
                  <div>
                    <Label>Will it rain?</Label>
                    <RadioGroup
                      value={pred.rainPrediction}
                      onValueChange={(value) => 
                        updatePrediction(pred.id, { rainPrediction: value as 'yes' | 'no' })
                      }
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id={`${pred.id}-yes`} />
                        <Label htmlFor={`${pred.id}-yes`}>Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id={`${pred.id}-no`} />
                        <Label htmlFor={`${pred.id}-no`}>No</Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {pred.predictionType === 'temperature' && (
                  <div>
                    <Label>Temperature Range</Label>
                    <Select 
                      value={pred.temperatureRange}
                      onValueChange={(value) => 
                        updatePrediction(pred.id, { temperatureRange: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TEMPERATURE_RANGES.map(range => (
                          <SelectItem key={range.value} value={range.value}>
                            {range.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {pred.predictionType === 'rainfall' && (
                  <div>
                    <Label>Rainfall Amount</Label>
                    <Select 
                      value={pred.rainfallRange}
                      onValueChange={(value) => 
                        updatePrediction(pred.id, { rainfallRange: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RAINFALL_RANGES.map(range => (
                          <SelectItem key={range.value} value={range.value}>
                            {range.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {pred.predictionType === 'snow' && (
                  <div>
                    <Label>Will it snow?</Label>
                    <RadioGroup
                      value={pred.snowPrediction}
                      onValueChange={(value) => 
                        updatePrediction(pred.id, { snowPrediction: value as 'yes' | 'no' })
                      }
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id={`${pred.id}-snow-yes`} />
                        <Label htmlFor={`${pred.id}-snow-yes`}>Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id={`${pred.id}-snow-no`} />
                        <Label htmlFor={`${pred.id}-snow-no`}>No</Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {pred.predictionType === 'wind' && (
                  <div>
                    <Label>Wind Speed Range</Label>
                    <Select 
                      value={pred.windRange}
                      onValueChange={(value) => 
                        updatePrediction(pred.id, { windRange: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WIND_RANGES.map(range => (
                          <SelectItem key={range.value} value={range.value}>
                            {range.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {pred.predictionType === 'dew_point' && (
                  <div>
                    <Label>Dew Point Range</Label>
                    <Select 
                      value={pred.dewPointRange}
                      onValueChange={(value) => 
                        updatePrediction(pred.id, { dewPointRange: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEW_POINT_RANGES.map(range => (
                          <SelectItem key={range.value} value={range.value}>
                            {range.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {pred.predictionType === 'pressure' && (
                  <div>
                    <Label>Atmospheric Pressure Range</Label>
                    <Select 
                      value={pred.pressureRange}
                      onValueChange={(value) => 
                        updatePrediction(pred.id, { pressureRange: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRESSURE_RANGES.map(range => (
                          <SelectItem key={range.value} value={range.value}>
                            {range.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {pred.predictionType === 'cloud_coverage' && (
                  <div>
                    <Label>Cloud Coverage Range</Label>
                    <Select 
                      value={pred.cloudCoverageRange}
                      onValueChange={(value) => 
                        updatePrediction(pred.id, { cloudCoverageRange: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CLOUD_COVERAGE_RANGES.map(range => (
                          <SelectItem key={range.value} value={range.value}>
                            {range.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* Stake and Duration */}
        <div className="space-y-4">
          {/* Day Selection */}
          <div className="space-y-2">
            <Label htmlFor="parlay-day-select" className="text-base font-semibold">Select Bet Day</Label>
            <Select 
              value={selectedDay.toISOString()} 
              onValueChange={(value) => setSelectedDay(new Date(value))}
            >
              <SelectTrigger id="parlay-day-select">
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
        <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
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
              ⚡ All predictions must hit for the parlay to win!<br />
              ✅ True prediction skill required for each leg<br />
              ✅ Higher combined odds for bigger potential payouts
            </p>
          </div>
        </div>

        <div>
          <Label>Stake Amount ({mode === 'real' ? 'R1-R100' : '10-100 points'})</Label>
            <Input
              type="number"
              placeholder={mode === 'real' ? 'Enter stake (R1-R100)' : 'Minimum 10 points'}
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              min={mode === 'real' ? 100 : 10}
              max={mode === 'real' ? 10000 : 100}
              step={mode === 'real' ? 100 : 1}
            />
            <p className="text-sm text-muted-foreground mt-1">
              Available: {formatCurrency(mode === 'real' ? user.balance_cents : user.points, mode)}
            </p>
          </div>
        </div>

        {/* Low Balance Warning */}
        {stake && parseInt(stake) >= (mode === 'real' ? 100 : 10) && isLowBalanceWarning() && (
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
                      id="parlay-insurance"
                      checked={hasInsurance}
                      onChange={(e) => setHasInsurance(e.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <Label htmlFor="parlay-insurance" className="font-semibold cursor-pointer">
                      🛡️ Parlay Insurance
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Protect your parlay! If it loses, get back <span className="font-medium text-foreground">{formatCurrency(getInsurancePayout(), mode)}</span> (75% of stake)
                  </p>
                  <div className="flex items-center justify-between text-sm">
                    <span>Insurance Cost:</span>
                    <span className="font-medium">{formatCurrency(getInsuranceCost(), mode)} (20% of stake)</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Difficulty Rating */}
        {predictions[0]?.city && weatherForecasts[predictions[0].city] && (
          <DifficultyRating
            city={predictions[0].city}
            predictionType={predictions[0].predictionType}
            predictionValue={predictions[0].predictionType === 'rain' ? predictions[0].rainPrediction : 
                           predictions[0].predictionType === 'snow' ? predictions[0].snowPrediction :
                           predictions[0].predictionType === 'temperature' ? predictions[0].temperatureRange :
                           predictions[0].predictionType === 'rainfall' ? predictions[0].rainfallRange :
                           predictions[0].predictionType === 'wind' ? predictions[0].windRange :
                           predictions[0].predictionType === 'dew_point' ? predictions[0].dewPointRange :
                           predictions[0].predictionType === 'pressure' ? predictions[0].pressureRange :
                           predictions[0].cloudCoverageRange}
            daysAhead={getDaysAhead()}
            forecast={weatherForecasts[predictions[0].city]}
            showDetails
          />
        )}

        {/* Summary */}
        {predictions.every(p => p.city) && stake && (
          <div className="bg-gradient-primary/10 p-4 rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-medium">Combined Odds:</span>
              <span className="text-lg font-bold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                {formatLiveOdds(getCombinedOdds())}
                {predictions.some(p => p.city && weatherForecasts[p.city]) && (
                  <span className="text-xs text-primary">LIVE</span>
                )}
                {predictions[0]?.city && weatherForecasts[predictions[0].city] && (
                  <DifficultyRating
                    city={predictions[0].city}
                    predictionType={predictions[0].predictionType}
                    predictionValue={predictions[0].predictionType === 'rain' ? predictions[0].rainPrediction : 
                                   predictions[0].predictionType === 'snow' ? predictions[0].snowPrediction :
                                   predictions[0].predictionType === 'temperature' ? predictions[0].temperatureRange :
                                   predictions[0].predictionType === 'rainfall' ? predictions[0].rainfallRange :
                                   predictions[0].predictionType === 'wind' ? predictions[0].windRange :
                                   predictions[0].predictionType === 'dew_point' ? predictions[0].dewPointRange :
                                   predictions[0].predictionType === 'pressure' ? predictions[0].pressureRange :
                                   predictions[0].cloudCoverageRange}
                    daysAhead={getDaysAhead()}
                    forecast={weatherForecasts[predictions[0].city]}
                  />
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Stake:</span>
              <span className="font-medium">{formatCurrency(parseInt(stake) || 0, mode)}</span>
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
            <div className="flex justify-between text-lg font-bold text-success">
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
        )}

        {predictions.length < 2 && (
          <p className="text-sm text-destructive text-center">
            Add at least 2 predictions to create a parlay
          </p>
        )}

        {predictions.map(p => p.city).filter((c, i, arr) => arr.indexOf(c) !== i).length > 0 && (
          <p className="text-sm text-destructive text-center">
            Each prediction must be for a different city
          </p>
        )}

        <Button
          className="w-full"
          onClick={handlePlaceParlay}
          disabled={!canPlaceParlay() || loading || isDeadlinePassed(selectedDay)}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isDeadlinePassed(selectedDay)
            ? 'Deadline Passed'
            : loading 
              ? 'Placing Parlay...' 
              : 'Place Parlay Bet'
          }
        </Button>
      </CardContent>
    </Card>
    
    <DuplicateBetDialog 
      open={showDuplicateDialog} 
      onOpenChange={setShowDuplicateDialog}
      betType="parlay"
      remainingSeconds={remainingCooldown}
    />
    </>
  );
};

export default ParlayBettingSlip;
