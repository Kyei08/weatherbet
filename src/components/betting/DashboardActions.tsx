import { Button } from '@/components/ui/button';
import { Layers, Zap, ShoppingCart, History, TrendingUp, MapPin, Scale, Trophy, Shield, DollarSign, Target, BarChart3, Users, Swords } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { useModeTheme } from '@/hooks/useModeTheme';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type ActiveView = 'dashboard' | 'betting' | 'parlay' | 'combined' | 'multitime' | 'mybets' | 'leaderboard' | 'shop' | 'analytics';

interface DashboardActionsProps {
  betsCount: number;
  onViewChange: (view: ActiveView) => void;
}

export function DashboardActions({ betsCount, onViewChange }: DashboardActionsProps) {
  const navigate = useNavigate();
  const { isAdminUser } = useAdminCheck();
  const theme = useModeTheme();

  return (
    <div className="space-y-4">
      {/* Primary Betting Actions */}
      <Card className={`${theme.card} border-2 ${theme.glowShadow}`}>
        <CardHeader className="pb-3">
          <CardTitle className={`text-sm font-semibold uppercase tracking-wider ${theme.primaryText}`}>
            Place a Bet
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 sm:gap-3">
          <Button
            size="lg"
            className={`h-12 sm:h-14 text-xs sm:text-sm ${theme.buttonPrimary} border ${theme.borderColor} hover:scale-[1.02] transition-all`}
            onClick={() => onViewChange('betting')}
          >
            <Target className="mr-1.5 h-4 w-4" />
            Single Bet
          </Button>
          <Button
            size="lg"
            className={`h-12 sm:h-14 text-xs sm:text-sm ${theme.buttonSecondary} border ${theme.borderColor} hover:scale-[1.02] transition-all`}
            onClick={() => onViewChange('combined')}
          >
            <BarChart3 className="mr-1.5 h-4 w-4" />
            Combined
          </Button>
          <Button
            size="lg"
            className={`h-12 sm:h-14 text-xs sm:text-sm ${theme.accent} ${theme.primaryForeground} border ${theme.borderColor} hover:scale-[1.02] transition-all`}
            onClick={() => onViewChange('parlay')}
          >
            <Layers className="mr-1.5 h-4 w-4" />
            Parlay
          </Button>
          <Button
            size="lg"
            className={`h-12 sm:h-14 text-xs sm:text-sm ${theme.secondary} text-foreground border ${theme.borderColor} hover:scale-[1.02] transition-all`}
            onClick={() => onViewChange('multitime')}
          >
            <Zap className="mr-1.5 h-4 w-4" />
            Multi-Time
          </Button>
        </CardContent>
      </Card>

      {/* My Bets - Prominent */}
      <Button
        variant="outline"
        size="lg"
        className={`w-full h-11 sm:h-12 text-sm sm:text-base border-2 ${theme.borderColorHeavy} ${theme.hoverBg} hover:scale-[1.01] transition-all`}
        onClick={() => onViewChange('mybets')}
      >
        <BarChart3 className="mr-2 h-4 w-4" />
        My Bets ({betsCount})
      </Button>

      {/* Secondary Navigation */}
      <div className="grid grid-cols-4 gap-1 sm:gap-2">
        <Button variant="ghost" size="sm" className="h-12 flex-col gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => navigate('/cashout')}>
          <DollarSign className="h-4 w-4" />
          Cash Out
        </Button>
        <Button variant="ghost" size="sm" className="h-12 flex-col gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => onViewChange('shop')}>
          <ShoppingCart className="h-4 w-4" />
          Shop
        </Button>
        <Button variant="ghost" size="sm" className="h-12 flex-col gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => navigate('/purchase-history')}>
          <History className="h-4 w-4" />
          History
        </Button>
        <Button variant="ghost" size="sm" className="h-12 flex-col gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => onViewChange('analytics')}>
          <TrendingUp className="h-4 w-4" />
          Analytics
        </Button>
        <Button variant="ghost" size="sm" className="h-12 flex-col gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => navigate('/city-analytics')}>
          <MapPin className="h-4 w-4" />
          Cities
        </Button>
        <Button variant="ghost" size="sm" className="h-12 flex-col gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => navigate('/city-comparison')}>
          <Scale className="h-4 w-4" />
          Compare
        </Button>
        <Button variant="ghost" size="sm" className="h-12 flex-col gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => onViewChange('leaderboard')}>
          <Trophy className="h-4 w-4" />
          Leaderboard
        </Button>
        <Button variant="ghost" size="sm" className="h-12 flex-col gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => navigate('/following')}>
          <Users className="h-4 w-4" />
          Following
        </Button>
        {isAdminUser && (
          <Button
            variant="ghost"
            size="sm"
            className={`h-12 flex-col gap-1 text-xs ${theme.primaryText} hover:text-foreground`}
            onClick={() => navigate('/admin')}
          >
            <Shield className="h-4 w-4" />
            Admin
          </Button>
        )}
      </div>
    </div>
  );
}
