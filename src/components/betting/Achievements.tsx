import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trophy, Lock } from 'lucide-react';
import { getAchievementsWithProgress, AchievementWithProgress } from '@/lib/supabase-achievements';
import { toast } from 'sonner';

export const Achievements = () => {
  const [achievements, setAchievements] = useState<AchievementWithProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAchievements();
  }, []);

  const loadAchievements = async () => {
    try {
      const data = await getAchievementsWithProgress();
      setAchievements(data);
    } catch (error) {
      console.error('Error loading achievements:', error);
      toast.error('Failed to load achievements');
    } finally {
      setLoading(false);
    }
  };

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Achievements & Badges</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading achievements...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Achievements & Badges
            </CardTitle>
            <CardDescription>
              Unlock achievements to earn bonus points
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-lg px-4 py-2">
            {unlockedCount}/{totalCount}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {achievements.map((achievement) => {
            const progressPercent = (achievement.progress / achievement.requirement_value) * 100;
            
            return (
              <Card
                key={achievement.id}
                className={`relative overflow-hidden transition-all ${
                  achievement.unlocked
                    ? 'border-primary bg-primary/5'
                    : 'opacity-75 hover:opacity-100'
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-4xl">{achievement.badge_icon}</div>
                    {achievement.unlocked ? (
                      <Badge variant="default" className="shrink-0">
                        Unlocked
                      </Badge>
                    ) : (
                      <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </div>
                  <CardTitle className="text-lg">{achievement.title}</CardTitle>
                  <CardDescription className="text-sm">
                    {achievement.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!achievement.unlocked && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">
                          {achievement.progress}/{achievement.requirement_value}
                        </span>
                      </div>
                      <Progress value={progressPercent} className="h-2" />
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Reward</span>
                    <span className="font-semibold text-primary">
                      +{achievement.points_reward} pts
                    </span>
                  </div>
                  {achievement.unlocked && achievement.unlocked_at && (
                    <p className="text-xs text-muted-foreground">
                      Unlocked {new Date(achievement.unlocked_at).toLocaleDateString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
