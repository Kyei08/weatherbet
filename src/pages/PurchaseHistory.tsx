import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Clock, CheckCircle2, XCircle, Calendar, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PurchaseWithItem } from '@/lib/supabase-shop';
import { format } from 'date-fns';

const PurchaseHistory = () => {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState<PurchaseWithItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPurchaseHistory = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/auth');
          return;
        }

        const { data, error } = await supabase
          .from('user_purchases')
          .select(`
            *,
            shop_items (*)
          `)
          .eq('user_id', user.id)
          .order('purchased_at', { ascending: false });

        if (error) throw error;

        const formattedPurchases = (data || []).map(purchase => ({
          ...purchase,
          item: {
            ...(purchase.shop_items as any),
            item_type: (purchase.shop_items as any).item_type,
          },
        })) as PurchaseWithItem[];

        setPurchases(formattedPurchases);
      } catch (error) {
        console.error('Error fetching purchase history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPurchaseHistory();
  }, [navigate]);

  const getStatusBadge = (purchase: PurchaseWithItem) => {
    const now = new Date();
    const expired = purchase.expires_at && new Date(purchase.expires_at) < now;

    if (purchase.used) {
      return (
        <Badge variant="outline" className="bg-muted">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Used
        </Badge>
      );
    }

    if (expired) {
      return (
        <Badge variant="outline" className="bg-destructive/10 text-destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Expired
        </Badge>
      );
    }

    if (purchase.expires_at) {
      return (
        <Badge variant="default" className="bg-primary">
          <Clock className="h-3 w-3 mr-1" />
          Active
        </Badge>
      );
    }

    return (
      <Badge variant="secondary">
        <Sparkles className="h-3 w-3 mr-1" />
        Available
      </Badge>
    );
  };

  const getTotalSpent = () => {
    return purchases.reduce((sum, purchase) => sum + purchase.item.price, 0);
  };

  const getActiveCount = () => {
    const now = new Date();
    return purchases.filter(p => 
      !p.used && (!p.expires_at || new Date(p.expires_at) > now)
    ).length;
  };

  const getUsedCount = () => {
    return purchases.filter(p => p.used).length;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading purchase history...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Purchase History</h1>
            <p className="text-muted-foreground">Track all your shop item purchases</p>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Purchases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{purchases.length}</div>
              <p className="text-xs text-muted-foreground">All-time items bought</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Active Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{getActiveCount()}</div>
              <p className="text-xs text-muted-foreground">Ready to use</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{getTotalSpent().toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Points invested</p>
            </CardContent>
          </Card>
        </div>

        {/* Purchase List */}
        <Card>
          <CardHeader>
            <CardTitle>All Purchases</CardTitle>
          </CardHeader>
          <CardContent>
            {purchases.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No purchases yet</p>
                <p className="text-sm mt-1">Visit the shop to buy items!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {purchases.map((purchase) => (
                  <div
                    key={purchase.id}
                    className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <span className="text-3xl">{purchase.item.item_icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{purchase.item.title}</h3>
                            {getStatusBadge(purchase)}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {purchase.item.description}
                          </p>
                          
                          {/* Purchase Details */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>Purchased: {format(new Date(purchase.purchased_at), 'MMM d, yyyy HH:mm')}</span>
                            </div>
                            
                            {purchase.expires_at && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>Expires: {format(new Date(purchase.expires_at), 'MMM d, yyyy HH:mm')}</span>
                              </div>
                            )}
                            
                            {purchase.used && purchase.used_at && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Used: {format(new Date(purchase.used_at), 'MMM d, yyyy HH:mm')}</span>
                              </div>
                            )}
                          </div>

                          {/* Item Type Badge */}
                          <div className="mt-2">
                            <Badge variant="outline" className="text-xs">
                              {purchase.item.item_type === 'temp_multiplier' && `${purchase.item.item_value}x Multiplier`}
                              {purchase.item.item_type === 'stake_boost' && `+${purchase.item.item_value} Max Stake`}
                              {purchase.item.item_type === 'insurance' && 'Bet Insurance'}
                              {purchase.item.item_type === 'streak_freeze' && 'Streak Freeze'}
                              {purchase.item.item_type === 'bonus_points' && `+${purchase.item.item_value} Points`}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Price Tag */}
                      <div className="text-right">
                        <div className="text-lg font-bold">{purchase.item.price}</div>
                        <div className="text-xs text-muted-foreground">points</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usage Stats */}
        {purchases.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Usage Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Items Used</p>
                  <p className="text-2xl font-bold">{getUsedCount()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Average Price</p>
                  <p className="text-2xl font-bold">
                    {Math.round(getTotalSpent() / purchases.length)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PurchaseHistory;
