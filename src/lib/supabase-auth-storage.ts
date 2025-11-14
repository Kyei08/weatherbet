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
export const getBets = async (limit?: number, currencyType?: 'virtual' | 'real'): Promise<Bet[]> => {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  
  let query = supabase
    .from('bets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  // Filter by currency type if specified
  if (currencyType) {
    query = query.eq('currency_type', currencyType);
  }
    
  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

// Get recent bets for dashboard (optimized)
export const getRecentBets = async (currencyType?: 'virtual' | 'real'): Promise<Bet[]> => {
  return getBets(5, currencyType); // Only fetch 5 most recent
};

export const addBet = async (bet: Omit<BetInsert, 'id' | 'user_id' | 'created_at' | 'updated_at'>, currencyType: 'virtual' | 'real' = 'virtual'): Promise<Bet> => {
  const { data: betId, error } = await supabase.rpc('create_bet_atomic', {
    _city: bet.city,
    _stake: bet.stake,
    _odds: bet.odds,
    _prediction_type: bet.prediction_type,
    _prediction_value: bet.prediction_value,
    _target_date: bet.target_date,
    _expires_at: bet.expires_at,
    _has_insurance: bet.has_insurance || false,
    _insurance_cost: bet.insurance_cost || 0,
    _currency_type: currencyType
  });

  if (error) throw error;

  // Fetch the created bet
  const { data: createdBet, error: fetchError } = await supabase
    .from('bets')
    .select('*')
    .eq('id', betId)
    .single();

  if (fetchError) throw fetchError;
  return createdBet;
};

export const updateBetResult = async (betId: string, result: 'win' | 'loss' | 'cashed_out'): Promise<void> => {
  const { error } = await supabase
    .from('bets')
    .update({ result })
    .eq('id', betId);

  if (error) throw error;
};

export const cashOutBet = async (betId: string, cashoutAmount: number, currencyType: 'virtual' | 'real' = 'virtual'): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  // Update bet status to cashed_out
  const { error: betError } = await supabase
    .from('bets')
    .update({ 
      result: 'cashed_out',
      cashed_out_at: new Date().toISOString(),
      cashout_amount: cashoutAmount
    })
    .eq('id', betId)
    .eq('user_id', userId);

  if (betError) throw betError;

  // Add points using safe function
  await supabase.rpc('update_user_points_safe', {
    user_uuid: userId,
    points_change: cashoutAmount,
    transaction_type: 'cashout',
    reference_id: betId,
    reference_type: 'bet',
    currency_type: currencyType
  });
};

export const getLeaderboard = async () => {
  try {
    const { data, error } = await supabase
      .rpc('get_leaderboard', { limit_count: 10 });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    throw error;
  }
};

// Assign user to a leaderboard group (auto-assigns to available group)
export const assignUserToLeaderboardGroup = async (maxSize: number = 100) => {
  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase.rpc('assign_user_to_leaderboard_group', {
      _user_id: userId,
      _max_size: maxSize
    });
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Error assigning user to leaderboard group:', error);
    throw error;
  }
};

// Get leaderboard for the user's group
export const getGroupLeaderboard = async () => {
  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase.rpc('get_group_leaderboard', {
      _user_id: userId
    });
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error fetching group leaderboard:', error);
    return [];
  }
};

// Get user's leaderboard group info
export const getUserLeaderboardGroup = async () => {
  try {
    const userId = await getCurrentUserId();
    const { data: assignment, error: assignmentError } = await supabase
      .from('user_leaderboard_assignments')
      .select(`
        group_id,
        joined_at,
        leaderboard_groups:group_id (
          id,
          name,
          max_size
        )
      `)
      .eq('user_id', userId)
      .single();
    
    if (assignmentError) throw assignmentError;
    
    // Get user count in the group
    const { count, error: countError } = await supabase
      .from('user_leaderboard_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', assignment.group_id);
    
    if (countError) throw countError;
    
    return {
      ...assignment,
      current_size: count || 0
    };
  } catch (error) {
    console.error('Error fetching user leaderboard group:', error);
    return null;
  }
};

// Challenge management
export const getChallenges = async () => {
  const { data, error } = await supabase
    .from('challenges')
    .select('*')
    .eq('is_active', true)
    .order('reward_points', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getUserChallenges = async () => {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const today = new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('user_challenges')
    .select('*, challenges(*)')
    .eq('user_id', userId)
    .eq('challenge_date', today);

  if (error) throw error;
  return data || [];
};

export const updateChallengeProgress = async (
  challengeId: string,
  progress: number,
  completed: boolean = false
) => {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('user_challenges')
    .upsert({
      user_id: userId,
      challenge_id: challengeId,
      progress,
      completed,
      completed_at: completed ? new Date().toISOString() : null,
      challenge_date: today,
    }, {
      onConflict: 'user_id,challenge_id,challenge_date'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const clearAllUserData = async (): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');
  
  // Delete all user bets first (due to foreign key constraint)
  await supabase.from('bets').delete().eq('user_id', userId);
  
  // Delete user challenges
  await supabase.from('user_challenges').delete().eq('user_id', userId);
  
  // Delete user record
  await supabase.from('users').delete().eq('id', userId);
  
  // Delete profile
  await supabase.from('profiles').delete().eq('user_id', userId);
  
  // Clear cache
  cachedUser = null;
  cacheTime = 0;
};