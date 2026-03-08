import { useState } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { DashboardActions } from './DashboardActions';
import { DashboardHeader } from './DashboardHeader';
import { RecentBets } from './RecentBets';
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
import { useModeTheme } from '@/hooks/useModeTheme';

const Dashboard = () => {
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
        <DashboardHeader user={user} winRate={winRate} pendingBetsCount={pendingBets.length} />

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

        <RecentBets bets={bets} />
      </div>
    </div>
  );
};

export default Dashboard;