import { supabase } from '@/integrations/supabase/client';

// Follow a user
export const followUser = async (followingId: string): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('user_follows' as any)
    .insert({ follower_id: user.id, following_id: followingId });

  if (error) throw error;

  // Create notification for the followed user
  await supabase.from('notifications').insert({
    user_id: followingId,
    title: 'New Follower!',
    message: 'Someone started following you.',
    type: 'social',
  });
};

// Unfollow a user
export const unfollowUser = async (followingId: string): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('user_follows' as any)
    .delete()
    .eq('follower_id', user.id)
    .eq('following_id', followingId);

  if (error) throw error;
};

// Check if current user follows a specific user
export const isFollowing = async (followingId: string): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from('user_follows' as any)
    .select('id')
    .eq('follower_id', user.id)
    .eq('following_id', followingId)
    .maybeSingle();

  if (error) return false;
  return !!data;
};

// Get follower & following counts for a user
export const getFollowCounts = async (userId: string): Promise<{ followers: number; following: number }> => {
  const [followersRes, followingRes] = await Promise.all([
    supabase.from('user_follows' as any).select('id', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('user_follows' as any).select('id', { count: 'exact', head: true }).eq('follower_id', userId),
  ]);

  return {
    followers: followersRes.count ?? 0,
    following: followingRes.count ?? 0,
  };
};

// Get list of users that the current user follows (with their info)
export const getFollowingList = async (): Promise<Array<{ user_id: string; username: string; points: number; level: number; avatar_url: string | null; bio: string | null; created_at: string }>> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get follow records
  const { data: follows, error } = await supabase
    .from('user_follows' as any)
    .select('following_id, created_at')
    .eq('follower_id', user.id)
    .order('created_at', { ascending: false });

  if (error || !follows || follows.length === 0) return [];

  const followingIds = follows.map((f: any) => f.following_id);

  // Get user data and profiles in parallel
  const [usersRes, profilesRes] = await Promise.all([
    supabase.from('users').select('id, username, points, level').in('id', followingIds),
    supabase.from('profiles').select('user_id, avatar_url, bio').in('user_id', followingIds),
  ]);

  const profileMap = new Map<string, any>();
  (profilesRes.data || []).forEach((p: any) => profileMap.set(p.user_id, p));

  return (usersRes.data || []).map((u: any) => {
    const profile = profileMap.get(u.id);
    const followRecord = follows.find((f: any) => f.following_id === u.id);
    return {
      user_id: u.id,
      username: u.username,
      points: u.points,
      level: u.level,
      avatar_url: profile?.avatar_url ?? null,
      bio: profile?.bio ?? null,
      created_at: followRecord?.created_at ?? '',
    };
  });
};
