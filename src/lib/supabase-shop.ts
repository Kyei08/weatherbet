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

// Get user's active purchases (not used or not expired)
export const getActivePurchases = async (): Promise<PurchaseWithItem[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const now = new Date().toISOString();

  const { data: purchases, error } = await supabase
    .from('user_purchases')
    .select('*')
    .eq('user_id', user.id)
    .eq('used', false)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('purchased_at', { ascending: false });

  if (error) throw error;
  if (!purchases) return [];

  // Fetch shop items separately
  const itemIds = purchases.map(p => p.item_id);
  const { data: items } = await supabase
    .from('shop_items')
    .select('*')
    .in('id', itemIds);

  if (!items) return [];

  // Combine purchases with their items
  return purchases.map(purchase => {
    const item = items.find(i => i.id === purchase.item_id);
    return {
      ...purchase,
      item: {
        ...item,
        item_type: item?.item_type as ShopItem['item_type'],
      } as ShopItem,
    };
  }) as PurchaseWithItem[];
};

// Purchase an item
export const purchaseItem = async (itemId: string): Promise<void> => {
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
  if (!userData) throw new Error('User not found');

  // Check if user has enough points
  if (userData.points < item.price) {
    throw new Error('Not enough points');
  }

  // Deduct points
  const { error: updateError } = await supabase
    .from('users')
    .update({ points: userData.points - item.price })
    .eq('id', user.id);

  if (updateError) throw updateError;

  // Calculate expiration if duration-based
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
};

// Use a purchased item (for one-time use items)
export const useItem = async (purchaseId: string): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('user_purchases')
    .update({
      used: true,
      used_at: new Date().toISOString(),
    })
    .eq('id', purchaseId)
    .eq('user_id', user.id);

  if (error) throw error;
};

// Get active boosts for betting calculations
export interface ActiveBoosts {
  oddsMultiplier: number;
  maxStakeBoost: number;
  hasInsurance: boolean;
  insuranceValue: number;
  hasStreakFreeze: boolean;
}

export const getActiveBoosts = async (): Promise<ActiveBoosts> => {
  const purchases = await getActivePurchases();
  
  const boosts: ActiveBoosts = {
    oddsMultiplier: 1,
    maxStakeBoost: 0,
    hasInsurance: false,
    insuranceValue: 0,
    hasStreakFreeze: false,
  };

  for (const purchase of purchases) {
    const item = purchase.item;
    
    switch (item.item_type) {
      case 'temp_multiplier':
        boosts.oddsMultiplier *= item.item_value;
        break;
      case 'stake_boost':
        boosts.maxStakeBoost = Math.max(boosts.maxStakeBoost, item.item_value);
        break;
      case 'insurance':
        boosts.hasInsurance = true;
        boosts.insuranceValue = item.item_value;
        break;
      case 'streak_freeze':
        boosts.hasStreakFreeze = true;
        break;
    }
  }

  return boosts;
};

// Apply insurance after a loss
export const applyInsurance = async (stakeAmount: number): Promise<number> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const purchases = await getActivePurchases();
  const insurancePurchase = purchases.find(p => p.item.item_type === 'insurance');

  if (!insurancePurchase) return 0;

  // Mark insurance as used
  await useItem(insurancePurchase.id);

  // Calculate refund
  const refund = Math.floor(stakeAmount * insurancePurchase.item.item_value);

  // Add refund to user points
  const { data: userData } = await supabase
    .from('users')
    .select('points')
    .eq('id', user.id)
    .single();

  if (userData) {
    await supabase
      .from('users')
      .update({ points: userData.points + refund })
      .eq('id', user.id);
  }

  return refund;
};
