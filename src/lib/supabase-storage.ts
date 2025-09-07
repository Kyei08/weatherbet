import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type User = Database['public']['Tables']['users']['Row'];
type Bet = Database['public']['Tables']['bets']['Row'];
type UserInsert = Database['public']['Tables']['users']['Insert'];
type BetInsert = Database['public']['Tables']['bets']['Insert'];

const STORAGE_KEY = 'weather-betting-user-id';

// Validate if string is a proper UUID
const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// Generate UUID v4 (fallback for older browsers)
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback UUID generation for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Get or create current user ID from localStorage
const getCurrentUserId = (): string => {
  let userId = localStorage.getItem(STORAGE_KEY);
  
  // Check if stored ID is valid UUID, if not, generate new one
  if (!userId || !isValidUUID(userId)) {
    userId = generateUUID();
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