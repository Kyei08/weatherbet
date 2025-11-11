import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { createShopItem, updateShopItem, shopItemSchema } from '@/lib/admin-content';

interface ShopItemFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: any;
  onSuccess: () => void;
}

export const ShopItemForm = ({ open, onOpenChange, item, onSuccess }: ShopItemFormProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    item_type: 'multiplier' as 'multiplier' | 'insurance' | 'stake_boost',
    item_value: 0,
    price: 0,
    duration_hours: 24,
    item_icon: '⚡',
    is_active: true,
  });

  useEffect(() => {
    if (item) {
      setFormData({
        title: item.title || '',
        description: item.description || '',
        item_type: item.item_type || 'multiplier',
        item_value: item.item_value || 0,
        price: item.price || 0,
        duration_hours: item.duration_hours || 24,
        item_icon: item.item_icon || '⚡',
        is_active: item.is_active ?? true,
      });
    } else {
      setFormData({
        title: '',
        description: '',
        item_type: 'multiplier',
        item_value: 0,
        price: 0,
        duration_hours: 24,
        item_icon: '⚡',
        is_active: true,
      });
    }
  }, [item, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validation = shopItemSchema.safeParse(formData);
      if (!validation.success) {
        toast({
          title: 'Validation Error',
          description: validation.error.errors[0].message,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      if (item) {
        await updateShopItem(item.id, formData);
        toast({ title: 'Success', description: 'Shop item updated successfully' });
      } else {
        await createShopItem(formData);
        toast({ title: 'Success', description: 'Shop item created successfully' });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save shop item',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit Shop Item' : 'Create Shop Item'}</DialogTitle>
          <DialogDescription>
            {item ? 'Update the shop item details' : 'Add a new item to the shop'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="2x Win Multiplier"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Double your winnings for 24 hours"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="item_type">Item Type</Label>
              <Select
                value={formData.item_type}
                onValueChange={(value: any) => setFormData({ ...formData, item_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="multiplier">Multiplier</SelectItem>
                  <SelectItem value="insurance">Insurance</SelectItem>
                  <SelectItem value="stake_boost">Stake Boost</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="item_icon">Icon (Emoji)</Label>
              <Input
                id="item_icon"
                value={formData.item_icon}
                onChange={(e) => setFormData({ ...formData, item_icon: e.target.value })}
                placeholder="⚡"
                maxLength={4}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="item_value">Value</Label>
              <Input
                id="item_value"
                type="number"
                step="0.01"
                value={formData.item_value}
                onChange={(e) => setFormData({ ...formData, item_value: parseFloat(e.target.value) })}
                placeholder="2.0"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Price (Points)</Label>
              <Input
                id="price"
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) })}
                placeholder="500"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration_hours">Duration (Hours)</Label>
              <Input
                id="duration_hours"
                type="number"
                value={formData.duration_hours}
                onChange={(e) => setFormData({ ...formData, duration_hours: parseInt(e.target.value) })}
                placeholder="24"
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
            <Label htmlFor="is_active">Active (visible to users)</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : item ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
