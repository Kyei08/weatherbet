import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Trophy, Medal, Award, Users, UserCheck, RefreshCw, Search, X, Heart, Zap, UserPlus, TrendingUp } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { getGroupLeaderboard, getUserLeaderboardGroup, assignUserToLeaderboardGroup, getProfilesByUsernames } from '@/lib/supabase-auth-storage';
import { getFollowingIds, getFollowCounts } from '@/lib/supabase-follows';
import { useToast } from '@/hooks/use-toast';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PlayerProfileModal from './PlayerProfileModal';

interface LeaderboardEntry {
  username: string;
  points: number;
  level: number;
  xp: number;
  rank: number;
}

interface ProfileInfo {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
}

interface LeaderboardGroupInfo {
  group_id: string;
  joined_at: string;
  current_size: number;
  leaderboard_groups: {
    id: string;
    name: string;
    max_size: number;
  };
}

interface LeaderboardProps {
  onBack: () => void;
}

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1: return <Trophy className="h-5 w-5 text-yellow-500" />;
    case 2: return <Medal className="h-5 w-5 text-gray-400" />;
    case 3: return <Award className="h-5 w-5 text-amber-600" />;
    default: return null;
  }
};

const getRankBadge = (rank: number) => {
  if (rank <= 3) {
    const variants = { 1: 'default', 2: 'secondary', 3: 'outline' } as const;
    return variants[rank as keyof typeof variants];
  }
  return 'outline';
};

function PlayerRowSkeleton() {
  return (
    <div className="flex items-center justify-between p-3 sm:p-4 rounded-lg border">
      <div className="flex items-center gap-2 sm:gap-3">
        <Skeleton className="h-6 w-10 rounded-full" />
        <Skeleton className="h-8 w-8 sm:h-9 sm:w-9 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="space-y-1.5 text-right">
        <Skeleton className="h-5 w-14 ml-auto" />
        <Skeleton className="h-3 w-10 ml-auto" />
      </div>
    </div>
  );
}

