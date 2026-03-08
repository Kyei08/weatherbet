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
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { RefreshCw } from 'lucide-react';

const Dashboard = () => {
  const theme = useModeTheme();
  const { user, bets, loading, error, pendingBets, winRate, refreshData } = useDashboardData();
  const { activeView, setActiveView, renderSubView } = useDashboardView();
  const { containerRef, pullDistance, isRefreshing, isTriggered, progress } = usePullToRefresh({
    onRefresh: refreshData,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
          <Skeleton className="h-10 w-full rounded-lg" />
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
    <div
      ref={containerRef}
      className={`min-h-screen p-4 transition-colors duration-300 ${theme.gradient} overflow-auto`}
      style={{ overscrollBehavior: 'contain' }}
    >
      {/* Pull-to-refresh indicator */}
      <div
        className="flex justify-center items-center overflow-hidden transition-[height] duration-200 ease-out"
        style={{ height: pullDistance > 0 ? `${pullDistance}px` : '0px' }}
      >
        <div
          className={`flex flex-col items-center gap-1 transition-opacity ${pullDistance > 10 ? 'opacity-100' : 'opacity-0'}`}
        >
          <RefreshCw
            className={`h-5 w-5 text-primary transition-transform duration-200 ${isRefreshing ? 'animate-spin' : ''}`}
            style={{ transform: isRefreshing ? undefined : `rotate(${progress * 360}deg)` }}
          />
          <span className="text-xs text-muted-foreground">
            {isRefreshing ? 'Refreshing…' : isTriggered ? 'Release to refresh' : 'Pull to refresh'}
          </span>
        </div>
      </div>

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
