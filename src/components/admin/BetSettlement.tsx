import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlayCircle, Loader2, CheckCircle, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { logAdminAction } from '@/lib/admin';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/currency';

interface ResolutionLog {
  timestamp: string;
  status: 'success' | 'error';
  message: string;
  resolved: number;
}

export const BetSettlement = () => {
  const { toast } = useToast();
  const [resolving, setResolving] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [logs, setLogs] = useState<ResolutionLog[]>([]);
  const [pendingCounts, setPendingCounts] = useState({
    bets: 0,
    parlays: 0,
    combinedBets: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingCounts();
  }, []);

  const fetchPendingCounts = async () => {
    setLoading(true);
    try {
      const [bets, parlays, combined] = await Promise.all([
        supabase.from('bets').select('id', { count: 'exact', head: true }).eq('result', 'pending'),
        supabase.from('parlays').select('id', { count: 'exact', head: true }).eq('result', 'pending'),
        supabase.from('combined_bets').select('id', { count: 'exact', head: true }).eq('result', 'pending'),
      ]);

      setPendingCounts({
        bets: bets.count ?? 0,
        parlays: parlays.count ?? 0,
        combinedBets: combined.count ?? 0,
      });
    } catch (error) {
      console.error('Error fetching pending counts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    setResolving(true);
    const startTime = Date.now();

    try {
      // Log admin action before invoking
      await logAdminAction('trigger_bet_resolution', undefined, undefined, {
        pending_bets: pendingCounts.bets,
        pending_parlays: pendingCounts.parlays,
        pending_combined: pendingCounts.combinedBets,
      });

      const { data, error } = await supabase.functions.invoke('resolve-bets', {
        method: 'POST',
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (error) {
        const log: ResolutionLog = {
          timestamp: new Date().toISOString(),
          status: 'error',
          message: error.message || 'Edge function call failed',
          resolved: 0,
        };
        setLogs(prev => [log, ...prev]);
        setLastResult({ error: true, message: error.message, elapsed });

        toast({
          title: 'Resolution Failed',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        const resolved = (data?.resolved_bets ?? 0) + (data?.resolved_parlays ?? 0) + (data?.resolved_combined_bets ?? 0);
        const log: ResolutionLog = {
          timestamp: new Date().toISOString(),
          status: 'success',
          message: `Resolved ${resolved} bets in ${elapsed}s`,
          resolved,
        };
        setLogs(prev => [log, ...prev]);
        setLastResult({ ...data, elapsed });

        toast({
          title: 'Resolution Complete',
          description: `${resolved} bets resolved in ${elapsed}s`,
        });

        // Refresh counts
        await fetchPendingCounts();
      }
    } catch (err: any) {
      const log: ResolutionLog = {
        timestamp: new Date().toISOString(),
        status: 'error',
        message: err.message || 'Unexpected error',
        resolved: 0,
      };
      setLogs(prev => [log, ...prev]);

      toast({
        title: 'Error',
        description: err.message || 'Unexpected error during resolution',
        variant: 'destructive',
      });
    } finally {
      setResolving(false);
    }
  };

  const totalPending = pendingCounts.bets + pendingCounts.parlays + pendingCounts.combinedBets;

  return (
    <div className="space-y-6">
      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5" />
            Bet Settlement
          </CardTitle>
          <CardDescription>
            Trigger server-side bet resolution via the resolve-bets edge function.
            All settlement logic runs securely on the server with service_role access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Resolution fetches live weather data and settles bets whose target date or expiry has passed.
              Only bets that are ready for resolution (based on category timing rules) will be settled.
            </AlertDescription>
          </Alert>

          {/* Pending Counts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Pending Bets</span>
                  <Badge variant={pendingCounts.bets > 0 ? 'default' : 'secondary'}>
                    {loading ? '...' : pendingCounts.bets}
                  </Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Pending Parlays</span>
                  <Badge variant={pendingCounts.parlays > 0 ? 'default' : 'secondary'}>
                    {loading ? '...' : pendingCounts.parlays}
                  </Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Pending Combined</span>
                  <Badge variant={pendingCounts.combinedBets > 0 ? 'default' : 'secondary'}>
                    {loading ? '...' : pendingCounts.combinedBets}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <Button
              size="lg"
              onClick={handleResolve}
              disabled={resolving || totalPending === 0}
              className="gap-2"
            >
              {resolving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Resolving...
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4" />
                  Resolve All Pending ({totalPending})
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={fetchPendingCounts}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Last Result */}
          {lastResult && !lastResult.error && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  Last Resolution Result ({lastResult.elapsed}s)
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Bets:</span>{' '}
                    <span className="font-medium">{lastResult.resolved_bets ?? 0}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Parlays:</span>{' '}
                    <span className="font-medium">{lastResult.resolved_parlays ?? 0}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Combined:</span>{' '}
                    <span className="font-medium">{lastResult.resolved_combined_bets ?? 0}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Skipped:</span>{' '}
                    <span className="font-medium">{lastResult.skipped ?? 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Resolution History */}
      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Session Resolution Log
            </CardTitle>
            <CardDescription>Log of resolution runs in this session (not persisted)</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Resolved</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{log.message}</TableCell>
                    <TableCell className="font-medium">{log.resolved}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
