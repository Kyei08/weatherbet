import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, TrendingUp, AlertTriangle, Loader2, Clock, Activity, Sparkles } from 'lucide-react';
import { useDuplicateBetPrevention } from '@/hooks/useDuplicateBetPrevention';
import { CITIES, City, TEMPERATURE_RANGES, RAINFALL_RANGES, WIND_RANGES, DEW_POINT_RANGES, PRESSURE_RANGES, CLOUD_COVERAGE_RANGES } from '@/types/supabase-betting';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@/types/supabase-betting';
import { z } from 'zod';
import { createCombinedBet } from '@/lib/supabase-combined-bets';
import { calculateDynamicOdds, calculateCategoryOdds } from '@/lib/dynamic-odds';
import { getTimeDecayInfo } from '@/lib/betting-config';
import WeatherDisplay from './WeatherDisplay';
import CategoryTimingInfo from './CategoryTimingInfo';
import TimeSlotSelector from './TimeSlotSelector';
import { formatCurrency } from '@/lib/currency';
import { useCurrencyMode } from '@/contexts/CurrencyModeContext';
import { DuplicateBetDialog } from './DuplicateBetDialog';
import { format } from 'date-fns';
import { BettingCategory, getDefaultTimeSlot, getTimeSlot, hasMultipleTimeSlots } from '@/lib/betting-timing';
import { DifficultyRating } from './DifficultyRating';
import { VolatilityBadge } from './VolatilityBadge';
import { useMultiCategoryVolatility } from '@/hooks/useVolatilityOdds';

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

// Range configs per category
const rangeConfigs: Record<string, readonly { label: string; value: string; odds: number }[]> = {
  temperature: TEMPERATURE_RANGES,
  rainfall: RAINFALL_RANGES,
  wind: WIND_RANGES,
  dew_point: DEW_POINT_RANGES,
  pressure: PRESSURE_RANGES,
  cloud_coverage: CLOUD_COVERAGE_RANGES,
};

const yesNoCategories = ['rain', 'snow'];

