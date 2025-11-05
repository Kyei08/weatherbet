import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lock, Sparkles } from 'lucide-react';
import { getPerksWithStatus, PerkWithStatus } from '@/lib/supabase-perks';
import { getUserLevelInfo } from '@/lib/level-system';
import { toast } from 'sonner';

export const Perks = () => {
  const [perks, setPerks] = useState<PerkWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLevel, setUserLevel] = useState(1);

  useEffect(() => {
    loadPerks();
  }, []);

  const loadPerks = async () => {
    try {
      const levelInfo = await getUserLevelInfo();
      if (levelInfo) {
        setUserLevel(levelInfo.level);
        const data = await getPerksWithStatus(levelInfo.level);
        setPerks(data);
      }
    } catch (error) {
      console.error('Error loading perks:', error);
      toast.error('Failed to load perks');
    } finally {
      setLoading(false);
    }
  };

  const getPerkTypeLabel = (type: string) => {
    switch (type) {
      case 'bet_multiplier':
        return 'Odds Multiplier';
      case 'bonus_points':
        return 'Bonus Points';
      case 'max_stake_increase':
        return 'Max Stake';
      case 'win_bonus':
        return 'Win Bonus';
      default:
        return type;
    }
  };

  const getPerkValueDisplay = (type: string, value: number) => {
    switch (type) {
      case 'bet_multiplier':
        return `${value}x`;
      case 'bonus_points':
        return `+${value} pts`;
      case 'max_stake_increase':
        return `+${value} stake`;
      case 'win_bonus':
        return `+${Math.floor(value * 100)}%`;
      default:
        return value;
    }
  };

  const unlockedCount = perks.filter(p => p.unlocked).length;
  const totalCount = perks.length;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Unlockable Perks</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading perks...</p>
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
              <Sparkles className="h-5 w-5" />
              Unlockable Perks
            </CardTitle>
            <CardDescription>
              Level up to unlock powerful bonuses and abilities
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-lg px-4 py-2">
            {unlockedCount}/{totalCount}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {perks.map((perk) => {
            const canUnlock = userLevel >= perk.unlock_level;
            
            return (
              <Card
                key={perk.id}
                className={`relative overflow-hidden transition-all ${
                  perk.unlocked
                    ? 'border-primary bg-primary/5'
                    : canUnlock
                    ? 'border-yellow-500/50 bg-yellow-500/5'
                    : 'opacity-60'
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-4xl">{perk.perk_icon}</div>
                    {perk.unlocked ? (
                      <Badge variant="default" className="shrink-0">
                        Active
                      </Badge>
                    ) : canUnlock ? (
                      <Badge variant="outline" className="shrink-0 border-yellow-500 text-yellow-500">
                        Ready
                      </Badge>
                    ) : (
                      <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </div>
                  <CardTitle className="text-lg">{perk.title}</CardTitle>
                  <CardDescription className="text-sm">
                    {perk.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {getPerkTypeLabel(perk.perk_type)}
                    </span>
                    <span className="font-semibold text-primary">
                      {getPerkValueDisplay(perk.perk_type, perk.perk_value)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Unlock Level</span>
                    <span className={`font-medium ${
                      perk.unlocked ? 'text-green-500' : canUnlock ? 'text-yellow-500' : 'text-muted-foreground'
                    }`}>
                      Level {perk.unlock_level}
                    </span>
                  </div>
                  {perk.unlocked && perk.unlocked_at && (
                    <p className="text-xs text-muted-foreground pt-1">
                      Unlocked {new Date(perk.unlocked_at).toLocaleDateString()}
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
