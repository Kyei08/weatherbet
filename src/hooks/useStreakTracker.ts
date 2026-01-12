import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrencyMode } from '@/contexts/CurrencyModeContext';
import { getStreakInfo, StreakInfo, STREAK_CONFIG } from '@/lib/streak-bonus';

interface StreakData {
  streakInfo: StreakInfo;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to track and manage user's winning streak
 * Calculates streak from settled bets in chronological order
 */
export function useStreakTracker(): StreakData {
  const { mode } = useCurrencyMode();
  const [streakInfo, setStreakInfo] = useState<StreakInfo>(getStreakInfo(0));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calculateStreak = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStreakInfo(getStreakInfo(0));
        return;
      }

      const currencyType = mode === 'real' ? 'real' : 'virtual';

      // Get all settled bets ordered by updated_at (when they were resolved)
      const { data: bets, error: betsError } = await supabase
        .from('bets')
        .select('id, result, updated_at')
        .eq('user_id', user.id)
        .eq('currency_type', currencyType)
        .in('result', ['win', 'loss', 'partial'])
        .order('updated_at', { ascending: false });

      if (betsError) throw betsError;

      // Get parlays
      const { data: parlays, error: parlaysError } = await supabase
        .from('parlays')
        .select('id, result, updated_at')
        .eq('user_id', user.id)
        .eq('currency_type', currencyType)
        .in('result', ['win', 'loss', 'partial'])
        .order('updated_at', { ascending: false });

      if (parlaysError) throw parlaysError;

      // Get combined bets
      const { data: combinedBets, error: combinedError } = await supabase
        .from('combined_bets')
        .select('id, result, updated_at')
        .eq('user_id', user.id)
        .eq('currency_type', currencyType)
        .in('result', ['win', 'loss', 'partial'])
        .order('updated_at', { ascending: false });

      if (combinedError) throw combinedError;

      // Combine all bets and sort by updated_at descending
      const allResults = [
        ...(bets || []).map(b => ({ result: b.result, time: b.updated_at })),
        ...(parlays || []).map(p => ({ result: p.result, time: p.updated_at })),
        ...(combinedBets || []).map(c => ({ result: c.result, time: c.updated_at })),
      ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

      // Calculate current streak (counting consecutive wins from most recent)
      let currentStreak = 0;
      for (const bet of allResults) {
        // Count wins and partial wins as streak continuers
        if (bet.result === 'win' || bet.result === 'partial') {
          currentStreak++;
        } else {
          // Streak broken by a loss
          break;
        }
      }

      // Calculate longest streak ever
      let longestStreak = 0;
      let tempStreak = 0;
      // Process in chronological order for longest streak
      const chronological = [...allResults].reverse();
      for (const bet of chronological) {
        if (bet.result === 'win' || bet.result === 'partial') {
          tempStreak++;
          longestStreak = Math.max(longestStreak, tempStreak);
        } else {
          tempStreak = 0;
        }
      }

      setStreakInfo(getStreakInfo(currentStreak, longestStreak));
    } catch (err) {
      console.error('Error calculating streak:', err);
      setError(err instanceof Error ? err.message : 'Failed to calculate streak');
      setStreakInfo(getStreakInfo(0));
    } finally {
      setIsLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    calculateStreak();
  }, [calculateStreak]);

  // Subscribe to bet updates
  useEffect(() => {
    const channel = supabase
      .channel('streak-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bets' },
        () => calculateStreak()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'parlays' },
        () => calculateStreak()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'combined_bets' },
        () => calculateStreak()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [calculateStreak]);

  return {
    streakInfo,
    isLoading,
    error,
    refresh: calculateStreak,
  };
}