function PlayerRow({ user, profile, isFollowing, followerCount, followingCount, sortBy, onClick }: { user: LeaderboardEntry; profile?: ProfileInfo; isFollowing?: boolean; followerCount?: number; followingCount?: number; sortBy: 'points' | 'followers' | 'following'; onClick: () => void }) {
  const getSortIndicator = () => {
    if (sortBy === 'followers') {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="gap-1 text-[10px] px-1.5 py-0 h-4 shrink-0 bg-accent/50">
                <Users className="h-2.5 w-2.5" />
                Ranked by followers
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-popover border border-border text-xs">
              Ranking position based on follower count
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    } else if (sortBy === 'following') {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="gap-1 text-[10px] px-1.5 py-0 h-4 shrink-0 bg-accent/50">
                <UserPlus className="h-2.5 w-2.5" />
                Ranked by following
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-popover border border-border text-xs">
              Ranking position based on following count
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    // Default points - no indicator needed
    return null;
  };
  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between p-3 sm:p-4 rounded-lg border cursor-pointer transition-colors hover:bg-accent/50 ${
        user.rank <= 3 ? 'bg-muted/50' : ''
      }`}
    >
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className="flex items-center gap-1 sm:gap-2 min-w-[44px] sm:min-w-[60px] shrink-0">
          {getRankIcon(user.rank)}
          <Badge variant={getRankBadge(user.rank)} className="text-[10px] sm:text-xs">#{user.rank}</Badge>
        </div>
        <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full shrink-0 overflow-hidden bg-primary/10 flex items-center justify-center">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-8 w-8 sm:h-9 sm:w-9 rounded-full object-cover" />
          ) : (
            <span className="text-xs sm:text-sm font-bold text-primary">
              {user.username.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1 sm:gap-1.5">
            <p className="font-semibold truncate text-sm">{user.username}</p>
            <div className="flex items-center gap-1">
              {followerCount !== undefined && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="gap-0.5 text-[10px] px-1.5 py-0 h-4 shrink-0 cursor-help">
                        👥 {followerCount}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-popover border border-border">
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Followers:</span>
                          <span className="font-semibold">{followerCount}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Following:</span>
                          <span className="font-semibold">{followingCount ?? 0}</span>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {isFollowing && (
                <Badge variant="secondary" className="gap-0.5 text-[10px] px-1.5 py-0 h-4 shrink-0">
                  <UserCheck className="h-2.5 w-2.5" />
                  Following
                </Badge>
              )}
            </div>
          </div>
          {profile?.bio ? (
            <p className="text-xs text-muted-foreground truncate max-w-[180px]">{profile.bio}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Level {user.level} • {user.xp} XP
            </p>
          )}
        </div>
      </div>
      <div className="text-right shrink-0 ml-2">
        <p className="text-base sm:text-lg font-bold">{user.points.toLocaleString()}</p>
        <p className="text-[10px] sm:text-xs text-muted-foreground">points</p>
      </div>
    </div>
  );
}

const Leaderboard = ({ onBack }: LeaderboardProps) => {
  const [users, setUsers] = useState<LeaderboardEntry[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileInfo>>(new Map());
  const [followerCounts, setFollowerCounts] = useState<Map<string, number>>(new Map());
  const [followingCounts, setFollowingCounts] = useState<Map<string, number>>(new Map());
  const [followingUserIds, setFollowingUserIds] = useState<Set<string>>(new Set());
  const [groupInfo, setGroupInfo] = useState<LeaderboardGroupInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<LeaderboardEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'points' | 'followers' | 'following'>('points');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageDirection, setPageDirection] = useState(0);
  const PLAYERS_PER_PAGE = 20;
  const { toast } = useToast();

  const goToPage = useCallback((page: number | ((prev: number) => number)) => {
    setCurrentPage(prev => {
      const next = typeof page === 'function' ? page(prev) : page;
      setPageDirection(next > prev ? 1 : -1);
      return next;
    });
  }, []);

  const filteredUsers = useMemo(() => {
    let result = users;
    if (friendsOnly) {
      result = result.filter(u => {
        const profile = profiles.get(u.username);
        return profile?.user_id ? followingUserIds.has(profile.user_id) : false;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(u => u.username.toLowerCase().includes(q));
    }
    
    // Apply sorting
    result = [...result].sort((a, b) => {
      if (sortBy === 'followers') {
        const aFollowers = profiles.get(a.username)?.user_id ? followerCounts.get(profiles.get(a.username)?.user_id!) ?? 0 : 0;
        const bFollowers = profiles.get(b.username)?.user_id ? followerCounts.get(profiles.get(b.username)?.user_id!) ?? 0 : 0;
        return bFollowers - aFollowers;
      } else if (sortBy === 'following') {
        const aFollowing = profiles.get(a.username)?.user_id ? followingCounts.get(profiles.get(a.username)?.user_id!) ?? 0 : 0;
        const bFollowing = profiles.get(b.username)?.user_id ? followingCounts.get(profiles.get(b.username)?.user_id!) ?? 0 : 0;
        return bFollowing - aFollowing;
      }
      // Default: sort by points (descending)
      return b.points - a.points;
    });
    
    return result;
  }, [users, searchQuery, friendsOnly, profiles, followingUserIds, sortBy, followerCounts, followingCounts]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PLAYERS_PER_PAGE));
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * PLAYERS_PER_PAGE;
    return filteredUsers.slice(start, start + PLAYERS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  // Reset to page 1 when filters or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, friendsOnly, sortBy]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      let groupData = await getUserLeaderboardGroup();
      if (!groupData) {
        await assignUserToLeaderboardGroup(100);
        groupData = await getUserLeaderboardGroup();
      }
      setGroupInfo(groupData);

      const [data, followIds] = await Promise.all([
        getGroupLeaderboard(),
        getFollowingIds(),
      ]);
      setUsers(data);
      setFollowingUserIds(followIds);

      if (data.length > 0) {
        const usernames = data.map((u: LeaderboardEntry) => u.username);
        const profilesList = await getProfilesByUsernames(usernames);
        const map = new Map<string, ProfileInfo>();
        profilesList.forEach((p) => {
          if (p.username) map.set(p.username, p);
        });
        setProfiles(map);

        // Fetch follower and following counts for all players
        const followerCountsMap = new Map<string, number>();
        const followingCountsMap = new Map<string, number>();
        for (const profile of profilesList) {
          if (profile.user_id) {
            const counts = await getFollowCounts(profile.user_id);
            followerCountsMap.set(profile.user_id, counts.followers);
            followingCountsMap.set(profile.user_id, counts.following);
          }
        }
        setFollowerCounts(followerCountsMap);
        setFollowingCounts(followingCountsMap);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load leaderboard data" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const { containerRef, pullDistance, isRefreshing, isTriggered, progress } = usePullToRefresh({
    onRefresh: fetchLeaderboard,
  });

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-background p-4 overflow-auto"
      style={{ overscrollBehavior: 'contain' }}
    >
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

      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6 pb-20 md:pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-2xl font-bold">🏆 Leaderboard</h1>
        </div>

        {loading ? (
          <>
            {/* Group info skeleton */}
            <Card className="border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              </CardContent>
            </Card>

            {/* Player list skeleton */}
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-28" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <PlayerRowSkeleton key={i} />
                ))}
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            {groupInfo && (
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background animate-fade-in">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">{groupInfo.leaderboard_groups.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {groupInfo.current_size} / {groupInfo.leaderboard_groups.max_size} players
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-sm">Your League</Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="animate-fade-in" style={{ animationDelay: '50ms', animationFillMode: 'both' }}>
              <CardHeader>
                <CardTitle>Top Players</CardTitle>
                <p className="text-muted-foreground">Compete with players in your league</p>
                <div className="flex items-center gap-2 mt-2">
                  <Switch id="friends-only" checked={friendsOnly} onCheckedChange={setFriendsOnly} />
                  <Label htmlFor="friends-only" className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Heart className={`h-3.5 w-3.5 ${friendsOnly ? 'text-primary fill-primary' : 'text-muted-foreground'}`} />
                    Friends only
                  </Label>
                </div>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search players..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-9"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="mt-2">
                  <Label htmlFor="sort-by" className="text-sm text-muted-foreground mb-1 block">Sort by</Label>
                  <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'points' | 'followers' | 'following')}>
                    <SelectTrigger id="sort-by" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="points">Points (Highest)</SelectItem>
                      <SelectItem value="followers">Followers (Most)</SelectItem>
                      <SelectItem value="following">Following (Most)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      {searchQuery ? 'No players match your search' : 'No players yet!'}
                    </p>
                    {!searchQuery && (
                      <p className="text-sm text-muted-foreground mt-2">Be the first to place a bet</p>
                    )}
                  </div>
                ) : (
                  <>
                    <AnimatePresence mode="wait" custom={pageDirection}>
                      <motion.div
                        key={currentPage}
                        custom={pageDirection}
                        initial={{ opacity: 0, x: pageDirection * 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: pageDirection * -40 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="space-y-3"
                      >
                         {paginatedUsers.map((user, i) => {
                           const profile = profiles.get(user.username);
                           const followerCount = profile?.user_id ? followerCounts.get(profile.user_id) : undefined;
                           const followingCount = profile?.user_id ? followingCounts.get(profile.user_id) : undefined;
                           return (
                             <motion.div
                               key={`${user.username}-${user.rank}`}
                               initial={{ opacity: 0, y: 8 }}
                               animate={{ opacity: 1, y: 0 }}
                               transition={{ delay: i * 0.025, duration: 0.2 }}
                             >
                               <PlayerRow
                                 user={user}
                                 profile={profile}
                                 isFollowing={profile?.user_id ? followingUserIds.has(profile.user_id) : false}
                                 followerCount={followerCount}
                                 followingCount={followingCount}
                                 sortBy={sortBy}
                                 onClick={() => setSelectedPlayer(user)}
                               />
                            </motion.div>
                          );
                        })}
                      </motion.div>
                    </AnimatePresence>

                    {totalPages > 1 && (
                      <div className="mt-6">
                        <div className="text-xs text-muted-foreground text-center mb-2">
                          Showing {(currentPage - 1) * PLAYERS_PER_PAGE + 1}–{Math.min(currentPage * PLAYERS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length} players
                        </div>
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious
                                onClick={() => goToPage(p => Math.max(1, p - 1))}
                                className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                              />
                            </PaginationItem>

                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                              .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                              .reduce<(number | 'ellipsis')[]>((acc, page, idx, arr) => {
                                if (idx > 0 && page - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                                acc.push(page);
                                return acc;
                              }, [])
                              .map((item, idx) =>
                                item === 'ellipsis' ? (
                                  <PaginationItem key={`ellipsis-${idx}`}>
                                    <PaginationEllipsis />
                                  </PaginationItem>
                                ) : (
                                  <PaginationItem key={item}>
                                    <PaginationLink
                                      isActive={currentPage === item}
                                      onClick={() => goToPage(item as number)}
                                      className="cursor-pointer"
                                    >
                                      {item}
                                    </PaginationLink>
                                  </PaginationItem>
                                )
                              )}

                            <PaginationItem>
                              <PaginationNext
                                onClick={() => goToPage(p => Math.min(totalPages, p + 1))}
                                className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {users.length > 0 && (
              <Card className="animate-fade-in" style={{ animationDelay: '150ms', animationFillMode: 'both' }}>
                <CardHeader><CardTitle>Competition Stats</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold">{users.length}</p>
                      <p className="text-sm text-muted-foreground">Total Players</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{Math.max(...users.map(u => u.points)).toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">Highest Score</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {selectedPlayer && (
        <PlayerProfileModal
          open={!!selectedPlayer}
          onOpenChange={(open) => !open && setSelectedPlayer(null)}
          username={selectedPlayer.username}
          points={selectedPlayer.points}
          level={selectedPlayer.level}
          xp={selectedPlayer.xp}
          rank={selectedPlayer.rank}
          bio={profiles.get(selectedPlayer.username)?.bio}
          avatarUrl={profiles.get(selectedPlayer.username)?.avatar_url}
        />
      )}
    </div>
  );
};

export default Leaderboard;
