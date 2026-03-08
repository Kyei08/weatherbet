import { useState, useEffect, useCallback, useMemo } from 'react';
import { getUser, getRecentBets } from '@/lib/supabase-auth-storage';
import { User, Bet } from '@/types/supabase-betting';

interface DashboardData {
  user: User | null;
  bets: Bet[];
  loading: boolean;
  error: string | null;
  pendingBets: Bet[];
  settledBets: Bet[];
  winRate: string;
  refreshData: () => Promise<void>;
}

export function useDashboardData(): DashboardData {
  const [user, setUser] = useState<User | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [userData, betsData] = await Promise.all([
        getUser(),
        getRecentBets(),
      ]);
      setUser(userData);
      setBets(betsData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard data';
      console.error('Error fetching dashboard data:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refreshData = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  const pendingBets = useMemo(() => bets.filter(bet => bet.result === 'pending'), [bets]);
  const settledBets = useMemo(() => bets.filter(bet => bet.result !== 'pending'), [bets]);
  const winRate = useMemo(() => settledBets.length > 0
    ? (bets.filter(bet => bet.result === 'win').length / settledBets.length * 100).toFixed(1)
    : '0', [bets, settledBets]);

  return {
    user,
    bets,
    loading,
    error,
    pendingBets,
    settledBets,
    winRate,
    refreshData,
  };
}
