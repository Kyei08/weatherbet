import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { followUser, unfollowUser, isFollowing, getFollowCounts } from '@/lib/supabase-follows';

export function useFollow(targetUserId: string | null) {
  const { user } = useAuth();
  const [following, setFollowing] = useState(false);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const isSelf = user?.id === targetUserId;

  useEffect(() => {
    if (!targetUserId) { setChecking(false); return; }

    const check = async () => {
      setChecking(true);
      const [isFollowingRes, countsRes] = await Promise.all([
        isSelf ? Promise.resolve(false) : isFollowing(targetUserId),
        getFollowCounts(targetUserId),
      ]);
      setFollowing(isFollowingRes);
      setCounts(countsRes);
      setChecking(false);
    };
    check();
  }, [targetUserId, isSelf]);

  const toggleFollow = useCallback(async () => {
    if (!targetUserId || isSelf || loading) return;
    setLoading(true);
    try {
      if (following) {
        await unfollowUser(targetUserId);
        setFollowing(false);
        setCounts(prev => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
      } else {
        await followUser(targetUserId);
        setFollowing(true);
        setCounts(prev => ({ ...prev, followers: prev.followers + 1 }));
      }
    } catch (e) {
      console.error('Follow toggle error:', e);
    } finally {
      setLoading(false);
    }
  }, [targetUserId, following, isSelf, loading]);

  return { following, counts, loading, checking, isSelf, toggleFollow };
}
