import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Swords } from 'lucide-react';
import { createChallenge } from '@/lib/supabase-player-challenges';
import { CITIES, TEMPERATURE_RANGES, RAINFALL_RANGES } from '@/types/supabase-betting';
import { toast } from 'sonner';

interface CreateChallengeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string;
  targetUsername: string;
}

const CreateChallengeDialog = ({ open, onOpenChange, targetUserId, targetUsername }: CreateChallengeDialogProps) => {
  const [stake, setStake] = useState('100');
  const [city, setCity] = useState('');
  const [predictionType, setPredictionType] = useState('temperature');
  const [prediction, setPrediction] = useState('');
  const [loading, setLoading] = useState(false);

  const ranges = predictionType === 'temperature' ? TEMPERATURE_RANGES : RAINFALL_RANGES;

  const handleSubmit = async () => {
    if (!city || !prediction || !stake) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(12, 0, 0, 0);

      await createChallenge({
        challenged_id: targetUserId,
        stake: parseInt(stake),
        city,
        prediction_type: predictionType,
        challenger_prediction: prediction,
        target_date: tomorrow.toISOString(),
      });

      toast.success(`Challenge sent to ${targetUsername}!`, {
        description: `${parseInt(stake).toLocaleString()} points on ${city} ${predictionType}`,
      });
      onOpenChange(false);
      setStake('100');
      setCity('');
      setPrediction('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create challenge');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-primary" />
            Challenge {targetUsername}
          </DialogTitle>
          <DialogDescription>
            Pick a city, category, and your prediction. They'll choose theirs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Stake (points)</Label>
            <Input
              type="number"
              min="10"
              max="5000"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>City</Label>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger>
                <SelectValue placeholder="Select city" />
              </SelectTrigger>
              <SelectContent>
                {CITIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={predictionType} onValueChange={(v) => { setPredictionType(v); setPrediction(''); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="temperature">Temperature</SelectItem>
                <SelectItem value="rainfall">Rainfall</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Your Prediction</Label>
            <Select value={prediction} onValueChange={setPrediction}>
              <SelectTrigger>
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                {ranges.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Swords className="h-4 w-4 mr-2" />}
            Send Challenge
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateChallengeDialog;
