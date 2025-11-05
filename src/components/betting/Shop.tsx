import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ShoppingBag, Clock, Zap } from 'lucide-react';
import { getShopItems, purchaseItem, getActivePurchases, ShopItem, PurchaseWithItem } from '@/lib/supabase-shop';
import { getUser } from '@/lib/supabase-auth-storage';
import { toast } from 'sonner';

interface ShopProps {
  onBack: () => void;
}

export const Shop = ({ onBack }: ShopProps) => {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [purchases, setPurchases] = useState<PurchaseWithItem[]>([]);
  const [userPoints, setUserPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    loadShopData();
  }, []);

  const loadShopData = async () => {
    try {
      const [shopItems, activePurchases, userData] = await Promise.all([
        getShopItems(),
        getActivePurchases(),
        getUser(),
      ]);
      
      setItems(shopItems);
      setPurchases(activePurchases);
      if (userData) {
        setUserPoints(userData.points);
      }
    } catch (error) {
      console.error('Error loading shop:', error);
      toast.error('Failed to load shop');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (itemId: string, price: number) => {
    if (purchasing) return;

    if (userPoints < price) {
      toast.error('Not enough points!');
      return;
    }

    setPurchasing(itemId);
    try {
      await purchaseItem(itemId);
      toast.success('Item purchased successfully!');
      await loadShopData();
    } catch (error: any) {
      console.error('Error purchasing item:', error);
      toast.error(error.message || 'Failed to purchase item');
    } finally {
      setPurchasing(null);
    }
  };

  const getItemTypeLabel = (type: string) => {
    switch (type) {
      case 'temp_multiplier':
        return 'Odds Boost';
      case 'bonus_points':
        return 'Instant Points';
      case 'stake_boost':
        return 'Stake Boost';
      case 'insurance':
        return 'Insurance';
      case 'streak_freeze':
        return 'Streak Protection';
      default:
        return type;
    }
  };

  const formatDuration = (hours: number | null) => {
    if (!hours) return 'One-time use';
    if (hours < 24) return `${hours}h duration`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} duration`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <p className="text-muted-foreground">Loading shop...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-lg px-4 py-2">
              💰 {userPoints.toLocaleString()} pts
            </Badge>
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 flex items-center justify-center gap-2">
            <ShoppingBag className="h-8 w-8" />
            Reward Shop
          </h1>
          <p className="text-muted-foreground">
            Spend your points on powerful boosts and items
          </p>
        </div>

        {/* Active Items */}
        {purchases.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Active Items
              </CardTitle>
              <CardDescription>Your currently active boosts and items</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {purchases.map((purchase) => (
                  <div
                    key={purchase.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-primary/5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{purchase.item.item_icon}</span>
                      <div>
                        <p className="font-semibold">{purchase.item.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {purchase.item.description}
                        </p>
                      </div>
                    </div>
                    {purchase.expires_at && (
                      <div className="text-right">
                        <Badge variant="outline" className="gap-1">
                          <Clock className="h-3 w-3" />
                          Expires {new Date(purchase.expires_at).toLocaleDateString()}
                        </Badge>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Shop Items */}
        <Card>
          <CardHeader>
            <CardTitle>Available Items</CardTitle>
            <CardDescription>Purchase power-ups and boosts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => {
                const canAfford = userPoints >= item.price;
                const isPurchasing = purchasing === item.id;

                return (
                  <Card
                    key={item.id}
                    className={`relative overflow-hidden transition-all ${
                      !canAfford ? 'opacity-60' : 'hover:border-primary'
                    }`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-4xl">{item.item_icon}</div>
                        <Badge variant="secondary">
                          {getItemTypeLabel(item.item_type)}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg">{item.title}</CardTitle>
                      <CardDescription className="text-sm">
                        {item.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Duration</span>
                        <span className="font-medium">
                          {formatDuration(item.duration_hours)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold text-primary">
                          {item.price} pts
                        </span>
                      </div>
                      <Button
                        className="w-full"
                        disabled={!canAfford || isPurchasing}
                        onClick={() => handlePurchase(item.id, item.price)}
                      >
                        {isPurchasing ? 'Purchasing...' : canAfford ? 'Purchase' : 'Not Enough Points'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
