import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShoppingCart, Package, Clock, Zap, ArrowLeft } from 'lucide-react';
import { getShopItems, getActivePurchases, purchaseItem, ShopItem, PurchaseWithItem } from '@/lib/supabase-shop';
import { getUserLevelInfo } from '@/lib/level-system';
import { toast } from 'sonner';

interface ShopProps {
  onBack: () => void;
}

export const Shop = ({ onBack }: ShopProps) => {
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [activePurchases, setActivePurchases] = useState<PurchaseWithItem[]>([]);
  const [userPoints, setUserPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    loadShopData();
  }, []);

  const loadShopData = async () => {
    try {
      const [items, purchases, levelInfo] = await Promise.all([
        getShopItems(),
        getActivePurchases(),
        getUserLevelInfo(),
      ]);
      setShopItems(items);
      setActivePurchases(purchases);
      setUserPoints(levelInfo?.points || 0);
    } catch (error) {
      console.error('Error loading shop:', error);
      toast.error('Failed to load shop');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (itemId: string) => {
    setPurchasing(itemId);
    try {
      const success = await purchaseItem(itemId);
      if (success) {
        await loadShopData();
      }
    } catch (error) {
      console.error('Error purchasing item:', error);
      toast.error('Failed to purchase item');
    } finally {
      setPurchasing(null);
    }
  };

  const getItemTypeLabel = (type: string) => {
    switch (type) {
      case 'temp_multiplier':
        return 'Odds Boost';
      case 'bonus_points':
        return 'Instant Bonus';
      case 'stake_boost':
        return 'Stake Boost';
      case 'insurance':
        return 'Protection';
      case 'streak_freeze':
        return 'Streak Shield';
      default:
        return type;
    }
  };

  const formatDuration = (hours: number | null) => {
    if (!hours) return 'One-time use';
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''}`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''}`;
  };

  const getTimeRemaining = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Reward Shop</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Loading shop...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ShoppingCart className="h-8 w-8" />
              Reward Shop
            </h1>
            <p className="text-muted-foreground">Spend your points on powerful boosts</p>
          </div>
          <Badge variant="secondary" className="text-xl px-6 py-3">
            {userPoints.toLocaleString()} pts
          </Badge>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="shop" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="shop">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Shop
            </TabsTrigger>
            <TabsTrigger value="inventory">
              <Package className="h-4 w-4 mr-2" />
              My Items ({activePurchases.length})
            </TabsTrigger>
          </TabsList>

          {/* Shop Tab */}
          <TabsContent value="shop" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shopItems.map((item) => {
                const canAfford = userPoints >= item.price;
                
                return (
                  <Card
                    key={item.id}
                    className={`relative overflow-hidden transition-all ${
                      !canAfford ? 'opacity-60' : 'hover:shadow-lg'
                    }`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-5xl">{item.item_icon}</div>
                        <Badge variant="outline" className="shrink-0">
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
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(item.duration_hours)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-2xl font-bold text-primary">
                          {item.price} pts
                        </span>
                        <Button
                          onClick={() => handlePurchase(item.id)}
                          disabled={!canAfford || purchasing === item.id}
                          size="sm"
                        >
                          {purchasing === item.id ? (
                            'Buying...'
                          ) : canAfford ? (
                            'Buy'
                          ) : (
                            'Not enough'
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Inventory Tab */}
          <TabsContent value="inventory" className="space-y-4">
            {activePurchases.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No active items. Visit the shop to purchase boosts!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activePurchases.map((purchase) => {
                  const timeLeft = getTimeRemaining(purchase.expires_at);
                  
                  return (
                    <Card
                      key={purchase.id}
                      className="relative overflow-hidden border-primary bg-primary/5"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-5xl">{purchase.item.item_icon}</div>
                          <Badge variant="default" className="shrink-0 flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            Active
                          </Badge>
                        </div>
                        <CardTitle className="text-lg">{purchase.item.title}</CardTitle>
                        <CardDescription className="text-sm">
                          {purchase.item.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {timeLeft && (
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">{timeLeft}</span>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Purchased {new Date(purchase.purchased_at).toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
