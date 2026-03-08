import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Coins, TrendingUp, Activity } from 'lucide-react';
import { useCurrencyMode } from '@/contexts/CurrencyModeContext';
import { useModeTheme } from '@/hooks/useModeTheme';
import { formatCurrency } from '@/lib/currency';
import { User } from '@/types/supabase-betting';

interface DashboardHeaderProps {
  user: User;
  winRate: string;
  pendingBetsCount: number;
}

export function DashboardHeader({ user, winRate, pendingBetsCount }: DashboardHeaderProps) {
  const { mode } = useCurrencyMode();
  const theme = useModeTheme();

  return (
    <>
      <div className={`text-center p-6 rounded-xl border-2 ${theme.borderColor} ${theme.cardBg} backdrop-blur-sm ${theme.glowShadow}`}>
        <h1 className={`text-4xl font-bold mb-2 ${theme.primaryText}`}>
          🌦️ Weather Betting
        </h1>
        <p className="text-muted-foreground">
          {theme.isVirtual ? 'Practice mode - Predict the weather, win virtual points!' : 'Real money mode - Predict the weather, win real prizes!'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={`${theme.card} border-2 ${theme.glowShadow}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {mode === 'virtual' ? '🎮 Virtual Balance' : '💰 Real Balance'}
            </CardTitle>
            <Coins className={`h-4 w-4 ${theme.primaryText}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${theme.primaryText}`}>
              {formatCurrency(mode === 'virtual' ? user.points : (user.balance_cents || 0), mode)}
            </div>
            <p className={`text-xs ${theme.secondaryText}`}>
              {mode === 'virtual' ? 'Practice points - free to play' : 'South African Rands'}
            </p>
          </CardContent>
        </Card>

        <Card className={`${theme.card} border-2 ${theme.glowShadow}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <TrendingUp className={`h-4 w-4 ${theme.accentText}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${theme.secondaryText}`}>{winRate}%</div>
            <p className="text-xs text-muted-foreground">Success Rate</p>
          </CardContent>
        </Card>

        <Card className={`${theme.card} border-2 ${theme.glowShadow}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Bets</CardTitle>
            <Activity className={`h-4 w-4 ${theme.accentText}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${theme.secondaryText}`}>{pendingBetsCount}</div>
            <p className="text-xs text-muted-foreground">Pending Results</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
