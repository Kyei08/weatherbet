import { useState, useEffect, useCallback, useMemo } from 'react';
import { getUser, getRecentBets } from '@/lib/supabase-auth-storage';
import { User, Bet } from '@/types/supabase-betting';

interface DashboardData {
  user: User | null;
  bets: Bet[];
  loading: boolean;
  pendingBets: Bet[];
  settledBets: Bet[];
  winRate: string;
  refreshData: () => Promise<void>;
}

export function useDashboardData(): DashboardData {
  const [user, setUser] = useState<User | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [userData, betsData] = await Promise.all([
        getUser(),
        getRecentBets(),
      ]);
      setUser(userData);
      setBets(betsData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refreshData = useCallback(async () => {
    try {
      const [userData, betsData] = await Promise.all([
        getUser(),
        getRecentBets(),
      ]);
      setUser(userData);
      setBets(betsData);
    } catch (error) {
      console.error('Error refreshing dashboard data:', error);
    }
  }, []);

  const pendingBets = bets.filter(bet => bet.result === 'pending');
  const settledBets = bets.filter(bet => bet.result !== 'pending');
  const winRate = settledBets.length > 0
    ? (bets.filter(bet => bet.result === 'win').length / settledBets.length * 100).toFixed(1)
    : '0';

  return {
    user,
    bets,
    loading,
    pendingBets,
    settledBets,
    winRate,
    refreshData,
  };
}
