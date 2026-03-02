import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlayCircle, Loader2, CheckCircle, AlertTriangle, Clock, RefreshCw, Eye, MapPin, Target, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { logAdminAction } from '@/lib/admin';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, isPast } from 'date-fns';

interface ResolutionLog {
  timestamp: string;
  status: 'success' | 'error';
  message: string;
  resolved: number;
}

interface PendingBet {
  id: string;
  city: string;
  prediction_type: string;
  prediction_value: string;
  odds: number;
  stake: number;
  currency_type: string;
  target_date: string | null;
  expires_at: string | null;
  created_at: string;
  has_insurance: boolean;
}

interface PendingParlay {
  id: string;
  combined_odds: number;
  total_stake: number;
  currency_type: string;
  expires_at: string | null;
  created_at: string;
  has_insurance: boolean;
}

interface PendingCombined {
  id: string;
  city: string;
  combined_odds: number;
  total_stake: number;
  currency_type: string;
  target_date: string;
  created_at: string;
  has_insurance: boolean;
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

  const getTimeRemaining = (date: string | null) => {
    if (!date) return <Badge variant="secondary">No date</Badge>;
    if (isPast(new Date(date))) return <Badge variant="destructive">Overdue</Badge>;
    return <Badge variant="outline">{formatDistanceToNow(new Date(date), { addSuffix: false })} left</Badge>;
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

        // Refresh counts and details
        await Promise.all([fetchPendingCounts(), fetchPendingDetails()]);
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

      {/* Pending Bet Inspection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Pending Bet Inspection
              </CardTitle>
              <CardDescription>Detailed view of all pending bets awaiting resolution</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchPendingDetails} disabled={detailsLoading} className="gap-2">
              <RefreshCw className={`h-3 w-3 ${detailsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="bets">
            <TabsList className="mb-4">
              <TabsTrigger value="bets" className="gap-1">
                <Target className="h-3 w-3" />
                Bets ({pendingBets.length})
              </TabsTrigger>
              <TabsTrigger value="parlays" className="gap-1">
                <TrendingUp className="h-3 w-3" />
                Parlays ({pendingParlays.length})
              </TabsTrigger>
              <TabsTrigger value="combined" className="gap-1">
                <MapPin className="h-3 w-3" />
                Combined ({pendingCombined.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bets">
              {pendingBets.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No pending bets</p>
              ) : (
                <div className="rounded-md border overflow-auto max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>City</TableHead>
                        <TableHead>Prediction</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Odds</TableHead>
                        <TableHead>Stake</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Insurance</TableHead>
                        <TableHead>Time Remaining</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingBets.map(bet => (
                        <TableRow key={bet.id}>
                          <TableCell className="font-medium">{bet.city}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{bet.prediction_type}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">{bet.prediction_value}</TableCell>
                          <TableCell className="font-mono">{Number(bet.odds).toFixed(2)}x</TableCell>
                          <TableCell>{bet.stake}</TableCell>
                          <TableCell>
                            <Badge variant={bet.currency_type === 'real' ? 'default' : 'secondary'}>
                              {bet.currency_type}
                            </Badge>
                          </TableCell>
                          <TableCell>{bet.has_insurance ? '🛡️' : '—'}</TableCell>
                          <TableCell>{getTimeRemaining(bet.target_date || bet.expires_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="parlays">
              {pendingParlays.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No pending parlays</p>
              ) : (
                <div className="rounded-md border overflow-auto max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Combined Odds</TableHead>
                        <TableHead>Stake</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Insurance</TableHead>
                        <TableHead>Time Remaining</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingParlays.map(parlay => (
                        <TableRow key={parlay.id}>
                          <TableCell className="font-mono text-xs">{parlay.id.slice(0, 8)}…</TableCell>
                          <TableCell className="font-mono">{Number(parlay.combined_odds).toFixed(2)}x</TableCell>
                          <TableCell>{parlay.total_stake}</TableCell>
                          <TableCell>
                            <Badge variant={parlay.currency_type === 'real' ? 'default' : 'secondary'}>
                              {parlay.currency_type}
                            </Badge>
                          </TableCell>
                          <TableCell>{parlay.has_insurance ? '🛡️' : '—'}</TableCell>
                          <TableCell>{getTimeRemaining(parlay.expires_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="combined">
              {pendingCombined.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No pending combined bets</p>
              ) : (
                <div className="rounded-md border overflow-auto max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>City</TableHead>
                        <TableHead>Combined Odds</TableHead>
                        <TableHead>Stake</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Insurance</TableHead>
                        <TableHead>Time Remaining</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingCombined.map(bet => (
                        <TableRow key={bet.id}>
                          <TableCell className="font-medium">{bet.city}</TableCell>
                          <TableCell className="font-mono">{Number(bet.combined_odds).toFixed(2)}x</TableCell>
                          <TableCell>{bet.total_stake}</TableCell>
                          <TableCell>
                            <Badge variant={bet.currency_type === 'real' ? 'default' : 'secondary'}>
                              {bet.currency_type}
                            </Badge>
                          </TableCell>
                          <TableCell>{bet.has_insurance ? '🛡️' : '—'}</TableCell>
                          <TableCell>{getTimeRemaining(bet.target_date)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
