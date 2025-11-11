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
import { createAchievement, updateAchievement, achievementSchema } from '@/lib/admin-content';

interface AchievementFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  achievement?: any;
  onSuccess: () => void;
}

export const AchievementForm = ({ open, onOpenChange, achievement, onSuccess }: AchievementFormProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    requirement_type: '',
    requirement_value: 0,
    points_reward: 0,
    badge_icon: '🏆',
    is_active: true,
  });

  useEffect(() => {
    if (achievement) {
      setFormData({
        title: achievement.title || '',
        description: achievement.description || '',
        requirement_type: achievement.requirement_type || '',
        requirement_value: achievement.requirement_value || 0,
        points_reward: achievement.points_reward || 0,
        badge_icon: achievement.badge_icon || '🏆',
        is_active: achievement.is_active ?? true,
      });
    } else {
      setFormData({
        title: '',
        description: '',
        requirement_type: '',
        requirement_value: 0,
        points_reward: 0,
        badge_icon: '🏆',
        is_active: true,
      });
    }
  }, [achievement, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validation = achievementSchema.safeParse(formData);
      if (!validation.success) {
        toast({
          title: 'Validation Error',
          description: validation.error.errors[0].message,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      if (achievement) {
        await updateAchievement(achievement.id, formData);
        toast({ title: 'Success', description: 'Achievement updated successfully' });
      } else {
        await createAchievement(formData);
        toast({ title: 'Success', description: 'Achievement created successfully' });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save achievement',
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
          <DialogTitle>{achievement ? 'Edit Achievement' : 'Create Achievement'}</DialogTitle>
          <DialogDescription>
            {achievement ? 'Update the achievement details' : 'Add a new achievement'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="First Win"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Win your first bet"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="requirement_type">Requirement Type</Label>
              <Input
                id="requirement_type"
                value={formData.requirement_type}
                onChange={(e) => setFormData({ ...formData, requirement_type: e.target.value })}
                placeholder="total_wins, total_bets, etc."
                required
              />
              <p className="text-xs text-muted-foreground">
                Types: total_wins, total_bets, points_earned, win_streak, etc.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="badge_icon">Badge Icon (Emoji)</Label>
              <Input
                id="badge_icon"
                value={formData.badge_icon}
                onChange={(e) => setFormData({ ...formData, badge_icon: e.target.value })}
                placeholder="🏆"
                maxLength={4}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="requirement_value">Requirement Value</Label>
              <Input
                id="requirement_value"
                type="number"
                value={formData.requirement_value}
                onChange={(e) => setFormData({ ...formData, requirement_value: parseInt(e.target.value) })}
                placeholder="1"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="points_reward">Points Reward</Label>
              <Input
                id="points_reward"
                type="number"
                value={formData.points_reward}
                onChange={(e) => setFormData({ ...formData, points_reward: parseInt(e.target.value) })}
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
              {loading ? 'Saving...' : achievement ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
