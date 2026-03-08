import { supabase } from '@/integrations/supabase/client';

interface RankSnapshot {
  user_id: string;
  username: string;
  rank: number;
  points: number;
  sort_type: string;
  group_id: string;
}

/**
 * Record rank snapshots for all players (throttled to once per hour per sort type).
 * Only the current user's record is inserted (RLS enforces user_id = auth.uid()).
 * We batch-insert the current user's snapshot only.
 */
export const recordRankSnapshot = async (
  currentUserId: string,
  currentUserRank: number,
  currentUserPoints: number,
  currentUsername: string,
  sortType: string,
  groupId: string
): Promise<void> => {
  try {
    // Check if we already have a snapshot for this user+sort in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from('leaderboard_rank_history' as any)
      .select('id')
      .eq('user_id', currentUserId)
      .eq('sort_type', sortType)
      .gte('recorded_at', oneHourAgo)
      .limit(1);

    if (existing && (existing as any[]).length > 0) return; // Already recorded recently

    await supabase.from('leaderboard_rank_history' as any).insert({
      user_id: currentUserId,
      username: currentUsername,
      rank: currentUserRank,
      points: currentUserPoints,
      sort_type: sortType,
      group_id: groupId,
    });
  } catch (err) {
    console.error('Error recording rank snapshot:', err);
  }
};

export interface RankHistoryEntry {
  rank: number;
  points: number;
  sort_type: string;
  recorded_at: string;
}

/**
 * Fetch rank history for a specific user.
 */
export const getRankHistory = async (
  userId: string,
  sortType: string = 'points',
  limit: number = 30
): Promise<RankHistoryEntry[]> => {
  const { data, error } = await supabase
    .from('leaderboard_rank_history' as any)
    .select('rank, points, sort_type, recorded_at')
    .eq('user_id', userId)
    .eq('sort_type', sortType)
    .order('recorded_at', { ascending: true })
    .limit(limit);

  if (error || !data) return [];
  return (data as unknown as RankHistoryEntry[]);
};

/**
 * Fetch the most recent rank snapshot for each user in a group (for rank change indicators).
 * Returns a map of user_id -> previous rank.
 */
export const getPreviousRanks = async (
  groupId: string,
  sortType: string = 'points'
): Promise<Map<string, number>> => {
  // Get the second most recent snapshot per user (skip the latest one which is current)
  const { data, error } = await supabase
    .from('leaderboard_rank_history' as any)
    .select('user_id, rank, recorded_at')
    .eq('group_id', groupId)
    .eq('sort_type', sortType)
    .order('recorded_at', { ascending: false })
    .limit(500);

  if (error || !data) return new Map();

  const entries = data as unknown as { user_id: string; rank: number; recorded_at: string }[];
  
  // Group by user_id, take the second entry (previous snapshot)
  const userSnapshots = new Map<string, { rank: number; recorded_at: string }[]>();
  for (const entry of entries) {
    const list = userSnapshots.get(entry.user_id) || [];
    list.push(entry);
    userSnapshots.set(entry.user_id, list);
  }

  const result = new Map<string, number>();
  for (const [userId, snapshots] of userSnapshots) {
    // snapshots are sorted desc by recorded_at; index 0 is latest, index 1 is previous
    if (snapshots.length >= 2) {
      result.set(userId, snapshots[1].rank);
    }
  }

  return result;
};
