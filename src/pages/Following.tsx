import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, UserMinus, Loader2 } from 'lucide-react';
import { getFollowingList, unfollowUser } from '@/lib/supabase-follows';
import { motion } from 'framer-motion';
import PlayerProfileModal from '@/components/betting/PlayerProfileModal';

interface FollowedUser {
  user_id: string;
  username: string;
  points: number;
  level: number;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}

const Following = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<FollowedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unfollowingId, setUnfollowingId] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<FollowedUser | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await getFollowingList();
        setUsers(data);
      } catch (e) {
        console.error('Error loading following list:', e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-md">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">Following</h1>
          <Badge variant="secondary" className="ml-auto">{users.length}</Badge>
        </div>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 pb-24 max-w-lg mx-auto space-y-3"
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
          users.map((u) => (
            <Card key={u.user_id} className="cursor-pointer hover:bg-accent/30 transition-colors">
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
                      <Loader2 className="h-4 w-4 animate-spin" />
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
          ))
        )}
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
