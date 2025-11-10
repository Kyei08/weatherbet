import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft } from 'lucide-react';
import { getUser, addBet, updateUserPoints } from '@/lib/supabase-auth-storage';
import { CITIES, TEMPERATURE_RANGES, City } from '@/types/supabase-betting';
import { useToast } from '@/hooks/use-toast';
import WeatherDisplay from './WeatherDisplay';
import { useChallengeTracker } from '@/hooks/useChallengeTracker';
import { useAchievementTracker } from '@/hooks/useAchievementTracker';
import { useLevelSystem } from '@/hooks/useLevelSystem';

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

  const getRainOdds = () => 2.0;
  const getTempOdds = () => {
    const range = TEMPERATURE_RANGES.find(r => r.value === tempRange);
    return range?.odds || 2.0;
  };

  const getCurrentOdds = () => {
    if (predictionType === 'rain') return getRainOdds();
    if (predictionType === 'temperature') return getTempOdds();
    return 0;
  };

  const getPotentialWin = () => {
    const stakeNum = parseInt(stake) || 0;
    return Math.floor(stakeNum * getCurrentOdds());
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
    return (
      city &&
      predictionType &&
      (predictionType === 'rain' ? rainPrediction : tempRange) &&
      betDuration &&
      stakeNum >= 10 &&
      stakeNum <= 100 &&
      stakeNum <= user.points
    );
  };

  const handlePlaceBet = async () => {
    if (!canPlaceBet() || loading) return;

    setLoading(true);
    try {
      const stakeNum = parseInt(stake);
      const predictionValue = predictionType === 'rain' ? rainPrediction : tempRange;

      // Deduct stake from user points
      await updateUserPoints(user.points - stakeNum);

      // Add bet
      const targetDate = getBetDeadline();
      await addBet({
        city: city as City,
        prediction_type: predictionType as 'rain' | 'temperature',
        prediction_value: predictionValue as string,
        stake: stakeNum,
        odds: getCurrentOdds(),
        result: 'pending',
        target_date: targetDate,
        expires_at: targetDate,
        bet_duration_days: parseInt(betDuration),
      } as any);

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
        description: `Your ${stakeNum} point bet on ${city} has been placed.`,
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

            {/* Prediction Type */}
            <div className="space-y-3">
              <Label>Prediction Type</Label>
              <RadioGroup value={predictionType} onValueChange={(value) => setPredictionType(value as 'rain' | 'temperature')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="rain" id="rain" />
                  <Label htmlFor="rain">Rain Prediction (2.0x odds)</Label>
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
                    <Label htmlFor="rain-yes">Yes (2.0x)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="rain-no" />
                    <Label htmlFor="rain-no">No (2.0x)</Label>
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
                        {range.label} ({range.odds}x odds)
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
              <Label>Stake (10-100 points)</Label>
              <Input
                type="number"
                min="10"
                max="100"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                placeholder="Enter stake amount"
              />
            </div>

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
                    <div className="flex justify-between">
                      <span>Odds:</span>
                      <span className="font-medium">{getCurrentOdds()}x</span>
                    </div>
                    <div className="flex justify-between font-bold text-primary">
                      <span>Potential Win:</span>
                      <span>{getPotentialWin()} points</span>
                    </div>
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