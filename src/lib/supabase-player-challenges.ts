import { supabase } from '@/integrations/supabase/client';

export interface PlayerChallenge {
  id: string;
  challenger_id: string;
  challenged_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'completed' | 'expired' | 'cancelled';
  stake: number;
  city: string;
  prediction_type: string;
  challenger_prediction: string;
  challenged_prediction: string | null;
  target_date: string;
  winner_id: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
  resolved_at: string | null;
}

export interface PlayerChallengeWithUsers extends PlayerChallenge {
  challenger_username: string;
  challenged_username: string;
}

export const createChallenge = async (params: {
  challenged_id: string;
  stake: number;
  city: string;
  prediction_type: string;
  challenger_prediction: string;
  target_date: string;
}): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('player_challenges' as any)
    .insert({
      challenger_id: user.id,
      challenged_id: params.challenged_id,
      stake: params.stake,
      city: params.city,
      prediction_type: params.prediction_type,
      challenger_prediction: params.challenger_prediction,
      target_date: params.target_date,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single();

  if (error) throw error;
  return (data as any).id;
};

export const acceptChallenge = async (
  challengeId: string,
  challenged_prediction: string
): Promise<void> => {
  const { error } = await supabase
    .from('player_challenges' as any)
    .update({
      status: 'accepted',
      challenged_prediction,
      updated_at: new Date().toISOString(),
    })
    .eq('id', challengeId);

  if (error) throw error;
};

export const declineChallenge = async (challengeId: string): Promise<void> => {
  const { error } = await supabase
    .from('player_challenges' as any)
    .update({
      status: 'declined',
      updated_at: new Date().toISOString(),
    })
    .eq('id', challengeId);

  if (error) throw error;
};

export const cancelChallenge = async (challengeId: string): Promise<void> => {
  const { error } = await supabase
    .from('player_challenges' as any)
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', challengeId);

  if (error) throw error;
};

export const getMyChallenges = async (): Promise<PlayerChallengeWithUsers[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('player_challenges' as any)
    .select('*')
    .or(`challenger_id.eq.${user.id},challenged_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  if (!data || data.length === 0) return [];

  // Get all unique user IDs
  const userIds = new Set<string>();
  (data as any[]).forEach((c) => {
    userIds.add(c.challenger_id);
    userIds.add(c.challenged_id);
  });

  // Fetch usernames
  const { data: users } = await supabase
    .from('users')
    .select('id, username')
    .in('id', Array.from(userIds));

  const userMap = new Map<string, string>();
  users?.forEach((u) => userMap.set(u.id, u.username));

  return (data as any[]).map((c) => ({
    ...c,
    challenger_username: userMap.get(c.challenger_id) || 'Unknown',
    challenged_username: userMap.get(c.challenged_id) || 'Unknown',
  }));
};

export const getPendingChallengesCount = async (): Promise<number> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from('player_challenges' as any)
    .select('*', { count: 'exact', head: true })
    .eq('challenged_id', user.id)
    .eq('status', 'pending');

  if (error) return 0;
  return count || 0;
};

export const subscribeToChallenges = (
  userId: string,
  onChallenge: (challenge: any) => void
) => {
  return supabase
    .channel('player-challenges')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'player_challenges',
        filter: `challenged_id=eq.${userId}`,
      },
      (payload) => onChallenge(payload)
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'player_challenges',
        filter: `challenger_id=eq.${userId}`,
      },
      (payload) => onChallenge(payload)
    )
    .subscribe();
};
