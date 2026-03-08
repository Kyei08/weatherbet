import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Plus, X, TrendingUp, Activity, AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import { useDuplicateBetPrevention } from '@/hooks/useDuplicateBetPrevention';
import { CITIES, TEMPERATURE_RANGES, RAINFALL_RANGES, WIND_RANGES, DEW_POINT_RANGES, PRESSURE_RANGES, CLOUD_COVERAGE_RANGES } from '@/types/betting';
import { createParlay, ParlayPrediction } from '@/lib/supabase-parlays';
import { getUser, updateUserPoints } from '@/lib/supabase-auth-storage';
import { useToast } from '@/hooks/use-toast';
import { useChallengeTracker } from '@/hooks/useChallengeTracker';
import { useAchievementTracker } from '@/hooks/useAchievementTracker';
import { useLevelSystem } from '@/hooks/useLevelSystem';
import { calculateDynamicOdds, formatLiveOdds } from '@/lib/dynamic-odds';
import { getTimeDecayInfo } from '@/lib/betting-config';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { format, addDays, startOfDay, setHours, setMinutes, setSeconds } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/currency';
import { useCurrencyMode } from '@/contexts/CurrencyModeContext';
import { DuplicateBetDialog } from './DuplicateBetDialog';
import { DifficultyRating } from './DifficultyRating';
import { VolatilityBadge } from './VolatilityBadge';

const getUserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const getNext7Days = () => {
  const days = [];
  const today = startOfDay(new Date());
  for (let i = 1; i <= 7; i++) { days.push(addDays(today, i)); }
  return days;
};

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

// City flag emojis
const cityFlags: Record<string, string> = {
  'New York': '🇺🇸', 'Tokyo': '🇯🇵', 'London': '🇬🇧', 'Paris': '🇫🇷',
  'Sydney': '🇦🇺', 'Cape Town': '🇿🇦', 'Sao Paulo': '🇧🇷',
  'Mumbai': '🇮🇳', 'Cairo': '🇪🇬', 'Toronto': '🇨🇦',
};

// Category config for icon grid
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

const rangeConfigs: Record<string, readonly { label: string; value: string; odds: number }[]> = {
  temperature: TEMPERATURE_RANGES,
  rainfall: RAINFALL_RANGES,
  wind: WIND_RANGES,
  dew_point: DEW_POINT_RANGES,
  pressure: PRESSURE_RANGES,
  cloud_coverage: CLOUD_COVERAGE_RANGES,
};

const yesNoCategories = ['rain', 'snow'];

interface ParlayBettingSlipProps {
  onBack: () => void;
  onBetPlaced: () => void;
}

interface PredictionFormData {
  id: string;
  city: string;
  predictionType: 'rain' | 'temperature' | 'rainfall' | 'snow' | 'wind' | 'dew_point' | 'pressure' | 'cloud_coverage';
  predictionValue: string;
}

const createEmptyPrediction = (): PredictionFormData => ({
  id: crypto.randomUUID(),
  city: '',
  predictionType: 'rain',
  predictionValue: '',
});

