import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Trophy, Zap } from 'lucide-react';
import { getUserLevelInfo } from '@/lib/level-system';

interface LevelInfo {
  level: number;
  xp: number;
  points: number;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  xpInCurrentLevel: number;
  xpNeededForNextLevel: number;
  progress: number;
}

export const LevelDisplay = () => {
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLevelInfo();
  }, []);

  const loadLevelInfo = async () => {
    try {
      const info = await getUserLevelInfo();
      setLevelInfo(info);
    } catch (error) {
      console.error('Error loading level info:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !levelInfo) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Level Badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                  <Trophy className="h-8 w-8 text-primary" />
                </div>
                <Badge 
                  className="absolute -bottom-1 -right-1 h-6 w-6 flex items-center justify-center p-0 rounded-full"
                  variant="default"
                >
                  {levelInfo.level}
                </Badge>
              </div>
              <div>
                <h3 className="text-2xl font-bold">Level {levelInfo.level}</h3>
                <p className="text-sm text-muted-foreground">
                  {levelInfo.xpInCurrentLevel} / {levelInfo.xpNeededForNextLevel} XP
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-primary">
                <Zap className="h-4 w-4" />
                <span className="text-lg font-semibold">{levelInfo.xp}</span>
              </div>
              <p className="text-xs text-muted-foreground">Total XP</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress value={levelInfo.progress} className="h-3" />
            <p className="text-xs text-center text-muted-foreground">
              {Math.round(levelInfo.progress)}% to Level {levelInfo.level + 1}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
