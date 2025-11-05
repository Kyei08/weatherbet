import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ShopItem {
  id: string;
  title: string;
  description: string;
  item_icon: string;
  item_type: 'temp_multiplier' | 'bonus_points' | 'stake_boost' | 'insurance' | 'streak_freeze';
  item_value: number;
  duration_hours: number | null;
  price: number;
  is_active: boolean;
  created_at: string;
}

export interface UserPurchase {
  id: string;
  user_id: string;
  item_id: string;
  purchased_at: string;
  expires_at: string | null;
  used: boolean;
  used_at: string | null;
  created_at: string;
}

export interface PurchaseWithItem extends UserPurchase {
  item: ShopItem;
}

// Get all active shop items
export const getShopItems = async (): Promise<ShopItem[]> => {
  const { data, error } = await supabase
    .from('shop_items')
    .select('*')
    .eq('is_active', true)
    .order('price', { ascending: true });

  if (error) throw error;
  return (data || []).map(item => ({
    ...item,
    item_type: item.item_type as ShopItem['item_type'],
  }));
};

// Get user's active purchases (not used and not expired)
export const getActivePurchases = async (): Promise<PurchaseWithItem[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const now = new Date().toISOString();

  const { data: purchases, error } = await supabase
    .from('user_purchases')
    .select('*, item:shop_items(*)')
    .eq('user_id', user.id)
    .eq('used', false)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('purchased_at', { ascending: false });

  if (error) throw error;

  return (purchases || []).map(purchase => ({
    ...purchase,
    item: {
      ...purchase.item,
      item_type: purchase.item.item_type as ShopItem['item_type'],
    } as ShopItem,
  })) as PurchaseWithItem[];
};

// Purchase an item
export const purchaseItem = async (itemId: string): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Get item details
  const { data: item, error: itemError } = await supabase
    .from('shop_items')
    .select('*')
    .eq('id', itemId)
    .single();

  if (itemError) throw itemError;
  if (!item) throw new Error('Item not found');

  // Get user points
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('points')
    .eq('id', user.id)
    .single();

  if (userError) throw userError;
  if (!userData) throw new Error('User data not found');

  // Check if user has enough points
  if (userData.points < item.price) {
    toast.error('Not enough points to purchase this item!');
    return false;
  }

  // Deduct points
  const { error: updateError } = await supabase
    .from('users')
    .update({ points: userData.points - item.price })
    .eq('id', user.id);

  if (updateError) throw updateError;

  // Calculate expiration if duration is set
  let expiresAt = null;
  if (item.duration_hours) {
    const expires = new Date();
    expires.setHours(expires.getHours() + item.duration_hours);
    expiresAt = expires.toISOString();
  }

  // Create purchase record
  const { error: purchaseError } = await supabase
    .from('user_purchases')
    .insert({
      user_id: user.id,
      item_id: itemId,
      expires_at: expiresAt,
    });

  if (purchaseError) throw purchaseError;

  // Apply instant effects
  if (item.item_type === 'bonus_points') {
    await supabase
      .from('users')
      .update({ points: userData.points - item.price + item.item_value })
      .eq('id', user.id);
  }

  toast.success(`${item.title} purchased successfully!`);
  return true;
};

// Use a purchased item (for one-time use items)
export const useItem = async (purchaseId: string): Promise<void> => {
  const { error } = await supabase
    .from('user_purchases')
    .update({
      used: true,
      used_at: new Date().toISOString(),
    })
    .eq('id', purchaseId);

  if (error) throw error;
};

// Get active multiplier bonuses from purchases
export const getActiveMultipliers = async (): Promise<number> => {
  const purchases = await getActivePurchases();
  let multiplier = 1;

  for (const purchase of purchases) {
    if (purchase.item.item_type === 'temp_multiplier' && !purchase.used) {
      multiplier *= purchase.item.item_value;
    }
  }

  return multiplier;
};

// Check if user has active insurance
export const hasActiveInsurance = async (): Promise<UserPurchase | null> => {
  const purchases = await getActivePurchases();
  return purchases.find(p => p.item.item_type === 'insurance' && !p.used) || null;
};

// Check if user has active streak freeze
export const hasActiveStreakFreeze = async (): Promise<UserPurchase | null> => {
  const purchases = await getActivePurchases();
  return purchases.find(p => p.item.item_type === 'streak_freeze' && !p.used) || null;
};

// Get max stake boost from purchases
export const getMaxStakeBoost = async (): Promise<number> => {
  const purchases = await getActivePurchases();
  let maxBoost = 0;

  for (const purchase of purchases) {
    if (purchase.item.item_type === 'stake_boost' && !purchase.used) {
      maxBoost = Math.max(maxBoost, purchase.item.item_value);
    }
  }

  return maxBoost;
};
