import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logAdminAction } from '@/lib/admin';
import { useToast } from '@/hooks/use-toast';
import { ResolutionPanel } from './settlement/ResolutionPanel';
import { InspectionTable } from './settlement/InspectionTable';
import type { ResolutionLog, PendingBet, PendingParlay, PendingCombined } from './settlement/types';

export const BetSettlement = () => {
  const { toast } = useToast();
  const [resolving, setResolving] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [logs, setLogs] = useState<ResolutionLog[]>([]);
  const [pendingCounts, setPendingCounts] = useState({ bets: 0, parlays: 0, combinedBets: 0 });
  const [loading, setLoading] = useState(true);
  const [pendingBets, setPendingBets] = useState<PendingBet[]>([]);
  const [pendingParlays, setPendingParlays] = useState<PendingParlay[]>([]);
  const [pendingCombined, setPendingCombined] = useState<PendingCombined[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    fetchPendingCounts();
    fetchPendingDetails();
  }, []);

  const fetchPendingCounts = async () => {
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
  };

  const fetchPendingDetails = async () => {
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
  };

  const handleResolve = async () => {
    setResolving(true);
    const startTime = Date.now();
    try {
      await logAdminAction('trigger_bet_resolution', undefined, undefined, {
        pending_bets: pendingCounts.bets,
        pending_parlays: pendingCounts.parlays,
        pending_combined: pendingCounts.combinedBets,
      });

      const { data, error } = await supabase.functions.invoke('resolve-bets', { method: 'POST' });
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (error) {
        setLogs(prev => [{ timestamp: new Date().toISOString(), status: 'error', message: error.message || 'Edge function call failed', resolved: 0 }, ...prev]);
        setLastResult({ error: true, message: error.message, elapsed });
        toast({ title: 'Resolution Failed', description: error.message, variant: 'destructive' });
      } else {
        const resolved = (data?.resolved_bets ?? 0) + (data?.resolved_parlays ?? 0) + (data?.resolved_combined_bets ?? 0);
        setLogs(prev => [{ timestamp: new Date().toISOString(), status: 'success', message: `Resolved ${resolved} bets in ${elapsed}s`, resolved }, ...prev]);
        setLastResult({ ...data, elapsed });
        toast({ title: 'Resolution Complete', description: `${resolved} bets resolved in ${elapsed}s` });
        await Promise.all([fetchPendingCounts(), fetchPendingDetails()]);
      }
    } catch (err: any) {
      setLogs(prev => [{ timestamp: new Date().toISOString(), status: 'error', message: err.message || 'Unexpected error', resolved: 0 }, ...prev]);
      toast({ title: 'Error', description: err.message || 'Unexpected error during resolution', variant: 'destructive' });
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="space-y-6">
      <ResolutionPanel
        pendingCounts={pendingCounts}
        loading={loading}
        resolving={resolving}
        lastResult={lastResult}
        logs={logs}
        onResolve={handleResolve}
        onRefresh={fetchPendingCounts}
      />
      <InspectionTable
        pendingBets={pendingBets}
        pendingParlays={pendingParlays}
        pendingCombined={pendingCombined}
        detailsLoading={detailsLoading}
        onRefresh={fetchPendingDetails}
      />
    </div>
  );
};
