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
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          {/* Stats cards skeleton */}
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
          {/* Currency switcher skeleton */}
          <Skeleton className="h-10 w-full rounded-lg" />
          {/* Content sections skeleton */}
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
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
        <div className="animate-fade-in" style={{ animationDelay: '0ms', animationFillMode: 'both' }}>
          <DashboardHeader user={user} winRate={winRate} pendingBetsCount={pendingBets.length} />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: '50ms', animationFillMode: 'both' }}>
          <CurrencyModeSwitcher />
        </div>
        {bets.length > 0 && (
          <div className="animate-fade-in" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
            <ActiveBetsWeather bets={bets} />
          </div>
        )}
        <div className="animate-fade-in" style={{ animationDelay: '150ms', animationFillMode: 'both' }}>
          <LevelDisplay />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
          <StreakDisplay />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: '250ms', animationFillMode: 'both' }}>
          <DailyChallenges />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
          <BonusTracker />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: '350ms', animationFillMode: 'both' }}>
          <TransactionHistory />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: '400ms', animationFillMode: 'both' }}>
          <Achievements />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: '450ms', animationFillMode: 'both' }}>
          <Perks />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: '500ms', animationFillMode: 'both' }}>
          <VolatilityChart />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: '550ms', animationFillMode: 'both' }}>
          <DashboardActions betsCount={bets.length} onViewChange={setActiveView} />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: '600ms', animationFillMode: 'both' }}>
          <RecentBets bets={bets} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