const ParlayBettingSlip = ({ onBack, onBetPlaced }: ParlayBettingSlipProps) => {
  const { mode } = useCurrencyMode();
  const [predictions, setPredictions] = useState<PredictionFormData[]>([createEmptyPrediction()]);
  const [stake, setStake] = useState('');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const isPlacingBetRef = useRef(false);
  const { showDuplicateDialog, setShowDuplicateDialog, remainingCooldown, checkAndRecord } = useDuplicateBetPrevention();
  const [weatherForecasts, setWeatherForecasts] = useState<Record<string, any[]>>({});
  const [hasInsurance, setHasInsurance] = useState(false);
  const [availableDays] = useState(() => getNext7Days());
  const [selectedDay, setSelectedDay] = useState<Date>(getNext7Days()[0]);
  const { toast } = useToast();
  const { checkAndUpdateChallenges } = useChallengeTracker();
  const { checkAchievements } = useAchievementTracker();
  const { awardXPForAction } = useLevelSystem();

  // Stake presets
  const stakePresets = mode === 'real'
    ? [{ label: 'R5', value: 500 }, { label: 'R10', value: 1000 }, { label: 'R25', value: 2500 }, { label: 'R50', value: 5000 }, { label: 'R100', value: 10000 }]
    : [{ label: '10', value: 10 }, { label: '25', value: 25 }, { label: '50', value: 50 }, { label: '75', value: 75 }, { label: '100', value: 100 }];

  useEffect(() => { loadUser(); }, []);

  useEffect(() => {
    const fetchWeatherForCities = async () => {
      const citiesToFetch = predictions.map(p => p.city).filter(city => city && !weatherForecasts[city]);
      if (citiesToFetch.length === 0) return;
      const newForecasts: Record<string, any[]> = { ...weatherForecasts };
      for (const city of citiesToFetch) {
        try {
          const { data, error } = await supabase.functions.invoke('get-weather', { body: { city } });
          if (!error && data?.forecast) { newForecasts[city] = data.forecast; }
        } catch (error) { console.error(`Error fetching weather for ${city}:`, error); }
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
      toast({ title: 'Error', description: 'Failed to load user data', variant: 'destructive' });
    }
  };

  const getDaysAhead = () => {
    const today = startOfDay(new Date());
    return Math.ceil((selectedDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const isDeadlinePassed = (betDay: Date) => new Date() > getDeadlineForDay(betDay);

  const addPrediction = () => {
    if (predictions.length >= 10) {
      toast({ title: 'Maximum Reached', description: 'Max 10 predictions in a parlay', variant: 'destructive' });
      return;
    }
    setPredictions([...predictions, createEmptyPrediction()]);
  };

  const removePrediction = (id: string) => {
    if (predictions.length <= 1) return;
    setPredictions(predictions.filter(p => p.id !== id));
  };

  const updatePrediction = (id: string, updates: Partial<PredictionFormData>) => {
    setPredictions(predictions.map(p => {
      if (p.id !== id) return p;
      const updated = { ...p, ...updates };
      // Clear value when type changes
      if (updates.predictionType && updates.predictionType !== p.predictionType) {
        updated.predictionValue = '';
      }
      return updated;
    }));
  };

  const getPredictionOdds = (pred: PredictionFormData): number => {
    if (!pred.city || !pred.predictionValue) return 2.0;
    const forecast = weatherForecasts[pred.city];
    if (forecast && forecast.length > 0) {
      return calculateDynamicOdds({
        predictionType: pred.predictionType,
        predictionValue: pred.predictionValue,
        forecast,
        daysAhead: getDaysAhead(),
      });
    }
    return 2.0;
  };

  const getCombinedOdds = (): number => {
    return predictions.reduce((total, pred) => {
      if (!pred.city || !pred.predictionValue) return total;
      return total * getPredictionOdds(pred);
    }, 1);
  };

  const getInsuranceCost = () => {
    const stakeNum = parseInt(stake) || 0;
    return Math.floor(stakeNum * 0.2);
  };

  const getInsurancePayout = () => {
    const stakeNum = parseInt(stake) || 0;
    return Math.floor(stakeNum * 0.75);
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
    const threshold = mode === 'real' ? 1000 : 10;
    return remaining >= 0 && remaining < threshold;
  };

  const canPlaceParlay = (): boolean => {
    if (isDeadlinePassed(selectedDay)) return false;
    if (predictions.length < 2) return false;
    if (!predictions.every(p => p.city && p.predictionValue)) return false;
    const stakeNum = parseInt(stake);
    const totalCost = getTotalCost();
    const userBalance = mode === 'real' ? (user?.balance_cents || 0) : (user?.points || 0);
    const minStake = mode === 'real' ? 100 : 10;
    if (!stakeNum || stakeNum < minStake || totalCost > userBalance) return false;
    const cities = predictions.map(p => p.city);
    if (new Set(cities).size !== cities.length) return false;
    return true;
  };

  const getPredictionLabel = (pred: PredictionFormData): string => {
    if (!pred.predictionValue) return '';
    const cat = categoryConfig.find(c => c.value === pred.predictionType);
    if (yesNoCategories.includes(pred.predictionType)) {
      return `${cat?.label}: ${pred.predictionValue}`;
    }
    const ranges = rangeConfigs[pred.predictionType];
    if (ranges) {
      const found = ranges.find(r => r.value === pred.predictionValue);
      return `${cat?.label}: ${found?.label || pred.predictionValue}`;
    }
    return `${cat?.label}: ${pred.predictionValue}`;
  };

  const handlePlaceParlay = async () => {
    if (isPlacingBetRef.current || loading) return;
    const betSignature = predictions.map(p => `${p.city}|${p.predictionType}|${p.predictionValue}`).join('||') + `|${stake}|${format(selectedDay, 'yyyy-MM-dd')}|${mode}`;
    if (!checkAndRecord(betSignature)) return;
    if (isDeadlinePassed(selectedDay)) {
      toast({ title: 'Deadline Passed', description: `The betting deadline for ${format(selectedDay, 'EEEE, MMMM dd')} has already passed.`, variant: 'destructive' });
      return;
    }
    if (!canPlaceParlay()) return;
    isPlacingBetRef.current = true;
    setLoading(true);

    const validation = parlaySchema.safeParse({
      stake: parseInt(stake),
      predictions: predictions.map(p => ({ city: p.city, predictionType: p.predictionType })),
    });
    if (!validation.success) {
      const errors = validation.error.flatten().fieldErrors;
      toast({ title: 'Validation Error', description: Object.values(errors).flat()[0] || 'Invalid parlay parameters', variant: 'destructive' });
      setLoading(false); isPlacingBetRef.current = false;
      return;
    }

    const invalidCity = predictions.find(p => !CITIES.includes(p.city as any));
    if (invalidCity) {
      toast({ title: 'Invalid City', description: 'Please select valid cities from the list.', variant: 'destructive' });
      setLoading(false); isPlacingBetRef.current = false;
      return;
    }

    try {
      const stakeNum = parseInt(stake);
      const parlayPredictions: ParlayPrediction[] = predictions.map(pred => ({
        city: pred.city,
        predictionType: pred.predictionType,
        predictionValue: pred.predictionValue,
        odds: getPredictionOdds(pred),
      }));

      const parlayId = await createParlay(stakeNum, parlayPredictions, getDaysAhead(), selectedDay, hasInsurance, mode);

      if (hasInsurance) {
        const { supabase } = await import('@/integrations/supabase/client');
        await supabase.from('parlays').update({
          has_insurance: true,
          insurance_cost: getInsuranceCost(),
          insurance_payout_percentage: 0.75,
        }).eq('id', parlayId);
      }

      await checkAndUpdateChallenges('bet_placed', { stake: stakeNum, city: predictions[0].city });
      await checkAchievements();
      await awardXPForAction('BET_PLACED');

      toast({
        title: 'Parlay Placed! 🎯',
        description: `${formatCurrency(stakeNum, mode)} • ${predictions.length} legs • ${getCombinedOdds().toFixed(2)}x odds`,
      });

      onBetPlaced();
      onBack();
      setTimeout(() => { window.location.href = '/'; }, 1500);
    } catch (error: any) {
      if (error?.message?.includes('wait a few seconds before placing another identical')) {
        setShowDuplicateDialog(true);
      } else {
        toast({ title: 'Error', description: error?.message || 'Failed to place parlay', variant: 'destructive' });
      }
    } finally {
      setLoading(false);
      isPlacingBetRef.current = false;
    }
  };

  if (!user) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  // Progress
  const allLegsComplete = predictions.length >= 2 && predictions.every(p => p.city && p.predictionValue);
  const completedSteps = [
    predictions.length >= 2,
    allLegsComplete,
    !!stake && parseInt(stake) >= (mode === 'real' ? 100 : 10),
  ];

  return (
    <>
      <div className="min-h-screen bg-background p-4 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="max-w-2xl mx-auto space-y-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">Parlay Bet</h1>
                <p className="text-xs text-muted-foreground">
                  {format(selectedDay, 'EEEE, MMM d')} • Closes {format(getDeadlineForDay(selectedDay), 'EEE')} 11:59 PM
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Balance</p>
              <p className="text-sm font-bold">{formatCurrency(mode === 'real' ? user.balance_cents : user.points, mode)}</p>
            </div>
          </div>

          {/* Progress indicator */}
          <div className="flex gap-1.5">
            {['2+ Legs', 'Predictions', 'Stake'].map((step, i) => (
              <div key={step} className="flex-1 space-y-1">
                <div className={`h-1.5 rounded-full transition-colors ${completedSteps[i] ? 'bg-primary' : 'bg-muted'}`} />
                <p className={`text-[10px] text-center ${completedSteps[i] ? 'text-primary font-medium' : 'text-muted-foreground'}`}>{step}</p>
              </div>
            ))}
          </div>

          {/* Live Odds Banner */}
          {predictions.some(p => p.city && weatherForecasts[p.city]) && (
            <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 rounded-lg border border-primary/10">
              <Activity className="h-3.5 w-3.5 text-primary animate-pulse" />
              <span className="text-xs font-medium">Live Odds</span>
              {predictions[0]?.city && (
                <VolatilityBadge city={predictions[0].city} category={predictions[0].predictionType} />
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

          {/* Day Selection - horizontal pills */}
          <div className="space-y-2">
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
          </div>

          {/* Predictions (Legs) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Legs ({predictions.length})
              </Label>
              <Button size="sm" variant="outline" onClick={addPrediction} disabled={predictions.length >= 10} className="h-7 text-xs gap-1">
                <Plus className="h-3 w-3" /> Add Leg
              </Button>
            </div>

            {predictions.map((pred, index) => {
              const isYesNo = yesNoCategories.includes(pred.predictionType);
              const ranges = rangeConfigs[pred.predictionType];

              return (
                <div key={pred.id} className="p-3 rounded-lg border border-border space-y-3">
                  {/* Leg header */}
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px] h-5">Leg {index + 1}</Badge>
                    <div className="flex items-center gap-2">
                      {pred.city && pred.predictionValue && (
                        <span className="text-[10px] font-mono text-primary font-medium">
                          {getPredictionOdds(pred).toFixed(2)}x
                        </span>
                      )}
                      {predictions.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removePrediction(pred.id)} className="h-6 w-6">
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* City grid */}
                  <div className="grid grid-cols-5 gap-1.5">
                    {CITIES.map((cityName) => {
                      const isSelected = pred.city === cityName;
                      const isUsed = predictions.some(p => p.id !== pred.id && p.city === cityName);
                      return (
                        <button
                          key={cityName}
                          disabled={isUsed}
                          onClick={() => updatePrediction(pred.id, { city: cityName })}
                          className={`flex flex-col items-center gap-0.5 p-1.5 rounded-md border text-center transition-all
                            ${isSelected ? 'border-primary bg-primary/10 ring-1 ring-primary' : isUsed ? 'opacity-30 cursor-not-allowed' : 'border-border hover:border-primary/50'}
                            ${!isUsed ? 'cursor-pointer' : ''}`}
                        >
                          <span className="text-sm">{cityFlags[cityName] || '🌍'}</span>
                          <span className={`text-[8px] leading-tight ${isSelected ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                            {cityName.split(' ')[0]}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Prediction type icon grid */}
                  {pred.city && (
                    <div className="grid grid-cols-4 gap-1.5">
                      {categoryConfig.map((cat) => {
                        const isSelected = pred.predictionType === cat.value;
                        return (
                          <button
                            key={cat.value}
                            onClick={() => updatePrediction(pred.id, { predictionType: cat.value as any })}
                            className={`flex flex-col items-center gap-0 p-1.5 rounded-md border text-center transition-all
                              ${isSelected ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border hover:border-primary/50'}
                              cursor-pointer`}
                          >
                            <span className="text-sm">{cat.icon}</span>
                            <span className={`text-[8px] font-medium ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>{cat.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Prediction value selection */}
                  {pred.city && isYesNo && (
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'yes', label: pred.predictionType === 'rain' ? 'Yes 🌧️' : 'Yes ❄️' },
                        { value: 'no', label: pred.predictionType === 'rain' ? 'No ☀️' : 'No 🌤️' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => updatePrediction(pred.id, { predictionValue: opt.value })}
                          className={`p-2 rounded-lg border text-center transition-all text-sm
                            ${pred.predictionValue === opt.value ? 'border-primary bg-primary/10 ring-1 ring-primary font-semibold' : 'border-border hover:border-primary/50'}
                            cursor-pointer`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {pred.city && !isYesNo && ranges && (
                    <div className={`grid gap-1.5 ${ranges.length <= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                      {ranges.map((range) => (
                        <button
                          key={range.value}
                          onClick={() => updatePrediction(pred.id, { predictionValue: range.value })}
                          className={`p-2 rounded-md border text-center transition-all
                            ${pred.predictionValue === range.value ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border hover:border-primary/50'}
                            cursor-pointer`}
                        >
                          <p className="font-medium text-xs">{range.label}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Stake Input with presets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Stake</Label>
              <span className="text-[10px] text-muted-foreground">
                {mode === 'real' ? 'R1 – R100' : '10 – 100 pts'}
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
              placeholder={mode === 'real' ? 'Custom amount (cents)' : 'Custom amount'}
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              min={mode === 'real' ? 100 : 10}
              max={mode === 'real' ? 10000 : 100}
              step={mode === 'real' ? 100 : 1}
              className="text-center font-medium"
            />
          </div>

          {/* Low Balance Warning */}
          {stake && parseInt(stake) >= (mode === 'real' ? 100 : 10) && isLowBalanceWarning() && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20 text-xs">
              <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
              <span>Remaining balance: <strong>{formatCurrency(getRemainingBalance(), mode)}</strong></span>
            </div>
          )}

          {/* Insurance toggle - compact */}
          {stake && parseInt(stake) >= (mode === 'real' ? 100 : 10) && (
            <div className="flex items-center justify-between p-3 rounded-lg border border-primary/20 bg-primary/5">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="parlay-insurance"
                  checked={hasInsurance}
                  onChange={(e) => setHasInsurance(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <Label htmlFor="parlay-insurance" className="cursor-pointer text-sm font-medium">
                  🛡️ Insurance
                </Label>
                <span className="text-[10px] text-muted-foreground">
                  75% back if you lose • costs 20%
                </span>
              </div>
              {hasInsurance && (
                <span className="text-xs font-medium text-primary">
                  +{formatCurrency(getInsuranceCost(), mode)}
                </span>
              )}
            </div>
          )}

          {/* Validation messages */}
          {predictions.length < 2 && (
            <p className="text-xs text-destructive text-center">Add at least 2 legs to create a parlay</p>
          )}
          {predictions.map(p => p.city).filter((c, i, arr) => c && arr.indexOf(c) !== i).length > 0 && (
            <p className="text-xs text-destructive text-center">Each leg must be a different city</p>
          )}

          {/* Difficulty Rating */}
          {predictions[0]?.city && weatherForecasts[predictions[0].city] && predictions[0].predictionValue && (
            <DifficultyRating
              city={predictions[0].city}
              predictionType={predictions[0].predictionType}
              predictionValue={predictions[0].predictionValue}
              daysAhead={getDaysAhead()}
              forecast={weatherForecasts[predictions[0].city]}
              showDetails
            />
          )}

          {/* Bet Summary Card */}
          <AnimatePresence>
          {predictions.length >= 2 && predictions.every(p => p.city && p.predictionValue) && stake && parseInt(stake) >= (mode === 'real' ? 100 : 10) && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
            <Card className="border-2 border-primary/20 bg-gradient-to-b from-primary/5 to-transparent">
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Parlay Summary</span>
                </div>

                {/* Legs list */}
                <div className="space-y-1">
                  {predictions.map((pred, i) => (
                    <div key={pred.id} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        {cityFlags[pred.city]} {pred.city} • {getPredictionLabel(pred)}
                      </span>
                      <span className="font-mono font-medium">{getPredictionOdds(pred).toFixed(2)}x</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-border pt-2 mt-2 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Stake</span>
                    <span className="font-medium">{formatCurrency(parseInt(stake) || 0, mode)}</span>
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
                      Combined Odds
                      {predictions.some(p => p.city && weatherForecasts[p.city]) && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1 text-primary border-primary/30">LIVE</Badge>
                      )}
                    </span>
                    <span className="font-bold text-sm">{formatLiveOdds(getCombinedOdds())}</span>
                  </div>
                </div>

                <div className="border-t border-border pt-3 mt-2 flex justify-between items-center">
                  <span className="text-sm font-semibold text-success">Potential Win</span>
                  <span className="text-lg font-bold text-success">+{formatCurrency(getPotentialWin(), mode)}</span>
                </div>
                {hasInsurance && (
                  <div className="flex justify-between text-xs text-primary">
                    <span>If lose (insured)</span>
                    <span>-{formatCurrency((parseInt(stake) || 0) - getInsurancePayout(), mode)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
            </motion.div>
          )}
          </AnimatePresence>

          {/* Place Bet Button */}
          <Button
            className="w-full text-base"
            size="lg"
            onClick={handlePlaceParlay}
            disabled={!canPlaceParlay() || loading || isDeadlinePassed(selectedDay)}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isDeadlinePassed(selectedDay)
              ? '⏰ Deadline Passed'
              : loading
                ? 'Placing Parlay...'
                : predictions.length >= 2 && predictions.every(p => p.city && p.predictionValue)
                  ? `Place Parlay • ${formatLiveOdds(getCombinedOdds())}x`
                  : 'Place Parlay Bet'
            }
          </Button>
        </motion.div>
      </div>

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
