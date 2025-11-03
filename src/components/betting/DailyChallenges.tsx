import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Trophy, Target, CheckCircle2 } from 'lucide-react';
import { getChallenges, getUserChallenges } from '@/lib/supabase-auth-storage';

interface Challenge {
  id: string;
  title: string;
  description: string;
  challenge_type: string;
  target_value: number;
  reward_points: number;
}

interface UserChallenge {
  id: string;
  progress: number;
  completed: boolean;
  challenge_id: string;
  challenges: Challenge;
}

export const DailyChallenges = () => {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [userChallenges, setUserChallenges] = useState<UserChallenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChallenges();
  }, []);

  const loadChallenges = async () => {
    try {
      const [allChallenges, userProgress] = await Promise.all([
        getChallenges(),
        getUserChallenges(),
      ]);
      
      setChallenges(allChallenges);
      setUserChallenges(userProgress);
    } catch (error) {
      console.error('Error loading challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  const getChallengeProgress = (challengeId: string) => {
    const userChallenge = userChallenges.find(uc => uc.challenge_id === challengeId);
    return userChallenge || { progress: 0, completed: false };
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Daily Challenges
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading challenges...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Daily Challenges
        </CardTitle>
        <CardDescription>Complete challenges to earn bonus points!</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {challenges.map((challenge) => {
          const { progress, completed } = getChallengeProgress(challenge.id);
          const progressPercent = Math.min((progress / challenge.target_value) * 100, 100);

          return (
            <div
              key={challenge.id}
              className="p-4 rounded-lg border bg-card/50 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold">{challenge.title}</h4>
                    {completed && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {challenge.description}
                  </p>
                </div>
                <Badge variant="secondary" className="ml-2">
                  <Trophy className="h-3 w-3 mr-1" />
                  +{challenge.reward_points}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">
                    {progress} / {challenge.target_value}
                  </span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>
            </div>
          );
        })}

        {challenges.length === 0 && (
          <p className="text-center text-muted-foreground py-4">
            No challenges available today. Check back tomorrow!
          </p>
        )}
      </CardContent>
    </Card>
  );
};
