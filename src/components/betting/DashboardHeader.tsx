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
      <div className={`text-center p-4 sm:p-6 rounded-xl border-2 ${theme.borderColor} ${theme.cardBg} backdrop-blur-sm ${theme.glowShadow}`}>
        <h1 className={`text-2xl sm:text-4xl font-bold mb-1 sm:mb-2 ${theme.primaryText}`}>
          🌦️ Weather Betting
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {theme.isVirtual ? 'Practice mode - Predict the weather, win virtual points!' : 'Real money mode - Predict the weather, win real prizes!'}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card className={`${theme.card} border-2 ${theme.glowShadow}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 pt-3 sm:px-6 sm:pt-6">
            <CardTitle className="text-[10px] sm:text-sm font-medium truncate">
              {mode === 'virtual' ? '🎮 Balance' : '💰 Balance'}
            </CardTitle>
            <Coins className={`h-3 w-3 sm:h-4 sm:w-4 ${theme.primaryText} shrink-0`} />
          </CardHeader>
          <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
            <div className={`text-lg sm:text-2xl font-bold ${theme.primaryText}`}>
              {formatCurrency(mode === 'virtual' ? user.points : (user.balance_cents || 0), mode)}
            </div>
            <p className={`text-[10px] sm:text-xs ${theme.secondaryText} hidden sm:block`}>
              {mode === 'virtual' ? 'Practice points - free to play' : 'South African Rands'}
            </p>
          </CardContent>
        </Card>

        <Card className={`${theme.card} border-2 ${theme.glowShadow}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 pt-3 sm:px-6 sm:pt-6">
            <CardTitle className="text-[10px] sm:text-sm font-medium">Win Rate</CardTitle>
            <TrendingUp className={`h-3 w-3 sm:h-4 sm:w-4 ${theme.accentText} shrink-0`} />
          </CardHeader>
          <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
            <div className={`text-lg sm:text-2xl font-bold ${theme.secondaryText}`}>{winRate}%</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Success Rate</p>
          </CardContent>
        </Card>

        <Card className={`${theme.card} border-2 ${theme.glowShadow}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 pt-3 sm:px-6 sm:pt-6">
            <CardTitle className="text-[10px] sm:text-sm font-medium">Active</CardTitle>
            <Activity className={`h-3 w-3 sm:h-4 sm:w-4 ${theme.accentText} shrink-0`} />
          </CardHeader>
          <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
            <div className={`text-lg sm:text-2xl font-bold ${theme.secondaryText}`}>{pendingBetsCount}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Pending Results</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
