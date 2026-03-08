import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Coins, TrendingUp, Activity } from 'lucide-react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { DashboardActions } from './DashboardActions';
import BettingSlip from './BettingSlip';
import ParlayBettingSlip from './ParlayBettingSlip';
import { CombinedBettingSlip } from './CombinedBettingSlip';
import { MultiTimeComboBetting } from './MultiTimeComboBetting';
import MyBets from './MyBets';
import Leaderboard from './Leaderboard';
import ActiveBetsWeather from './ActiveBetsWeather';
import { DailyChallenges } from './DailyChallenges';
import { Achievements } from './Achievements';
import { LevelDisplay } from './LevelDisplay';
import { Perks } from './Perks';
import { Shop } from './Shop';
import { BonusTracker } from './BonusTracker';
import Analytics from './Analytics';
import { VolatilityChart } from './VolatilityChart';
import { StreakDisplay } from './StreakDisplay';
import { TransactionHistory } from './TransactionHistory';
import { CurrencyModeSwitcher } from './CurrencyModeSwitcher';
import { formatCurrency } from '@/lib/currency';
import { useCurrencyMode } from '@/contexts/CurrencyModeContext';
import { useModeTheme } from '@/hooks/useModeTheme';

const Dashboard = () => {
  const { mode } = useCurrencyMode();
  const theme = useModeTheme();
  const { user, bets, loading, pendingBets, winRate, refreshData } = useDashboardData();
  const [activeView, setActiveView] = useState<'dashboard' | 'betting' | 'parlay' | 'combined' | 'multitime' | 'mybets' | 'leaderboard' | 'shop' | 'analytics'>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) return null;

  if (activeView === 'betting') {
    return <BettingSlip onBack={() => setActiveView('dashboard')} onBetPlaced={refreshData} />;
  }

  if (activeView === 'parlay') {
    return <ParlayBettingSlip onBack={() => setActiveView('dashboard')} onBetPlaced={refreshData} />;
  }

  if (activeView === 'combined') {
    return <CombinedBettingSlip onBack={() => setActiveView('dashboard')} onBetPlaced={refreshData} />;
  }

  if (activeView === 'multitime') {
    return <MultiTimeComboBetting onBack={() => setActiveView('dashboard')} onBetPlaced={refreshData} />;
  }

  if (activeView === 'mybets') {
    return <MyBets onBack={() => setActiveView('dashboard')} onRefresh={refreshData} />;
  }

  if (activeView === 'leaderboard') {
    return <Leaderboard onBack={() => setActiveView('dashboard')} />;
  }

  if (activeView === 'shop') {
    return <Shop onBack={() => setActiveView('dashboard')} />;
  }

  if (activeView === 'analytics') {
    return <Analytics onBack={() => setActiveView('dashboard')} />;
  }

  return (
    <div className={`min-h-screen p-4 transition-colors duration-300 ${theme.gradient}`}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className={`text-center p-6 rounded-xl border-2 ${theme.borderColor} ${theme.cardBg} backdrop-blur-sm ${theme.glowShadow}`}>
          <h1 className={`text-4xl font-bold mb-2 ${theme.primaryText}`}>
            🌦️ Weather Betting
          </h1>
          <p className="text-muted-foreground">
            {theme.isVirtual ? 'Practice mode - Predict the weather, win virtual points!' : 'Real money mode - Predict the weather, win real prizes!'}
          </p>
        </div>

        {/* Currency Mode Switcher */}
        <CurrencyModeSwitcher />

        {/* Weather Alerts */}
        {bets.length > 0 && <ActiveBetsWeather bets={bets} />}

        {/* Level Display */}
        <LevelDisplay />

        {/* User Stats */}
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
              <div className={`text-2xl font-bold ${theme.secondaryText}`}>{pendingBets.length}</div>
              <p className="text-xs text-muted-foreground">Pending Results</p>
            </CardContent>
          </Card>
        </div>

        {/* Streak Display */}
        <StreakDisplay />

        {/* Daily Challenges */}
        <DailyChallenges />

        {/* Bonus Tracker */}
        <BonusTracker />

        {/* Transaction History */}
        <TransactionHistory />

        {/* Achievements */}
        <Achievements />

        {/* Unlockable Perks */}
        <Perks />

        {/* Volatility & Accuracy Chart */}
        <VolatilityChart />

        <DashboardActions betsCount={bets.length} onViewChange={setActiveView} />

        {/* Recent Activity */}
        {bets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Bets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {bets.slice(0, 3).map((bet) => (
                  <div key={bet.id} className="flex justify-between items-center p-2 border rounded">
                    <div>
                      <span className="font-medium">{bet.city}</span>
                      <span className="text-muted-foreground ml-2">
                        {bet.prediction_type === 'rain' ? `Rain: ${bet.prediction_value}` : `Temp: ${bet.prediction_value}°C`}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{bet.stake} pts</div>
                      <div className={`text-sm ${
                        bet.result === 'win' ? 'text-success' : 
                        bet.result === 'loss' ? 'text-destructive' : 
                        'text-muted-foreground'
                      }`}>
                        {bet.result === 'pending' ? 'Pending' : bet.result.toUpperCase()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Dashboard;