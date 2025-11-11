import { supabase } from '@/integrations/supabase/client';
import { logAdminAction } from './admin';
import { z } from 'zod';

// Validation schemas
export const shopItemSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(100, 'Title is too long'),
  description: z.string().trim().min(1, 'Description is required').max(500, 'Description is too long'),
  item_type: z.enum(['multiplier', 'insurance', 'stake_boost'], { errorMap: () => ({ message: 'Invalid item type' }) }),
  item_value: z.number().min(0, 'Value must be positive').max(100, 'Value is too high'),
  price: z.number().int().min(1, 'Price must be at least 1').max(100000, 'Price is too high'),
  duration_hours: z.number().int().min(1, 'Duration must be at least 1 hour').max(720, 'Duration too long').nullable(),
  item_icon: z.string().trim().min(1, 'Icon is required'),
  is_active: z.boolean(),
});

export const challengeSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(100, 'Title is too long'),
  description: z.string().trim().min(1, 'Description is required').max(500, 'Description is too long'),
  challenge_type: z.string().trim().min(1, 'Challenge type is required'),
  target_value: z.number().int().min(1, 'Target value must be at least 1').max(1000000, 'Target value is too high'),
  reward_points: z.number().int().min(1, 'Reward must be at least 1').max(100000, 'Reward is too high'),
  is_active: z.boolean(),
});

export const achievementSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(100, 'Title is too long'),
  description: z.string().trim().min(1, 'Description is required').max(500, 'Description is too long'),
  requirement_type: z.string().trim().min(1, 'Requirement type is required'),
  requirement_value: z.number().int().min(1, 'Requirement value must be at least 1').max(1000000, 'Requirement value is too high'),
  points_reward: z.number().int().min(0, 'Points reward must be positive').max(100000, 'Reward is too high'),
  badge_icon: z.string().trim().min(1, 'Badge icon is required'),
  is_active: z.boolean(),
});

// Shop Items
export const getAllShopItems = async () => {
  const { data, error } = await supabase
    .from('shop_items')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const createShopItem = async (item: z.infer<typeof shopItemSchema>) => {
  const validation = shopItemSchema.safeParse(item);
  if (!validation.success) {
    throw new Error(validation.error.errors[0].message);
  }

  const { data, error } = await supabase
    .from('shop_items')
    .insert(validation.data as any)
    .select()
    .single();

  if (error) throw error;

  await logAdminAction('create_shop_item', 'shop_items', data.id, { title: item.title });
  return data;
};

export const updateShopItem = async (id: string, item: Partial<z.infer<typeof shopItemSchema>>) => {
  const { data, error } = await supabase
    .from('shop_items')
    .update(item as any)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await logAdminAction('update_shop_item', 'shop_items', id, { title: data.title });
  return data;
};

export const deleteShopItem = async (id: string) => {
  const { error } = await supabase
    .from('shop_items')
    .delete()
    .eq('id', id);

  if (error) throw error;

  await logAdminAction('delete_shop_item', 'shop_items', id);
};

// Challenges
export const getAllChallenges = async () => {
  const { data, error } = await supabase
    .from('challenges')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const createChallenge = async (challenge: z.infer<typeof challengeSchema>) => {
  const validation = challengeSchema.safeParse(challenge);
  if (!validation.success) {
    throw new Error(validation.error.errors[0].message);
  }

  const { data, error } = await supabase
    .from('challenges')
    .insert(validation.data as any)
    .select()
    .single();

  if (error) throw error;

  await logAdminAction('create_challenge', 'challenges', data.id, { title: challenge.title });
  return data;
};

export const updateChallenge = async (id: string, challenge: Partial<z.infer<typeof challengeSchema>>) => {
  const { data, error } = await supabase
    .from('challenges')
    .update(challenge as any)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await logAdminAction('update_challenge', 'challenges', id, { title: data.title });
  return data;
};

export const deleteChallenge = async (id: string) => {
  const { error } = await supabase
    .from('challenges')
    .delete()
    .eq('id', id);

  if (error) throw error;

  await logAdminAction('delete_challenge', 'challenges', id);
};

// Achievements
export const getAllAchievements = async () => {
  const { data, error } = await supabase
    .from('achievements')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const createAchievement = async (achievement: z.infer<typeof achievementSchema>) => {
  const validation = achievementSchema.safeParse(achievement);
  if (!validation.success) {
    throw new Error(validation.error.errors[0].message);
  }

  const { data, error } = await supabase
    .from('achievements')
    .insert(validation.data as any)
    .select()
    .single();

  if (error) throw error;

  await logAdminAction('create_achievement', 'achievements', data.id, { title: achievement.title });
  return data;
};

export const updateAchievement = async (id: string, achievement: Partial<z.infer<typeof achievementSchema>>) => {
  const { data, error } = await supabase
    .from('achievements')
    .update(achievement as any)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await logAdminAction('update_achievement', 'achievements', id, { title: data.title });
  return data;
};

export const deleteAchievement = async (id: string) => {
  const { error } = await supabase
    .from('achievements')
    .delete()
    .eq('id', id);

  if (error) throw error;

  await logAdminAction('delete_achievement', 'achievements', id);
};
