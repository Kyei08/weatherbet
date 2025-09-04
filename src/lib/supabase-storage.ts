import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type User = Database['public']['Tables']['users']['Row'];
type Bet = Database['public']['Tables']['bets']['Row'];
type UserInsert = Database['public']['Tables']['users']['Insert'];
type BetInsert = Database['public']['Tables']['bets']['Insert'];

const STORAGE_KEY = 'weather-betting-user-id';

// Get or create current user ID from localStorage
const getCurrentUserId = (): string => {
  let userId = localStorage.getItem(STORAGE_KEY);
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(STORAGE_KEY, userId);
  }
  return userId;
};

// User management
export const getUser = async (): Promise<User> => {
  const userId = getCurrentUserId();
  
  // Try to find existing user
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (existingUser) {
    return existingUser;
  }

  // Create new user if doesn't exist
  const newUser: UserInsert = {
    id: userId,
    username: `Player${Math.floor(Math.random() * 10000)}`,
    points: 1000,
  };

  const { data: createdUser, error } = await supabase
    .from('users')
    .insert(newUser)
    .select()
    .single();

  if (error) throw error;
  return createdUser;
};

export const updateUserPoints = async (points: number): Promise<void> => {
  const userId = getCurrentUserId();
  
  const { error } = await supabase
    .from('users')
    .update({ points })
    .eq('id', userId);

  if (error) throw error;
};

export const updateUsername = async (username: string): Promise<void> => {
  const userId = getCurrentUserId();
  
  const { error } = await supabase
    .from('users')
    .update({ username })
    .eq('id', userId);

  if (error) throw error;
};

// Bet management
export const getBets = async (): Promise<Bet[]> => {
  const userId = getCurrentUserId();
  
  const { data, error } = await supabase
    .from('bets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const addBet = async (bet: Omit<BetInsert, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Bet> => {
  const userId = getCurrentUserId();
  
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

export const clearAllData = async (): Promise<void> => {
  const userId = getCurrentUserId();
  
  // Delete all bets first (due to foreign key constraint)
  await supabase.from('bets').delete().eq('user_id', userId);
  
  // Delete user
  await supabase.from('users').delete().eq('id', userId);
  
  // Clear localStorage
  localStorage.removeItem(STORAGE_KEY);
};