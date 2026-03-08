import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Users, UserMinus, Activity, RefreshCw } from 'lucide-react';
import { getFollowingList, unfollowUser } from '@/lib/supabase-follows';
import { motion } from 'framer-motion';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PlayerProfileModal from '@/components/betting/PlayerProfileModal';
import { ActivityFeed } from '@/components/betting/ActivityFeed';

interface FollowedUser {
  user_id: string;
  username: string;
  points: number;
  level: number;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}

function FollowingCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-8 w-24 rounded-md shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

function ActivitySkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full shrink-0" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const Following = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<FollowedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unfollowingId, setUnfollowingId] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<FollowedUser | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const data = await getFollowingList();
      setUsers(data);
    } catch (e) {
      console.error('Error loading following list:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const { containerRef, pullDistance, isRefreshing, isTriggered, progress } = usePullToRefresh({
    onRefresh: fetchData,
  });

  const handleUnfollow = async (userId: string) => {
    setUnfollowingId(userId);
    try {
      await unfollowUser(userId);
      setUsers((prev) => prev.filter((u) => u.user_id !== userId));
    } catch (e) {
      console.error('Unfollow error:', e);
    } finally {
      setUnfollowingId(null);
    }
  };

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-background overflow-auto"
      style={{ overscrollBehavior: 'contain' }}
    >
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-md">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">Following</h1>
          <Badge variant="secondary" className="ml-auto">{users.length}</Badge>
        </div>
      </header>

      {/* Pull-to-refresh indicator */}
      <div
        className="flex justify-center items-center overflow-hidden transition-[height] duration-200 ease-out"
        style={{ height: pullDistance > 0 ? `${pullDistance}px` : '0px' }}
      >
        <div className={`flex flex-col items-center gap-1 transition-opacity ${pullDistance > 10 ? 'opacity-100' : 'opacity-0'}`}>
          <RefreshCw
            className={`h-5 w-5 text-primary transition-transform duration-200 ${isRefreshing ? 'animate-spin' : ''}`}
            style={{ transform: isRefreshing ? undefined : `rotate(${progress * 360}deg)` }}
          />
          <span className="text-xs text-muted-foreground">
            {isRefreshing ? 'Refreshing…' : isTriggered ? 'Release to refresh' : 'Pull to refresh'}
          </span>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 pb-24 max-w-lg mx-auto"
      >
        <Tabs defaultValue="activity" className="w-full">
          <TabsList className="w-full mb-3">
            <TabsTrigger value="activity" className="flex-1 gap-1.5">
              <Activity className="h-4 w-4" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="following" className="flex-1 gap-1.5">
              <Users className="h-4 w-4" />
              Following
              <Badge variant="secondary" className="ml-1 text-xs h-5 px-1.5">{users.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="space-y-3 mt-0">
            {loading ? <ActivitySkeleton /> : <ActivityFeed />}
          </TabsContent>

          <TabsContent value="following" className="space-y-3 mt-0">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <FollowingCardSkeleton key={i} />
                ))}
              </div>
            ) : users.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="font-medium">Not following anyone yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Visit the Leaderboard and tap a player to follow them
                  </p>
                </CardContent>
              </Card>
            ) : (
              users.map((u, i) => (
                <motion.div
                  key={u.user_id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Card className="cursor-pointer hover:bg-accent/30 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setSelectedPlayer(u)}
                          className="flex items-center gap-3 flex-1 min-w-0 text-left"
                        >
                          <div className="h-10 w-10 rounded-full shrink-0 overflow-hidden bg-primary/10 flex items-center justify-center">
                            {u.avatar_url ? (
                              <img src={u.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                            ) : (
                              <span className="text-sm font-bold text-primary">
                                {u.username.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold truncate">{u.username}</p>
                            {u.bio ? (
                              <p className="text-xs text-muted-foreground truncate">{u.bio}</p>
                            ) : (
                              <p className="text-xs text-muted-foreground">Level {u.level} • {u.points.toLocaleString()} pts</p>
                            )}
                          </div>
                        </button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleUnfollow(u.user_id); }}
                          disabled={unfollowingId === u.user_id}
                          className="shrink-0"
                        >
                          {unfollowingId === u.user_id ? (
                            <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <UserMinus className="h-4 w-4 mr-1" />
                              Unfollow
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </motion.div>

      {selectedPlayer && (
        <PlayerProfileModal
          open={!!selectedPlayer}
          onOpenChange={(open) => !open && setSelectedPlayer(null)}
          username={selectedPlayer.username}
          points={selectedPlayer.points}
          level={selectedPlayer.level}
          xp={0}
          rank={0}
          bio={selectedPlayer.bio}
          avatarUrl={selectedPlayer.avatar_url}
        />
      )}
    </div>
  );
};

export default Following;
