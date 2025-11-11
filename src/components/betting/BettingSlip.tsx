import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowLeft, Activity, Sparkles, Clock, Zap, Info } from 'lucide-react';
import { getUser, addBet, updateUserPoints } from '@/lib/supabase-auth-storage';
import { CITIES, TEMPERATURE_RANGES, City } from '@/types/supabase-betting';
import { useToast } from '@/hooks/use-toast';
import WeatherDisplay from './WeatherDisplay';
import { useChallengeTracker } from '@/hooks/useChallengeTracker';
import { useAchievementTracker } from '@/hooks/useAchievementTracker';
import { useLevelSystem } from '@/hooks/useLevelSystem';
import { calculateDynamicOdds, formatLiveOdds, getProbabilityPercentage } from '@/lib/dynamic-odds';
import { supabase } from '@/integrations/supabase/client';
import { getActivePurchases, getActiveMultipliers, getMaxStakeBoost, PurchaseWithItem, useItem } from '@/lib/supabase-shop';
import { recordBonusEarning } from '@/lib/supabase-bonus-tracker';
import { z } from 'zod';

const betSchema = z.object({
  city: z.string().trim().min(1, 'City is required'),
  stake: z.number().int('Stake must be a whole number').min(10, 'Minimum stake is 10 points').max(100000, 'Maximum stake is 100,000 points'),
  betDuration: z.number().int().min(1, 'Duration must be at least 1 day').max(7, 'Maximum duration is 7 days'),
  predictionType: z.enum(['rain', 'temperature'] as const, { errorMap: () => ({ message: 'Invalid prediction type' }) }),
});

interface BettingSlipProps {
  onBack: () => void;
  onBetPlaced: () => void;
}

