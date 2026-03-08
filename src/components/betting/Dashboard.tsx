import { useDashboardData } from '@/hooks/useDashboardData';
import { useDashboardView } from '@/hooks/useDashboardView';
import { DashboardActions } from './DashboardActions';
import { DashboardHeader } from './DashboardHeader';
import { RecentBets } from './RecentBets';
import ActiveBetsWeather from './ActiveBetsWeather';
import { DailyChallenges } from './DailyChallenges';
import { Achievements } from './Achievements';
import { LevelDisplay } from './LevelDisplay';
import { Perks } from './Perks';
import { BonusTracker } from './BonusTracker';
import { VolatilityChart } from './VolatilityChart';
import { StreakDisplay } from './StreakDisplay';
import { TransactionHistory } from './TransactionHistory';
import { CurrencyModeSwitcher } from './CurrencyModeSwitcher';
import { useModeTheme } from '@/hooks/useModeTheme';
import { Skeleton } from '@/components/ui/skeleton';

const Dashboard = () => {
  const theme = useModeTheme();
  const { user, bets, loading, error, pendingBets, winRate, refreshData } = useDashboardData();
  const { activeView, setActiveView, renderSubView } = useDashboardView();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-destructive font-medium">{error}</p>
          <button
            onClick={refreshData}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const subView = renderSubView(refreshData);
  if (subView) return <>{subView}</>;

  return (
    <div className={`min-h-screen p-4 transition-colors duration-300 ${theme.gradient}`}>
      <div className="max-w-4xl mx-auto space-y-6">
        <DashboardHeader user={user} winRate={winRate} pendingBetsCount={pendingBets.length} />
        <CurrencyModeSwitcher />
        {bets.length > 0 && <ActiveBetsWeather bets={bets} />}
        <LevelDisplay />
        <StreakDisplay />
        <DailyChallenges />
        <BonusTracker />
        <TransactionHistory />
        <Achievements />
        <Perks />
        <VolatilityChart />
        <DashboardActions betsCount={bets.length} onViewChange={setActiveView} />
        <RecentBets bets={bets} />
      </div>
    </div>
  );
};

export default Dashboard;
