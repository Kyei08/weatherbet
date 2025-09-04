import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft } from 'lucide-react';
import { getUser, addBet, updateUserPoints } from '@/lib/storage';
import { CITIES, TEMPERATURE_RANGES, City } from '@/types/betting';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();

  const user = getUser();

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

  const canPlaceBet = () => {
    const stakeNum = parseInt(stake) || 0;
    return (
      city &&
      predictionType &&
      (predictionType === 'rain' ? rainPrediction : tempRange) &&
      stakeNum >= 10 &&
      stakeNum <= 100 &&
      stakeNum <= user.points
    );
  };

  const handlePlaceBet = () => {
    if (!canPlaceBet()) return;

    const stakeNum = parseInt(stake);
    const predictionValue = predictionType === 'rain' ? rainPrediction : tempRange;

    // Deduct stake from user points
    updateUserPoints(user.points - stakeNum);

    // Add bet
    addBet({
      userId: user.id,
      city: city as City,
      predictionType: predictionType as 'rain' | 'temperature',
      predictionValue: predictionValue as string,
      stake: stakeNum,
      odds: getCurrentOdds(),
      result: 'pending',
    });

    toast({
      title: "Bet Placed!",
      description: `Your ${stakeNum} point bet on ${city} has been placed.`,
    });

    onBetPlaced();
    onBack();
  };

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
              disabled={!canPlaceBet()}
            >
              Place Bet
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BettingSlip;