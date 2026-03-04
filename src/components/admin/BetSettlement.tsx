import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logAdminAction } from '@/lib/admin';
import { useToast } from '@/hooks/use-toast';
import { usePendingBets } from '@/hooks/usePendingBets';
import { ResolutionPanel } from './settlement/ResolutionPanel';
import { InspectionTable } from './settlement/InspectionTable';
import type { ResolutionLog } from './settlement/types';

export const BetSettlement = () => {
  const { toast } = useToast();
  const [resolving, setResolving] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [logs, setLogs] = useState<ResolutionLog[]>([]);

  const {
    pendingCounts,
    loading,
    pendingBets,
    pendingParlays,
    pendingCombined,
    detailsLoading,
    fetchPendingCounts,
    fetchPendingDetails,
    refreshAll,
  } = usePendingBets();

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
        await refreshAll();
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
