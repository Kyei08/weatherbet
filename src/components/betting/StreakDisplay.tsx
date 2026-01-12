import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Flame, TrendingUp, Award, Loader2 } from 'lucide-react';
import { useStreakTracker } from '@/hooks/useStreakTracker';
import { STREAK_CONFIG } from '@/lib/streak-bonus';

interface StreakDisplayProps {
  compact?: boolean;
}

export function StreakDisplay({ compact = false }: StreakDisplayProps) {
  const { streakInfo, isLoading } = useStreakTracker();

  if (isLoading) {
    return compact ? (
      <Badge variant="outline" className="animate-pulse">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        Loading...
      </Badge>
    ) : (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const { currentStreak, longestStreak, multiplier, threshold, nextThreshold, winsToNextThreshold, isActive } = streakInfo;

  // Compact badge view
  if (compact) {
    if (currentStreak === 0) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs cursor-help">
                <Flame className="h-3 w-3 mr-1 text-muted-foreground" />
                No streak
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Win {STREAK_CONFIG.minStreakForBonus} bets in a row to start a streak!</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant={isActive ? "default" : "secondary"}
              className={`text-xs cursor-help ${threshold?.color || ''}`}
            >
              {threshold?.emoji || '🔥'} {currentStreak} streak
              {isActive && <span className="ml-1 font-bold">({multiplier}x)</span>}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-1">
              <p className="font-semibold">{threshold?.label || 'Building Streak'}</p>
              <p className="text-sm">
                {isActive 
                  ? `You're earning ${Math.round((multiplier - 1) * 100)}% bonus on wins!`
                  : `Win ${STREAK_CONFIG.minStreakForBonus - currentStreak} more to start earning bonuses!`
                }
              </p>
              {nextThreshold && (
                <p className="text-xs text-muted-foreground">
                  {winsToNextThreshold} more wins to {nextThreshold.label} ({nextThreshold.multiplier}x)
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full card view
  return (
    <Card className={isActive ? 'border-orange-500/50 bg-gradient-to-br from-orange-500/5 to-red-500/5' : ''}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Flame className={`h-5 w-5 ${isActive ? 'text-orange-500' : 'text-muted-foreground'}`} />
          Winning Streak
          {isActive && (
            <Badge variant="secondary" className={threshold?.color}>
              {threshold?.emoji} {threshold?.label}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Streak */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-4xl font-bold text-primary">{currentStreak}</p>
            <p className="text-sm text-muted-foreground">consecutive wins</p>
          </div>
          <div className="text-right">
            {isActive ? (
              <>
                <p className="text-2xl font-bold text-orange-500">{multiplier}x</p>
                <p className="text-sm text-muted-foreground">multiplier</p>
              </>
            ) : currentStreak > 0 ? (
              <>
                <p className="text-lg font-medium">{STREAK_CONFIG.minStreakForBonus - currentStreak} more</p>
                <p className="text-sm text-muted-foreground">to activate bonus</p>
              </>
            ) : (
              <>
                <p className="text-lg font-medium text-muted-foreground">1x</p>
                <p className="text-sm text-muted-foreground">no bonus yet</p>
              </>
            )}
          </div>
        </div>

        {/* Progress to next threshold */}
        {nextThreshold && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {winsToNextThreshold} wins to {nextThreshold.label}
              </span>
              <span className="font-medium">{nextThreshold.emoji} {nextThreshold.multiplier}x</span>
            </div>
            <Progress 
              value={((currentStreak - (threshold?.minStreak || 0)) / (nextThreshold.minStreak - (threshold?.minStreak || 0))) * 100}
              className="h-2"
            />
          </div>
        )}

        {/* Streak Milestones */}
        <div className="grid grid-cols-6 gap-1 pt-2">
          {STREAK_CONFIG.thresholds.map((t) => (
            <TooltipProvider key={t.minStreak}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div 
                    className={`text-center p-2 rounded-lg border transition-all ${
                      currentStreak >= t.minStreak 
                        ? 'bg-primary/10 border-primary/30' 
                        : 'bg-muted/30 border-border opacity-50'
                    }`}
                  >
                    <div className="text-lg">{t.emoji}</div>
                    <div className="text-xs font-medium">{t.minStreak}+</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-semibold">{t.label}</p>
                  <p className="text-sm">{t.multiplier}x multiplier at {t.minStreak}+ wins</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>

        {/* Longest Streak */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Award className="h-4 w-4" />
            Personal Best
          </div>
          <span className="font-semibold">{longestStreak} wins</span>
        </div>

        {/* Explanation */}
        {!isActive && currentStreak === 0 && (
          <div className="p-3 bg-muted/30 rounded-lg text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span>
                Win <strong className="text-foreground">{STREAK_CONFIG.minStreakForBonus}</strong> bets in a row to activate streak bonuses!
              </span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
