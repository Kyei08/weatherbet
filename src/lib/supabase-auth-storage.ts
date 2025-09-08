import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type User = Database['public']['Tables']['users']['Row'];
type Bet = Database['public']['Tables']['bets']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type UserInsert = Database['public']['Tables']['users']['Insert'];
type BetInsert = Database['public']['Tables']['bets']['Insert'];
type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];

// Get current authenticated user ID
const getCurrentUserId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
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
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

  if (error) throw error;
};

// User management (for the game-specific user table)
export const getUser = async (): Promise<User | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Try to find existing user
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (existingUser) {
    return existingUser;
  }

  // Create new user if doesn't exist
  const newUser: UserInsert = {
    id: user.id,
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  
  const { error } = await supabase
    .from('users')
    .update({ points })
    .eq('id', user.id);

  if (error) throw error;
};

export const updateUsername = async (username: string): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  
  const { error } = await supabase
    .from('users')
    .update({ username })
    .eq('id', user.id);

  if (error) throw error;
};

// Bet management
export const getBets = async (): Promise<Bet[]> => {
  const { data, error } = await supabase
    .from('bets')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const addBet = async (bet: Omit<BetInsert, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Bet> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  
  const newBet: BetInsert = {
    ...bet,
    user_id: user.id,
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  
  // Delete all user bets first (due to foreign key constraint)
  await supabase.from('bets').delete().eq('user_id', user.id);
  
  // Delete user record
  await supabase.from('users').delete().eq('id', user.id);
  
  // Delete profile
  await supabase.from('profiles').delete().eq('user_id', user.id);
};