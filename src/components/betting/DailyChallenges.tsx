import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Trophy, Target, CheckCircle2, Clock } from 'lucide-react';
import { getDailyChallenges, ChallengeWithProgress } from '@/lib/supabase-challenges';
import { useToast } from '@/hooks/use-toast';

export const DailyChallenges = () => {
  const [challenges, setChallenges] = useState<ChallengeWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadChallenges = async () => {
    try {
      const data = await getDailyChallenges();
      setChallenges(data);
    } catch (error) {
      console.error('Error loading challenges:', error);
      toast({
        title: 'Error',
        description: 'Failed to load daily challenges',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChallenges();
  }, []);

  const getChallengeIcon = (type: string) => {
    switch (type) {
      case 'daily_bets':
      case 'high_stake':
        return Target;
      case 'daily_wins':
      case 'win_streak':
        return Trophy;
      case 'different_cities':
        return Target;
      default:
        return Trophy;
    }
  };

  const getProgressPercentage = (progress: number, target: number) => {
    return Math.min((progress / target) * 100, 100);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Daily Challenges
          </CardTitle>
          <CardDescription>Loading challenges...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const completedCount = challenges.filter(c => c.completed).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Daily Challenges
            </CardTitle>
            <CardDescription>
              Complete challenges for bonus points • Resets at midnight
            </CardDescription>
          </div>
          <Badge variant={completedCount === challenges.length ? "default" : "secondary"}>
            {completedCount}/{challenges.length} Complete
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {challenges.map((challenge) => {
          const Icon = getChallengeIcon(challenge.challenge_type);
          const progressPercentage = getProgressPercentage(challenge.progress, challenge.target_value);

          return (
            <div
              key={challenge.id}
              className={`p-4 border rounded-lg transition-all ${
                challenge.completed
                  ? 'bg-primary/5 border-primary/20'
                  : 'bg-card hover:bg-accent/50'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`p-2 rounded-lg ${
                    challenge.completed ? 'bg-primary/10' : 'bg-muted'
                  }`}>
                    {challenge.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{challenge.title}</h4>
                      {challenge.completed && (
                        <Badge variant="default" className="text-xs">
                          Completed
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {challenge.description}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="ml-2">
                  +{challenge.reward_points}
                </Badge>
              </div>

              <div className="space-y-2 mt-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span className="font-medium">
                    {challenge.progress} / {challenge.target_value}
                  </span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>
            </div>
          );
        })}

        {challenges.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No challenges available today</p>
            <p className="text-sm mt-1">Check back tomorrow!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
