import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { PendingBet, PendingParlay, PendingCombined } from '@/components/admin/settlement/types';

export const usePendingBets = () => {
  const [pendingCounts, setPendingCounts] = useState({ bets: 0, parlays: 0, combinedBets: 0 });
  const [loading, setLoading] = useState(true);
  const [pendingBets, setPendingBets] = useState<PendingBet[]>([]);
  const [pendingParlays, setPendingParlays] = useState<PendingParlay[]>([]);
  const [pendingCombined, setPendingCombined] = useState<PendingCombined[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const fetchPendingCounts = useCallback(async () => {
    setLoading(true);
    try {
      const [bets, parlays, combined] = await Promise.all([
        supabase.from('bets').select('id', { count: 'exact', head: true }).eq('result', 'pending'),
        supabase.from('parlays').select('id', { count: 'exact', head: true }).eq('result', 'pending'),
        supabase.from('combined_bets').select('id', { count: 'exact', head: true }).eq('result', 'pending'),
      ]);
      setPendingCounts({ bets: bets.count ?? 0, parlays: parlays.count ?? 0, combinedBets: combined.count ?? 0 });
    } catch (error) {
      console.error('Error fetching pending counts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPendingDetails = useCallback(async () => {
    setDetailsLoading(true);
    try {
      const [betsRes, parlaysRes, combinedRes] = await Promise.all([
        supabase.from('bets').select('id, city, prediction_type, prediction_value, odds, stake, currency_type, target_date, expires_at, created_at, has_insurance').eq('result', 'pending').order('target_date', { ascending: true }).limit(100),
        supabase.from('parlays').select('id, combined_odds, total_stake, currency_type, expires_at, created_at, has_insurance').eq('result', 'pending').order('created_at', { ascending: true }).limit(100),
        supabase.from('combined_bets').select('id, city, combined_odds, total_stake, currency_type, target_date, created_at, has_insurance').eq('result', 'pending').order('target_date', { ascending: true }).limit(100),
      ]);
      setPendingBets(betsRes.data ?? []);
      setPendingParlays(parlaysRes.data ?? []);
      setPendingCombined(combinedRes.data ?? []);
    } catch (error) {
      console.error('Error fetching pending details:', error);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchPendingCounts(), fetchPendingDetails()]);
  }, [fetchPendingCounts, fetchPendingDetails]);

  useEffect(() => {
    fetchPendingCounts();
    fetchPendingDetails();
  }, [fetchPendingCounts, fetchPendingDetails]);

  return {
    pendingCounts,
    loading,
    pendingBets,
    pendingParlays,
    pendingCombined,
    detailsLoading,
    fetchPendingCounts,
    fetchPendingDetails,
    refreshAll,
  };
};
