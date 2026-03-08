import { useState, useCallback, ReactNode } from 'react';
import BettingSlip from '@/components/betting/BettingSlip';
import ParlayBettingSlip from '@/components/betting/ParlayBettingSlip';
import { CombinedBettingSlip } from '@/components/betting/CombinedBettingSlip';
import { MultiTimeComboBetting } from '@/components/betting/MultiTimeComboBetting';
import MyBets from '@/components/betting/MyBets';
import Leaderboard from '@/components/betting/Leaderboard';
import { Shop } from '@/components/betting/Shop';
import Analytics from '@/components/betting/Analytics';

export type ActiveView = 'dashboard' | 'betting' | 'parlay' | 'combined' | 'multitime' | 'mybets' | 'leaderboard' | 'shop' | 'analytics';

interface UseDashboardViewResult {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  goBack: () => void;
  renderSubView: (refreshData: () => Promise<void>) => ReactNode | null;
}

export function useDashboardView(): UseDashboardViewResult {
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');

  const goBack = useCallback(() => setActiveView('dashboard'), []);

  const renderSubView = useCallback((refreshData: () => Promise<void>): ReactNode | null => {
    switch (activeView) {
      case 'betting':
        return <BettingSlip onBack={goBack} onBetPlaced={refreshData} />;
      case 'parlay':
        return <ParlayBettingSlip onBack={goBack} onBetPlaced={refreshData} />;
      case 'combined':
        return <CombinedBettingSlip onBack={goBack} onBetPlaced={refreshData} />;
      case 'multitime':
        return <MultiTimeComboBetting onBack={goBack} onBetPlaced={refreshData} />;
      case 'mybets':
        return <MyBets onBack={goBack} onRefresh={refreshData} />;
      case 'leaderboard':
        return <Leaderboard onBack={goBack} />;
      case 'shop':
        return <Shop onBack={goBack} />;
      case 'analytics':
        return <Analytics onBack={goBack} />;
      default:
        return null;
    }
  }, [activeView, goBack]);

  return { activeView, setActiveView, goBack, renderSubView };
}
