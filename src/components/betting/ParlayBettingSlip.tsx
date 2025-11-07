import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft, Plus, X, TrendingUp, Activity } from 'lucide-react';
import { CITIES, TEMPERATURE_RANGES } from '@/types/betting';
import { createParlay, ParlayPrediction } from '@/lib/supabase-parlays';
import { getUser, updateUserPoints } from '@/lib/supabase-auth-storage';
import { useToast } from '@/hooks/use-toast';
import { useChallengeTracker } from '@/hooks/useChallengeTracker';
import { useAchievementTracker } from '@/hooks/useAchievementTracker';
import { useLevelSystem } from '@/hooks/useLevelSystem';
import { calculateDynamicOdds, formatLiveOdds } from '@/lib/dynamic-odds';
import { supabase } from '@/integrations/supabase/client';

interface ParlayBettingSlipProps {
  onBack: () => void;
  onBetPlaced: () => void;
}

interface PredictionFormData {
  id: string;
  city: string;
  predictionType: 'rain' | 'temperature';
  rainPrediction: 'yes' | 'no';
  temperatureRange: string;
}

const ParlayBettingSlip = ({ onBack, onBetPlaced }: ParlayBettingSlipProps) => {
  const [predictions, setPredictions] = useState<PredictionFormData[]>([
    {
      id: crypto.randomUUID(),
      city: '',
      predictionType: 'rain',
      rainPrediction: 'yes',
      temperatureRange: '20-25',
    },
  ]);
  const [stake, setStake] = useState('');
  const [betDuration, setBetDuration] = useState('1');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [weatherForecasts, setWeatherForecasts] = useState<Record<string, any[]>>({});
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
        temperatureRange: '20-25',
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

    const predictionValue = pred.predictionType === 'rain' 
      ? pred.rainPrediction 
      : pred.temperatureRange;

    // Use dynamic odds if we have forecast data for this city
    const forecast = weatherForecasts[pred.city];
    if (forecast && forecast.length > 0) {
      return calculateDynamicOdds({
        predictionType: pred.predictionType,
        predictionValue,
        forecast,
        daysAhead: parseInt(betDuration) || 1,
      });
    }

    // Fallback to static odds
    if (pred.predictionType === 'rain') return 1.8;
    const tempRange = TEMPERATURE_RANGES.find(r => r.value === pred.temperatureRange);
    return tempRange?.odds || 2.0;
  };

  const getCombinedOdds = (): number => {
    return predictions.reduce((total, pred) => {
      if (!pred.city) return total;
      return total * getPredictionOdds(pred);
    }, 1);
  };

  const getPotentialWin = (): number => {
    const stakeNum = parseInt(stake) || 0;
    return Math.floor(stakeNum * getCombinedOdds());
  };

  const canPlaceParlay = (): boolean => {
    if (predictions.length < 2) return false;
    if (!predictions.every(p => p.city)) return false;
    
    const stakeNum = parseInt(stake);
    if (!stakeNum || stakeNum < 10 || stakeNum > (user?.points || 0)) return false;
    
    // Check for duplicate city predictions
    const cities = predictions.map(p => p.city);
    const uniqueCities = new Set(cities);
    if (cities.length !== uniqueCities.size) return false;

    return true;
  };

  const handlePlaceParlay = async () => {
    if (!canPlaceParlay()) return;

    setLoading(true);
    try {
      const stakeNum = parseInt(stake);
      
      // Convert predictions to the format needed
      const parlayPredictions: ParlayPrediction[] = predictions.map(pred => ({
        city: pred.city,
        predictionType: pred.predictionType,
        predictionValue: pred.predictionType === 'rain' 
          ? pred.rainPrediction 
          : pred.temperatureRange,
        odds: getPredictionOdds(pred),
      }));

      // Deduct stake
      await updateUserPoints(user.points - stakeNum);

      // Create parlay
      await createParlay(stakeNum, parlayPredictions, parseInt(betDuration));

      // Track achievements and challenges
      await checkAndUpdateChallenges('bet_placed', { 
        stake: stakeNum, 
        city: predictions[0].city 
      });
      await checkAchievements();
      await awardXPForAction('BET_PLACED');

      toast({
        title: 'Parlay Placed! 🎯',
        description: `${predictions.length}-leg parlay with ${getCombinedOdds().toFixed(2)}x odds. Good luck!`,
      });

      onBetPlaced();
      onBack();
    } catch (error: any) {
      console.error('Error placing parlay:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to place parlay',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
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
          <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg">
            <Activity className="h-4 w-4 text-primary animate-pulse" />
            <span className="text-sm font-medium">Live Odds Active</span>
            <span className="text-xs text-muted-foreground ml-auto">
              Based on current forecasts
            </span>
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
                      updatePrediction(pred.id, { predictionType: value as 'rain' | 'temperature' })
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="rain" id={`${pred.id}-rain`} />
                      <Label htmlFor={`${pred.id}-rain`}>Rain</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="temperature" id={`${pred.id}-temp`} />
                      <Label htmlFor={`${pred.id}-temp`}>Temperature</Label>
                    </div>
                  </RadioGroup>
                </div>

                {pred.predictionType === 'rain' ? (
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
                ) : (
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
              </div>
            </Card>
          ))}
        </div>

        {/* Stake and Duration */}
        <div className="space-y-4">
          <div>
            <Label>Bet Duration</Label>
            <Select value={betDuration} onValueChange={setBetDuration}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Day</SelectItem>
                <SelectItem value="3">3 Days</SelectItem>
                <SelectItem value="7">7 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Stake (Points)</Label>
            <Input
              type="number"
              placeholder="Minimum 10 points"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              min="10"
              max={user.points}
            />
            <p className="text-sm text-muted-foreground mt-1">
              Available: {user.points} points
            </p>
          </div>
        </div>

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
              </span>
            </div>
            <div className="flex justify-between">
              <span>Stake:</span>
              <span className="font-medium">{stake} points</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-primary">
              <span>Potential Win:</span>
              <span>{getPotentialWin()} points</span>
            </div>
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
          disabled={!canPlaceParlay() || loading}
        >
          {loading ? 'Placing Parlay...' : 'Place Parlay Bet'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ParlayBettingSlip;
