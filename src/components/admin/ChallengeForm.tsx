import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { createChallenge, updateChallenge, challengeSchema } from '@/lib/admin-content';

interface ChallengeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challenge?: any;
  onSuccess: () => void;
}

export const ChallengeForm = ({ open, onOpenChange, challenge, onSuccess }: ChallengeFormProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    challenge_type: '',
    target_value: 0,
    reward_points: 0,
    is_active: true,
  });

  useEffect(() => {
    if (challenge) {
      setFormData({
        title: challenge.title || '',
        description: challenge.description || '',
        challenge_type: challenge.challenge_type || '',
        target_value: challenge.target_value || 0,
        reward_points: challenge.reward_points || 0,
        is_active: challenge.is_active ?? true,
      });
    } else {
      setFormData({
        title: '',
        description: '',
        challenge_type: '',
        target_value: 0,
        reward_points: 0,
        is_active: true,
      });
    }
  }, [challenge, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validation = challengeSchema.safeParse(formData);
      if (!validation.success) {
        toast({
          title: 'Validation Error',
          description: validation.error.errors[0].message,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      if (challenge) {
        await updateChallenge(challenge.id, formData);
        toast({ title: 'Success', description: 'Challenge updated successfully' });
      } else {
        await createChallenge(formData);
        toast({ title: 'Success', description: 'Challenge created successfully' });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save challenge',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{challenge ? 'Edit Challenge' : 'Create Challenge'}</DialogTitle>
          <DialogDescription>
            {challenge ? 'Update the challenge details' : 'Add a new daily challenge'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Win 5 Bets"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Place and win 5 bets today"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="challenge_type">Challenge Type</Label>
            <Input
              id="challenge_type"
              value={formData.challenge_type}
              onChange={(e) => setFormData({ ...formData, challenge_type: e.target.value })}
              placeholder="bets_won, bets_placed, etc."
              required
            />
            <p className="text-xs text-muted-foreground">
              Common types: bets_won, bets_placed, points_earned, rain_predictions, temp_predictions
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="target_value">Target Value</Label>
              <Input
                id="target_value"
                type="number"
                value={formData.target_value}
                onChange={(e) => setFormData({ ...formData, target_value: parseInt(e.target.value) })}
                placeholder="5"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reward_points">Reward Points</Label>
              <Input
                id="reward_points"
                type="number"
                value={formData.reward_points}
                onChange={(e) => setFormData({ ...formData, reward_points: parseInt(e.target.value) })}
                placeholder="100"
                required
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label htmlFor="is_active">Active (available to users)</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : challenge ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
