import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Trophy, Medal, Award, Users } from 'lucide-react';
import { getGroupLeaderboard, getUserLeaderboardGroup, assignUserToLeaderboardGroup } from '@/lib/supabase-auth-storage';
import { useToast } from '@/hooks/use-toast';

interface LeaderboardEntry {
  username: string;
  points: number;
  level: number;
  xp: number;
  rank: number;
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

const Leaderboard = ({ onBack }: LeaderboardProps) => {
  const [users, setUsers] = useState<LeaderboardEntry[]>([]);
  const [groupInfo, setGroupInfo] = useState<LeaderboardGroupInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        // Check if user has a group assignment
        let groupData = await getUserLeaderboardGroup();
        
        // If no group, assign user to one
        if (!groupData) {
          await assignUserToLeaderboardGroup(100);
          groupData = await getUserLeaderboardGroup();
        }
        
        setGroupInfo(groupData);
        
        // Fetch leaderboard for user's group
        const data = await getGroupLeaderboard();
        setUsers(data);
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load leaderboard data"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [toast]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return null;
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank <= 3) {
      const variants = {
        1: 'default',
        2: 'secondary', 
        3: 'outline'
      } as const;
      return variants[rank as keyof typeof variants];
    }
    return 'outline';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold">Leaderboard</h1>
          </div>
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">Loading leaderboard...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">🏆 Leaderboard</h1>
        </div>

        {/* League Info Card */}
        {groupInfo && (
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
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
                <Badge variant="secondary" className="text-sm">
                  Your League
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Top Players</CardTitle>
            <p className="text-muted-foreground">Compete with players in your league</p>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No players yet!</p>
                <p className="text-sm text-muted-foreground mt-2">Be the first to place a bet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {users.map((user) => {
                  return (
                    <div
                      key={`${user.username}-${user.rank}`}
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        user.rank <= 3 ? 'bg-muted/50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 min-w-[60px]">
                          {getRankIcon(user.rank)}
                          <Badge variant={getRankBadge(user.rank)}>
                            #{user.rank}
                          </Badge>
                        </div>
                        <div>
                          <p className="font-semibold">{user.username}</p>
                          <p className="text-sm text-muted-foreground">
                            Level {user.level} • {user.xp} XP
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{user.points.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">points</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        {users.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Competition Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{users.length}</p>
                  <p className="text-sm text-muted-foreground">Total Players</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {Math.max(...users.map(u => u.points)).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">Highest Score</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;