export function CombinedBettingSlip({ onBack, onBetPlaced }: CombinedBettingSlipProps) {
  const { mode } = useCurrencyMode();
  const [city, setCity] = useState<City>('New York');
  const [selectedDay, setSelectedDay] = useState<Date>(getNext7Days()[0]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categoryValues, setCategoryValues] = useState<Record<string, CategorySelection>>({});
  const [categoryTimeSlots, setCategoryTimeSlots] = useState<Record<string, string>>({});
  const [stake, setStake] = useState<number>(mode === 'real' ? 5000 : 50);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const isPlacingBetRef = useRef(false);
  const { showDuplicateDialog, setShowDuplicateDialog, remainingCooldown, checkAndRecord } = useDuplicateBetPrevention();
  const [hasInsurance, setHasInsurance] = useState(false);
  const [weatherForecast, setWeatherForecast] = useState<any>(null);
  const [timezone] = useState(getUserTimezone());
  const { toast } = useToast();

  // Stake presets
  const stakePresets = mode === 'real'
    ? [{ label: 'R5', value: 500 }, { label: 'R10', value: 1000 }, { label: 'R25', value: 2500 }, { label: 'R50', value: 5000 }, { label: 'R100', value: 10000 }]
    : [{ label: '10', value: 10 }, { label: '25', value: 25 }, { label: '50', value: 50 }, { label: '100', value: 100 }, { label: '250', value: 250 }];

  // Progress tracking
  const completedSteps = [
    !!city,
    selectedCategories.length > 0 && Object.keys(categoryValues).length === selectedCategories.length,
    stake >= (mode === 'real' ? 100 : 10),
  ];

  useEffect(() => { loadUser(); }, []);
  useEffect(() => { if (city) fetchWeatherForecast(); }, [city]);

  const loadUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Not authenticated');
      const { data, error } = await supabase.from('users').select('*').eq('id', authUser.id).single();
      if (error) throw error;
      setUser(data);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchWeatherForecast = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-weather', { body: { city } });
      if (error) throw error;
      setWeatherForecast(data);
    } catch (error: any) {
      console.error('Error fetching weather:', error);
    }
  };

  const getDaysAhead = () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const betDay = new Date(selectedDay); betDay.setHours(0, 0, 0, 0);
    return Math.floor((betDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const isDeadlinePassed = (day: Date) => new Date() > getDeadlineForDay(day);

  const handleCategoryToggle = (category: string) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories(prev => prev.filter(c => c !== category));
      const newValues = { ...categoryValues }; delete newValues[category];
      setCategoryValues(newValues);
      const newTimeSlots = { ...categoryTimeSlots }; delete newTimeSlots[category];
      setCategoryTimeSlots(newTimeSlots);
    } else {
      if (selectedCategories.length >= 5) {
        toast({ title: "Maximum Reached", description: "You can select up to 5 categories per bet", variant: "destructive" });
        return;
      }
      setSelectedCategories(prev => [...prev, category]);
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
        const baseOdds = calculateDynamicOdds({ predictionType: type as 'rain' | 'snow', predictionValue: value, forecast: weatherForecast, daysAhead });
        return parseFloat((baseOdds * timeSlotMultiplier).toFixed(2));
      }
      const baseOdds = value === 'yes' ? 2.5 : 2.0;
      return parseFloat((baseOdds * timeSlotMultiplier).toFixed(2));
    }
    if (type === 'temperature') {
      if (weatherForecast) {
        const baseOdds = calculateDynamicOdds({ predictionType: type as 'temperature', predictionValue: value, forecast: weatherForecast, daysAhead });
        return parseFloat((baseOdds * timeSlotMultiplier).toFixed(2));
      }
      const tempRange = TEMPERATURE_RANGES.find(r => r.value === value);
      return parseFloat(((tempRange?.odds || 2.0) * timeSlotMultiplier).toFixed(2));
    }
    const baseOdds = calculateCategoryOdds(type as any, value);
    return parseFloat((baseOdds * timeSlotMultiplier).toFixed(2));
  };

  const updateCategoryValue = (type: string, value: string) => {
    const odds = getCategoryOddsWithSlot(type, value);
    const timeSlotId = categoryTimeSlots[type];
    setCategoryValues(prev => ({ ...prev, [type]: { type, value, odds, timeSlotId } }));
  };

  const handleTimeSlotChange = (category: string, slotId: string) => {
    setCategoryTimeSlots(prev => ({ ...prev, [category]: slotId }));
    if (categoryValues[category]) {
      const newOdds = getCategoryOddsWithSlot(category, categoryValues[category].value);
      setCategoryValues(prev => ({ ...prev, [category]: { ...prev[category], odds: newOdds, timeSlotId: slotId } }));
    }
  };

  const getCombinedOdds = (): number => {
    const validCategories = Object.values(categoryValues);
    if (validCategories.length === 0) return 1;
    return validCategories.reduce((total, cat) => total * cat.odds, 1);
  };

  const getInsuranceCost = (): number => hasInsurance ? Math.floor(stake * 0.2) : 0;
  const getTotalCost = (): number => stake + getInsuranceCost();
  const getPotentialWin = (): number => Math.floor(stake * getCombinedOdds());

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
    const validation = getCombinedBetSchema(mode).safeParse({ city, stake, categories: selectedCategories });
    if (!validation.success) return false;
    if (Object.keys(categoryValues).length !== selectedCategories.length) return false;
    const userBalance = mode === 'real' ? user.balance_cents : user.points;
    if (getTotalCost() > userBalance) return false;
    return true;
  };

  const getPredictionLabel = (type: string, value: string): string => {
    if (type === 'rain') return `Rain: ${value}`;
    if (type === 'snow') return `Snow: ${value}`;
    const ranges = rangeConfigs[type];
    if (ranges) {
      const found = ranges.find(r => r.value === value);
      return `${categoryConfig.find(c => c.value === type)?.label || type}: ${found?.label || value}`;
    }
    return `${type}: ${value}`;
  };

  const handlePlaceBet = async () => {
    if (isPlacingBetRef.current || placing || !canPlaceBet()) return;
    const betSignature = `${city}|${Object.values(categoryValues).map(c => `${c.type}:${c.value}`).join('|')}|${stake}|${format(selectedDay, 'yyyy-MM-dd')}|${mode}`;
    if (!checkAndRecord(betSignature)) return;
    if (isDeadlinePassed(selectedDay)) {
      toast({ title: "Deadline Passed", description: `The betting deadline for this day was ${getDeadlineForDay(selectedDay).toLocaleString()}`, variant: "destructive" });
      return;
    }
    try {
      isPlacingBetRef.current = true;
      setPlacing(true);
      const categories = Object.values(categoryValues).map(cat => ({ predictionType: cat.type, predictionValue: cat.value, odds: cat.odds }));
      await createCombinedBet(city, stake, categories, selectedDay, hasInsurance, mode);
      toast({
        title: "Combined Bet Placed! 🎯",
        description: `${formatCurrency(stake, mode)} on ${city} • ${selectedCategories.length} categories • ${getCombinedOdds().toFixed(2)}x odds`,
      });
      onBetPlaced();
      setTimeout(() => { window.location.href = '/'; }, 1500);
    } catch (error: any) {
      if (error?.message?.includes('wait a few seconds before placing another identical')) {
        setShowDuplicateDialog(true);
      } else {
        toast({ title: "Error", description: error?.message || "Failed to place combined bet", variant: "destructive" });
      }
    } finally {
      setPlacing(false);
      isPlacingBetRef.current = false;
    }
  };

  if (loading || !user) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  const availableDays = getNext7Days();
  const combinedOdds = getCombinedOdds();
  const deadlinePassed = isDeadlinePassed(selectedDay);

  return (
    <>
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
                <h1 className="text-xl font-bold">Combined Bet</h1>
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
            {['City', 'Categories', 'Stake'].map((step, i) => (
              <div key={step} className="flex-1 space-y-1">
                <div className={`h-1.5 rounded-full transition-colors ${completedSteps[i] ? 'bg-primary' : 'bg-muted'}`} />
                <p className={`text-[10px] text-center ${completedSteps[i] ? 'text-primary font-medium' : 'text-muted-foreground'}`}>{step}</p>
              </div>
            ))}
          </div>

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

          {/* Weather Display */}
          {city && <WeatherDisplay city={city} />}

          {/* Live Odds Banner */}
          {weatherForecast && (
            <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 rounded-lg border border-primary/10">
              <Activity className="h-3.5 w-3.5 text-primary animate-pulse" />
              <span className="text-xs font-medium">Live Odds</span>
              {selectedCategories.length > 0 && (
                <VolatilityBadge city={city} category={selectedCategories[0]} />
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

          {/* Category Selection - icon grid with checkboxes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Categories ({selectedCategories.length}/5)
              </Label>
              <span className="text-[10px] text-muted-foreground">Select 1-5</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {categoryConfig.map((cat) => {
                const isSelected = selectedCategories.includes(cat.value);
                return (
                  <button
                    key={cat.value}
                    onClick={() => handleCategoryToggle(cat.value)}
                    className={`flex flex-col items-center gap-0.5 p-2.5 rounded-lg border text-center transition-all relative
                      ${isSelected ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border hover:border-primary/50 hover:bg-accent/30'}
                      cursor-pointer`}
                  >
                    {isSelected && (
                      <div className="absolute top-1 right-1 h-3 w-3 rounded-full bg-primary flex items-center justify-center">
                        <span className="text-[8px] text-primary-foreground">✓</span>
                      </div>
                    )}
                    <span className="text-base">{cat.icon}</span>
                    <span className={`text-[10px] font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>{cat.label}</span>
                    <span className="text-[9px] text-muted-foreground">{cat.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category value selectors - compact */}
          {selectedCategories.map((catKey) => {
            const catConfig = categoryConfig.find(c => c.value === catKey)!;
            const isYesNo = yesNoCategories.includes(catKey);
            const ranges = rangeConfigs[catKey];
            const currentValue = categoryValues[catKey]?.value || '';

            return (
              <div key={catKey} className="space-y-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{catConfig.icon}</span>
                    <Label className="text-xs font-semibold">{catConfig.label}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <CategoryTimingInfo category={catKey as BettingCategory} slotId={categoryTimeSlots[catKey]} />
                    {categoryValues[catKey] && (
                      <Badge variant="outline" className="text-[10px] h-5 font-mono">
                        {categoryValues[catKey].odds.toFixed(2)}x
                      </Badge>
                    )}
                  </div>
                </div>

                {hasMultipleTimeSlots(catKey as BettingCategory) && (
                  <TimeSlotSelector
                    category={catKey as BettingCategory}
                    selectedSlotId={categoryTimeSlots[catKey] || ''}
                    onSlotChange={(slotId) => handleTimeSlotChange(catKey, slotId)}
                  />
                )}

                {isYesNo ? (
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'yes', label: catKey === 'rain' ? 'Yes 🌧️' : 'Yes ❄️' },
                      { value: 'no', label: catKey === 'rain' ? 'No ☀️' : 'No 🌤️' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => updateCategoryValue(catKey, opt.value)}
                        className={`p-2.5 rounded-lg border text-center transition-all text-sm
                          ${currentValue === opt.value ? 'border-primary bg-primary/10 ring-1 ring-primary font-semibold' : 'border-border hover:border-primary/50'}
                          cursor-pointer`}
                      >
                        {opt.label}
                        <span className="block text-[10px] text-muted-foreground font-normal mt-0.5">
                          {getCategoryOddsWithSlot(catKey, opt.value).toFixed(2)}x
                        </span>
                      </button>
                    ))}
                  </div>
                ) : ranges ? (
                  <div className={`grid gap-2 ${ranges.length <= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    {ranges.map((range) => (
                      <button
                        key={range.value}
                        onClick={() => updateCategoryValue(catKey, range.value)}
                        className={`p-2 rounded-lg border text-center transition-all
                          ${currentValue === range.value ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border hover:border-primary/50'}
                          cursor-pointer`}
                      >
                        <p className="font-medium text-xs">{range.label}</p>
                        <p className="text-[10px] text-muted-foreground">{getCategoryOddsWithSlot(catKey, range.value).toFixed(2)}x</p>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}

          {/* Stake Input with presets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Stake</Label>
              <span className="text-[10px] text-muted-foreground">
                {mode === 'real' ? 'R1 – R100' : '10 – 1000 pts'}
              </span>
            </div>
            <div className="flex gap-2">
              {stakePresets.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => setStake(preset.value)}
                  className={`flex-1 py-2 rounded-md border text-xs font-medium transition-all
                    ${stake === preset.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'}
                    cursor-pointer`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <Input
              type="number"
              min={mode === 'real' ? 100 : 10}
              max={mode === 'real' ? 10000 : 1000}
              step={mode === 'real' ? 100 : 1}
              value={stake}
              onChange={(e) => setStake(Number(e.target.value))}
              placeholder={mode === 'real' ? 'Custom amount (cents)' : 'Custom amount'}
              className="text-center font-medium"
            />
          </div>

          {/* Low Balance Warning */}
          {stake > 0 && isLowBalanceWarning() && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20 text-xs">
              <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
              <span>Remaining balance: <strong>{formatCurrency(getRemainingBalance(), mode)}</strong></span>
            </div>
          )}

          {/* Insurance toggle - compact */}
          {stake >= (mode === 'real' ? 100 : 10) && (
            <div className="flex items-center justify-between p-3 rounded-lg border border-primary/20 bg-primary/5">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="combined-insurance"
                  checked={hasInsurance}
                  onChange={(e) => setHasInsurance(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <Label htmlFor="combined-insurance" className="cursor-pointer text-sm font-medium">
                  🛡️ Insurance
                </Label>
                <span className="text-[10px] text-muted-foreground">
                  80% back if you lose • costs 20%
                </span>
              </div>
              {hasInsurance && (
                <span className="text-xs font-medium text-primary">
                  +{formatCurrency(getInsuranceCost(), mode)}
                </span>
              )}
            </div>
          )}

          {/* All-win warning */}
          {selectedCategories.length > 1 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/5 border border-destructive/15 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
              <span>All {selectedCategories.length} predictions must win. Higher risk = higher reward!</span>
            </div>
          )}

          {/* Difficulty Rating */}
          {selectedCategories.length > 0 && weatherForecast && categoryValues[selectedCategories[0]] && (
            <DifficultyRating
              city={city}
              predictionType={selectedCategories[0]}
              predictionValue={categoryValues[selectedCategories[0]]?.value || ''}
              daysAhead={getDaysAhead()}
              forecast={weatherForecast.forecast || weatherForecast}
              showDetails
            />
          )}

          {/* Bet Summary Card */}
          {selectedCategories.length > 0 && Object.keys(categoryValues).length > 0 && stake >= (mode === 'real' ? 100 : 10) && (
            <Card className="border-2 border-primary/20 bg-gradient-to-b from-primary/5 to-transparent">
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Bet Summary</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <span className="text-muted-foreground">City</span>
                  <span className="font-medium text-right">{cityFlags[city]} {city}</span>
                  
                  <span className="text-muted-foreground">Target</span>
                  <span className="font-medium text-right">{format(selectedDay, 'EEE, MMM d')}</span>
                  
                  <span className="text-muted-foreground">Categories</span>
                  <span className="font-medium text-right">{selectedCategories.length} selected</span>
                </div>

                {/* Category predictions list */}
                <div className="border-t border-border pt-2 mt-2 space-y-1">
                  {Object.values(categoryValues).map((cat, i) => {
                    const slotId = categoryTimeSlots[cat.type];
                    const slot = slotId ? getTimeSlot(cat.type as BettingCategory, slotId) : null;
                    return (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground flex items-center gap-1">
                          {categoryConfig.find(c => c.value === cat.type)?.icon} {getPredictionLabel(cat.type, cat.value)}
                          {slot && <Badge variant="outline" className="text-[9px] h-4 px-1">{slot.label}</Badge>}
                        </span>
                        <span className="font-mono font-medium">{cat.odds.toFixed(2)}x</span>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-border pt-2 mt-2 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Stake</span>
                    <span className="font-medium">{formatCurrency(stake, mode)}</span>
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
                      {weatherForecast && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1 text-primary border-primary/30">LIVE</Badge>
                      )}
                    </span>
                    <span className="font-bold text-sm">{combinedOdds.toFixed(2)}x</span>
                  </div>
                </div>

                <div className="border-t border-border pt-3 mt-2 flex justify-between items-center">
                  <span className="text-sm font-semibold text-success">Potential Win</span>
                  <span className="text-lg font-bold text-success">+{formatCurrency(getPotentialWin(), mode)}</span>
                </div>
                {hasInsurance && (
                  <div className="flex justify-between text-xs text-primary">
                    <span>If lose (insured)</span>
                    <span>-{formatCurrency(Math.floor(stake * 0.2), mode)}</span>
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
            disabled={!canPlaceBet() || placing}
          >
            {placing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {deadlinePassed
              ? '⏰ Deadline Passed'
              : placing
                ? 'Placing Bet...'
                : selectedCategories.length > 0
                  ? `Place Combined Bet • ${combinedOdds.toFixed(2)}x`
                  : 'Place Combined Bet'
            }
          </Button>
        </div>
      </div>

      <DuplicateBetDialog
        open={showDuplicateDialog}
        onOpenChange={setShowDuplicateDialog}
        betType="combined"
        remainingSeconds={remainingCooldown}
      />
    </>
  );
}
