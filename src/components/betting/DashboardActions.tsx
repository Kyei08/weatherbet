import { Button } from '@/components/ui/button';
import { Activity, Layers, Zap, ShoppingCart, History, TrendingUp, MapPin, Scale, Trophy, Shield, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { useModeTheme } from '@/hooks/useModeTheme';

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
    <>
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Button
          size="lg"
          className={`h-20 text-lg ${theme.buttonPrimary} border-2 ${theme.borderColor} ${theme.glowShadow} hover:scale-105 transition-all`}
          onClick={() => onViewChange('betting')}
        >
          🎯 Single Bet
        </Button>
        <Button
          size="lg"
          className={`h-20 text-lg ${theme.buttonSecondary} border-2 ${theme.borderColor} ${theme.glowShadow} hover:scale-105 transition-all`}
          onClick={() => onViewChange('combined')}
        >
          <Activity className="mr-2 h-5 w-5" />
          ⚡ Combined Bet
        </Button>
        <Button
          size="lg"
          className={`h-20 text-lg ${theme.accent} ${theme.primaryForeground} border-2 ${theme.borderColor} ${theme.glowShadow} hover:scale-105 transition-all`}
          onClick={() => onViewChange('parlay')}
        >
          <Layers className="mr-2 h-5 w-5" />
          💰 Parlay Bet
        </Button>
        <Button
          size="lg"
          className={`h-20 text-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white border-2 ${theme.borderColor} ${theme.glowShadow} hover:scale-105 transition-all`}
          onClick={() => onViewChange('multitime')}
        >
          <Zap className="mr-2 h-5 w-5" />
          ⏰ Multi-Time Combo
        </Button>
        <Button
          variant="outline"
          size="lg"
          className={`h-20 text-lg border-2 ${theme.borderColorHeavy} ${theme.hoverBg} hover:scale-105 transition-all md:col-span-2 lg:col-span-2`}
          onClick={() => onViewChange('mybets')}
        >
          📊 My Bets ({betsCount})
        </Button>
      </div>

      {/* Action Buttons */}
      <div className={`grid grid-cols-2 gap-4 ${isAdminUser ? 'md:grid-cols-8' : 'md:grid-cols-7'}`}>
        <Button variant="outline" size="lg" className="h-16 text-lg" onClick={() => navigate('/cashout')}>
          <DollarSign className="mr-2 h-5 w-5" />
          💰 Cash Out
        </Button>
        <Button variant="outline" size="lg" className="h-16 text-lg" onClick={() => onViewChange('shop')}>
          <ShoppingCart className="mr-2 h-5 w-5" />
          🛍️ Shop
        </Button>
        <Button variant="outline" size="lg" className="h-16 text-lg" onClick={() => navigate('/purchase-history')}>
          <History className="mr-2 h-5 w-5" />
          📜 History
        </Button>
        <Button variant="outline" size="lg" className="h-16 text-lg" onClick={() => onViewChange('analytics')}>
          <TrendingUp className="mr-2 h-5 w-5" />
          📊 Analytics
        </Button>
        <Button variant="outline" size="lg" className="h-16 text-lg" onClick={() => navigate('/city-analytics')}>
          <MapPin className="mr-2 h-5 w-5" />
          🏙️ Cities
        </Button>
        <Button variant="outline" size="lg" className="h-16 text-lg" onClick={() => navigate('/city-comparison')}>
          <Scale className="mr-2 h-5 w-5" />
          ⚖️ Compare
        </Button>
        <Button variant="outline" size="lg" className="h-16 text-lg" onClick={() => onViewChange('leaderboard')}>
          <Trophy className="mr-2 h-5 w-5" />
          🏆 Leaderboard
        </Button>
        {isAdminUser && (
          <Button
            variant="default"
            size="lg"
            className="h-16 text-lg bg-gradient-to-r from-purple-600 to-blue-600"
            onClick={() => navigate('/admin')}
          >
            <Shield className="mr-2 h-5 w-5" />
            ⚡ Admin
          </Button>
        )}
      </div>
    </>
  );
}
