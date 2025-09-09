import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type User = Database['public']['Tables']['users']['Row'];
type Bet = Database['public']['Tables']['bets']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type UserInsert = Database['public']['Tables']['users']['Insert'];
type BetInsert = Database['public']['Tables']['bets']['Insert'];
type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];

// Cached user for efficiency
let cachedUser: any = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Get current authenticated user ID with caching
const getCurrentUserId = async (): Promise<string | null> => {
  const now = Date.now();
  if (cachedUser && (now - cacheTime) < CACHE_DURATION) {
    return cachedUser?.id ?? null;
  }
  
  const { data: { user } } = await supabase.auth.getUser();
  cachedUser = user;
  cacheTime = now;
  return user?.id ?? null;
};

// Profile management
export const getProfile = async (): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  return data;
};

export const updateProfile = async (updates: Partial<ProfileInsert>): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');
  
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('user_id', userId);

  if (error) throw error;
};

// User management (for the game-specific user table) - Optimized
export const getUser = async (): Promise<User | null> => {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  // Try to find existing user with upsert pattern
  const { data: existingUser, error: selectError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (selectError && selectError.code !== 'PGRST116') {
    throw selectError;
  }

  if (existingUser) {
    return existingUser;
  }

  // Create new user if doesn't exist using upsert
  const newUser: UserInsert = {
    id: userId,
    username: `Player${Math.floor(Math.random() * 10000)}`,
    points: 1000,
  };

  const { data: createdUser, error } = await supabase
    .from('users')
    .upsert(newUser, { onConflict: 'id' })
    .select()
    .single();

  if (error) throw error;
  return createdUser;
};

export const updateUserPoints = async (points: number): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');
  
  const { error } = await supabase
    .from('users')
    .update({ points })
    .eq('id', userId);

  if (error) throw error;
};

export const updateUsername = async (username: string): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');
  
  const { error } = await supabase
    .from('users')
    .update({ username })
    .eq('id', userId);

  if (error) throw error;
};

// Bet management - Optimized queries
export const getBets = async (limit?: number): Promise<Bet[]> => {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  
  let query = supabase
    .from('bets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
    
  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

// Get recent bets for dashboard (optimized)
export const getRecentBets = async (): Promise<Bet[]> => {
  return getBets(5); // Only fetch 5 most recent
};

export const addBet = async (bet: Omit<BetInsert, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Bet> => {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');
  
  const newBet: BetInsert = {
    ...bet,
    user_id: userId,
  };

  const { data, error } = await supabase
    .from('bets')
    .insert(newBet)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateBetResult = async (betId: string, result: 'win' | 'loss'): Promise<void> => {
  const { error } = await supabase
    .from('bets')
    .update({ result })
    .eq('id', betId);

  if (error) throw error;
};

export const getLeaderboard = async (): Promise<User[]> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('points', { ascending: false })
    .limit(10);

  if (error) throw error;
  return data || [];
};

export const clearAllUserData = async (): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');
  
  // Delete all user bets first (due to foreign key constraint)
  await supabase.from('bets').delete().eq('user_id', userId);
  
  // Delete user record
  await supabase.from('users').delete().eq('id', userId);
  
  // Delete profile
  await supabase.from('profiles').delete().eq('user_id', userId);
  
  // Clear cache
  cachedUser = null;
  cacheTime = 0;
};