const BettingSlip = ({ onBack, onBetPlaced }: BettingSlipProps) => {
  const [city, setCity] = useState<City | ''>('');
  const [predictionType, setPredictionType] = useState<'rain' | 'temperature' | ''>('');
  const [rainPrediction, setRainPrediction] = useState<'yes' | 'no' | ''>('');
  const [tempRange, setTempRange] = useState<string>('');
  const [stake, setStake] = useState<string>('');
  const [betDuration, setBetDuration] = useState<string>('');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
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

  const getCurrentOdds = () => {
    if (!predictionType || !betDuration) return 0;
    
    const predictionValue = predictionType === 'rain' ? rainPrediction : tempRange;
    if (!predictionValue) return 0;

    // Use dynamic odds if we have forecast data
    if (weatherForecast.length > 0) {
      return calculateDynamicOdds({
        predictionType,
        predictionValue,
        forecast: weatherForecast,
        daysAhead: parseInt(betDuration) || 1,
      });
    }

    // Fallback to static odds
    if (predictionType === 'rain') return 2.0;
    const range = TEMPERATURE_RANGES.find(r => r.value === tempRange);
    return range?.odds || 2.0;
  };

  const getCurrentProbability = () => {
    if (!predictionType || !betDuration || weatherForecast.length === 0) return null;
    
    const predictionValue = predictionType === 'rain' ? rainPrediction : tempRange;
    if (!predictionValue) return null;

    return getProbabilityPercentage(
      predictionType,
      predictionValue,
      weatherForecast,
      parseInt(betDuration) || 1
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
    return 100 + maxStakeBoost;
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
    const now = new Date();
    const daysToAdd = parseInt(betDuration);
    const deadline = new Date(now);
    deadline.setDate(deadline.getDate() + daysToAdd);
    return deadline.toISOString();
  };

  const canPlaceBet = () => {
    const stakeNum = parseInt(stake) || 0;
    const totalCost = getTotalCost();
    return (
      city &&
      predictionType &&
      (predictionType === 'rain' ? rainPrediction : tempRange) &&
      betDuration &&
      stakeNum >= 10 &&
      stakeNum <= getMaxStake() &&
      totalCost <= user.points
    );
  };

  const handlePlaceBet = async () => {
    if (!canPlaceBet() || loading) return;

    setLoading(true);

    // Validate inputs
    const validation = betSchema.safeParse({
      city,
      stake: parseInt(stake),
      betDuration: parseInt(betDuration),
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
      return;
    }

    try {
      const stakeNum = parseInt(stake);
      const predictionValue = predictionType === 'rain' ? rainPrediction : tempRange;
      const totalCost = getTotalCost();

      // Deduct total cost (stake + insurance) from user points
      await updateUserPoints(user.points - totalCost);

      // Add bet
      const targetDate = getBetDeadline();
      const betData = await addBet({
        city: city as City,
        prediction_type: predictionType as 'rain' | 'temperature',
        prediction_value: predictionValue as string,
        stake: stakeNum,
        odds: getCurrentOdds(),
        result: 'pending',
        target_date: targetDate,
        expires_at: targetDate,
        bet_duration_days: parseInt(betDuration),
        has_insurance: hasInsurance,
        insurance_cost: hasInsurance ? getInsuranceCost() : 0,
        insurance_payout_percentage: 0.8,
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
        title: "Bet Placed!",
        description: hasInsurance 
          ? `Your ${stakeNum} point bet on ${city} has been placed with insurance protection.`
          : `Your ${stakeNum} point bet on ${city} has been placed.`,
      });

      onBetPlaced();
      onBack();
    } catch (error) {
      console.error('Error placing bet:', error);
      toast({
        title: "Error",
        description: "Failed to place bet. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
            <p className="text-muted-foreground">Available Balance: {user.points.toLocaleString()} points</p>
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
              <Label>Prediction Type</Label>
              <RadioGroup value={predictionType} onValueChange={(value) => setPredictionType(value as 'rain' | 'temperature')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="rain" id="rain" />
                  <Label htmlFor="rain">Rain Prediction</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="temperature" id="temperature" />
                  <Label htmlFor="temperature">Temperature Range</Label>
                </div>
              </RadioGroup>
            </div>

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

            {/* Bet Duration/Deadline */}
            <div className="space-y-2">
              <Label>Bet Deadline</Label>
              <Select value={betDuration} onValueChange={setBetDuration}>
                <SelectTrigger>
                  <SelectValue placeholder="When should this bet be resolved?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Tomorrow (24 hours)</SelectItem>
                  <SelectItem value="2">2 Days</SelectItem>
                  <SelectItem value="3">3 Days</SelectItem>
                  <SelectItem value="7">1 Week</SelectItem>
                  <SelectItem value="14">2 Weeks</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Stake */}
            <div className="space-y-2">
              <Label>
                Stake (10-{getMaxStake()} points)
                {maxStakeBoost > 0 && (
                  <span className="ml-2 text-xs text-primary font-medium">
                    +{maxStakeBoost} from boost!
                  </span>
                )}
              </Label>
              <Input
                type="number"
                min="10"
                max={getMaxStake()}
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                placeholder="Enter stake amount"
              />
            </div>

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
                        Protect your bet! If you lose, get back <span className="font-medium text-foreground">{getInsurancePayout()} points</span> (80% of stake)
                      </p>
                      <div className="flex items-center justify-between text-sm">
                        <span>Insurance Cost:</span>
                        <span className="font-medium">{getInsuranceCost()} points (15% of stake)</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Bet Summary */}
            {city && predictionType && (predictionType === 'rain' ? rainPrediction : tempRange) && stake && betDuration && (
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
                      <span>Deadline:</span>
                      <span className="font-medium">
                        {betDuration === '1' ? 'Tomorrow' : `${betDuration} days`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Stake:</span>
                      <span className="font-medium">{stake} points</span>
                    </div>
                    {hasInsurance && (
                      <>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Insurance:</span>
                          <span>+{getInsuranceCost()} points</span>
                        </div>
                        <div className="flex justify-between font-medium border-t pt-2">
                          <span>Total Cost:</span>
                          <span>{getTotalCost()} points</span>
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
                                <p className="text-xs">This means for every 100 points wagered across all bets, the house keeps 10 points on average to maintain the platform.</p>
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
                          <span>{getBaseWin()} points</span>
                        </div>
                        <div className="flex justify-between text-primary">
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            Multiplier ({activeMultiplier}x):
                          </span>
                          <span>+{getPotentialWin() - getBaseWin()} points</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between font-bold text-success">
                      <span>If Win:</span>
                      <span>+{getPotentialWin()} points</span>
                    </div>
                    {hasInsurance && (
                      <div className="flex justify-between font-bold text-primary">
                        <span>If Lose (Insured):</span>
                        <span>-{parseInt(stake) - getInsurancePayout()} points</span>
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
              disabled={!canPlaceBet() || loading}
            >
              {loading ? 'Placing Bet...' : 'Place Bet'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BettingSlip;