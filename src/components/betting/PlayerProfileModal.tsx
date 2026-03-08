import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Medal, Award, Star, Target, Zap, UserPlus, UserMinus, Users, Loader2, Share2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useFollow } from '@/hooks/useFollow';
import { toast as sonnerToast } from 'sonner';
import RankHistoryChart from './RankHistoryChart';
import { supabase } from '@/integrations/supabase/client';
import { useFollow } from '@/hooks/useFollow';
import RankHistoryChart from './RankHistoryChart';

interface PlayerProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username: string;
  points: number;
  level: number;
  xp: number;
  rank: number;
  bio?: string | null;
  avatarUrl?: string | null;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  badge_icon: string;
  points_reward: number;
}

interface PlayerStats {
  totalBets: number;
  wins: number;
  losses: number;
}

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1: return <Trophy className="h-6 w-6 text-yellow-500" />;
    case 2: return <Medal className="h-6 w-6 text-gray-400" />;
    case 3: return <Award className="h-6 w-6 text-amber-600" />;
    default: return <span className="text-lg font-bold text-muted-foreground">#{rank}</span>;
  }
};

const PlayerProfileModal = ({
  open,
  onOpenChange,
  username,
  points,
  level,
  xp,
  rank,
  bio,
  avatarUrl,
}: PlayerProfileModalProps) => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [stats, setStats] = useState<PlayerStats>({ totalBets: 0, wins: 0, losses: 0 });
  const [loading, setLoading] = useState(false);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);

  const { following, counts, loading: followLoading, checking, isSelf, toggleFollow } = useFollow(targetUserId);

  useEffect(() => {
    if (!open) return;

    const fetchPlayerData = async () => {
      setLoading(true);
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('username', username)
          .maybeSingle();

        if (userData?.id) {
          setTargetUserId(userData.id);

          const [achievementsRes, betsRes] = await Promise.all([
            supabase
              .from('user_achievements')
              .select('achievement_id, achievements(id, title, description, badge_icon, points_reward)')
              .eq('user_id', userData.id),
            supabase
              .from('bets')
              .select('result')
              .eq('user_id', userData.id),
          ]);

          if (achievementsRes.data) {
            const mapped = achievementsRes.data
              .map((ua: any) => ua.achievements)
              .filter(Boolean);
            setAchievements(mapped);
          }

          if (betsRes.data) {
            setStats({
              totalBets: betsRes.data.length,
              wins: betsRes.data.filter((b) => b.result === 'win').length,
              losses: betsRes.data.filter((b) => b.result === 'loss').length,
            });
          }
        }
      } catch (err) {
        console.error('Error fetching player data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayerData();
  }, [open, username]);

  const winRate = stats.totalBets > 0
    ? Math.round((stats.wins / stats.totalBets) * 100)
    : 0;

  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 200], [1, 0.3]);
  const scale = useTransform(y, [0, 200], [1, 0.92]);

  const handleDragEnd = useCallback(
    (_: any, info: { offset: { y: number }; velocity: { y: number } }) => {
      if (info.offset.y > 80 || info.velocity.y > 400) {
        animate(y, 400, { duration: 0.2 }).then(() => {
          onOpenChange(false);
          y.set(0);
        });
      } else {
        animate(y, 0, { type: 'spring', stiffness: 400, damping: 30 });
      }
    },
    [onOpenChange, y]
  );


  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) y.set(0); onOpenChange(open); }}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[85vh] overflow-hidden p-0 border-none bg-transparent shadow-none [&>button]:hidden">
        <motion.div
          style={{ y, opacity, scale }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.6 }}
          onDragEnd={handleDragEnd}
          className="bg-background border border-border rounded-lg shadow-lg p-6 overflow-y-auto max-h-[85vh] relative"
        >
          {/* Swipe indicator */}
          <div className="flex justify-center mb-3">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          <DialogHeader>
            <DialogTitle className="sr-only">{username}'s Profile</DialogTitle>
            <DialogDescription className="sr-only">Player profile showing stats and achievements</DialogDescription>
          </DialogHeader>

          {/* Header */}
          <div className="flex items-center gap-3 sm:gap-4 pb-4 border-b border-border">
            <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-full shrink-0 overflow-hidden bg-primary/10 flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-12 w-12 sm:h-16 sm:w-16 rounded-full object-cover" />
              ) : (
                <span className="text-xl sm:text-2xl font-bold text-primary">
                  {username.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold truncate">{username}</h2>
                {getRankIcon(rank)}
              </div>
              <div className="flex gap-1.5 sm:gap-2 mt-1 flex-wrap">
                <Badge variant="secondary" className="text-[10px] sm:text-xs">Level {level}</Badge>
                <Badge variant="outline" className="text-[10px] sm:text-xs">{xp} XP</Badge>
              </div>
            </div>
          </div>

          {/* Follow Button & Counts */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex gap-4 text-sm">
              <div className="text-center">
                <p className="font-bold">{counts.followers}</p>
                <p className="text-xs text-muted-foreground">Followers</p>
              </div>
              <div className="text-center">
                <p className="font-bold">{counts.following}</p>
                <p className="text-xs text-muted-foreground">Following</p>
              </div>
            </div>
            {!isSelf && !checking && (
              <Button
                size="sm"
                variant={following ? 'outline' : 'default'}
                onClick={toggleFollow}
                disabled={followLoading}
                className="min-w-[100px]"
              >
                {followLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : following ? (
                  <>
                    <UserMinus className="h-4 w-4 mr-1" />
                    Unfollow
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-1" />
                    Follow
                  </>
                )}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="min-w-[40px]"
              onClick={async () => {
                const text = `🏆 ${username} is ranked #${rank} with ${points.toLocaleString()} points on WeatherBet!`;
                const url = window.location.origin;
                if (navigator.share) {
                  try { await navigator.share({ title: 'WeatherBet', text, url }); } catch {}
                } else {
                  await navigator.clipboard.writeText(`${text}\n${url}`);
                  sonnerToast.success('Copied to clipboard!');
                }
              }}
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Bio */}
          {bio && (
            <div className="py-3 border-b border-border">
              <p className="text-sm text-muted-foreground italic">"{bio}"</p>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4">
            <Card>
              <CardContent className="p-2 sm:p-3 text-center">
                <Star className="h-3 w-3 sm:h-4 sm:w-4 mx-auto mb-1 text-primary" />
                <p className="text-sm sm:text-lg font-bold">{points.toLocaleString()}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Points</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-2 sm:p-3 text-center">
                <Target className="h-3 w-3 sm:h-4 sm:w-4 mx-auto mb-1 text-primary" />
                <p className="text-sm sm:text-lg font-bold">{stats.totalBets}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Bets</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-2 sm:p-3 text-center">
                <Zap className="h-3 w-3 sm:h-4 sm:w-4 mx-auto mb-1 text-primary" />
                <p className="text-sm sm:text-lg font-bold">{winRate}%</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Win Rate</p>
              </CardContent>
            </Card>
          </div>

          {/* Win/Loss breakdown */}
          {stats.totalBets > 0 && (
            <div className="flex gap-4 text-sm mt-3">
              <span className="text-green-500 font-medium">{stats.wins}W</span>
              <span className="text-destructive font-medium">{stats.losses}L</span>
              <span className="text-muted-foreground">
                {stats.totalBets - stats.wins - stats.losses} pending
              </span>
            </div>
          )}

          {/* Achievements */}
          <div className="mt-4">
            <h3 className="text-sm font-semibold mb-2">
              Achievements ({achievements.length})
            </h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : achievements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No achievements yet</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {achievements.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/30"
                  >
                    <span className="text-lg">{a.badge_icon}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{a.title}</p>
                      <p className="text-xs text-muted-foreground">+{a.points_reward} pts</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rank History Chart */}
          {targetUserId && (
            <RankHistoryChart userId={targetUserId} username={username} />
          )}
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default PlayerProfileModal;
