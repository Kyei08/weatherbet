import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { PlayCircle, Loader2, CheckCircle, AlertTriangle, Clock, RefreshCw, Eye, MapPin, Target, TrendingUp, ArrowUpDown, Filter, X, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { logAdminAction } from '@/lib/admin';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, isPast } from 'date-fns';

type SortField = 'odds' | 'stake' | 'time' | 'city';
type SortDir = 'asc' | 'desc';

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
  const [filterCity, setFilterCity] = useState<string>('all');
  const [filterPrediction, setFilterPrediction] = useState<string>('all');
  const [filterCurrency, setFilterCurrency] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [searchQuery, setSearchQuery] = useState('');

  // Derive unique values for filter dropdowns
  const uniqueCities = useMemo(() => [...new Set([...pendingBets.map(b => b.city), ...pendingCombined.map(b => b.city)])].sort(), [pendingBets, pendingCombined]);
  const uniquePredictions = useMemo(() => [...new Set(pendingBets.map(b => b.prediction_type))].sort(), [pendingBets]);
  const uniqueCurrencies = useMemo(() => [...new Set([...pendingBets.map(b => b.currency_type), ...pendingParlays.map(b => b.currency_type), ...pendingCombined.map(b => b.currency_type)])].sort(), [pendingBets, pendingParlays, pendingCombined]);

  const hasActiveFilters = filterCity !== 'all' || filterPrediction !== 'all' || filterCurrency !== 'all' || searchQuery.trim() !== '';

  const clearFilters = () => {
    setFilterCity('all');
    setFilterPrediction('all');
    setFilterCurrency('all');
    setSearchQuery('');
  };

  const matchesSearch = (item: { id: string; prediction_value?: string }) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return item.id.toLowerCase().includes(q) || (item.prediction_value?.toLowerCase().includes(q) ?? false);
  };

  const sortItems = <T extends Record<string, any>>(items: T[], cityKey: string, oddsKey: string, stakeKey: string, timeKey: string): T[] => {
    return [...items].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'city': cmp = (a[cityKey] || '').localeCompare(b[cityKey] || ''); break;
        case 'odds': cmp = Number(a[oddsKey]) - Number(b[oddsKey]); break;
        case 'stake': cmp = Number(a[stakeKey]) - Number(b[stakeKey]); break;
        case 'time': {
          const aTime = a[timeKey] ? new Date(a[timeKey]).getTime() : Infinity;
          const bTime = b[timeKey] ? new Date(b[timeKey]).getTime() : Infinity;
          cmp = aTime - bTime;
          break;
        }
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
  };

  const filteredBets = useMemo(() => {
    let items = pendingBets.filter(matchesSearch);
    if (filterCity !== 'all') items = items.filter(b => b.city === filterCity);
    if (filterPrediction !== 'all') items = items.filter(b => b.prediction_type === filterPrediction);
    if (filterCurrency !== 'all') items = items.filter(b => b.currency_type === filterCurrency);
    return sortItems(items, 'city', 'odds', 'stake', 'target_date');
  }, [pendingBets, filterCity, filterPrediction, filterCurrency, sortField, sortDir, searchQuery]);

  const filteredParlays = useMemo(() => {
    let items = pendingParlays.filter(matchesSearch);
    if (filterCurrency !== 'all') items = items.filter(b => b.currency_type === filterCurrency);
    return sortItems(items, 'id', 'combined_odds', 'total_stake', 'expires_at');
  }, [pendingParlays, filterCurrency, sortField, sortDir, searchQuery]);

  const filteredCombined = useMemo(() => {
    let items = pendingCombined.filter(matchesSearch);
    if (filterCity !== 'all') items = items.filter(b => b.city === filterCity);
    if (filterCurrency !== 'all') items = items.filter(b => b.currency_type === filterCurrency);
    return sortItems(items, 'city', 'combined_odds', 'total_stake', 'target_date');
  }, [pendingCombined, filterCity, filterCurrency, sortField, sortDir, searchQuery]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <button onClick={() => toggleSort(field)} className="flex items-center gap-1 hover:text-foreground transition-colors">
      {label}
      <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-primary' : 'text-muted-foreground/50'}`} />
    </button>
  );

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
          {/* Filter Controls */}
          <div className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-lg border bg-muted/30">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search ID or prediction…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 h-8 w-[200px] text-xs"
              />
            </div>
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterCity} onValueChange={setFilterCity}>
              <SelectTrigger className="w-[150px] h-8 text-xs">
                <SelectValue placeholder="All Cities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {uniqueCities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterPrediction} onValueChange={setFilterPrediction}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="All Predictions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Predictions</SelectItem>
                {uniquePredictions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCurrency} onValueChange={setFilterCurrency}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue placeholder="All Modes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modes</SelectItem>
                {uniqueCurrencies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 gap-1 text-xs">
                <X className="h-3 w-3" />
                Clear
              </Button>
            )}
          </div>

          <Tabs defaultValue="bets">
            <TabsList className="mb-4">
              <TabsTrigger value="bets" className="gap-1">
                <Target className="h-3 w-3" />
                Bets ({filteredBets.length})
              </TabsTrigger>
              <TabsTrigger value="parlays" className="gap-1">
                <TrendingUp className="h-3 w-3" />
                Parlays ({filteredParlays.length})
              </TabsTrigger>
              <TabsTrigger value="combined" className="gap-1">
                <MapPin className="h-3 w-3" />
                Combined ({filteredCombined.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bets">
              {filteredBets.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {hasActiveFilters ? 'No bets match filters' : 'No pending bets'}
                </p>
              ) : (
                <div className="rounded-md border overflow-auto max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead><SortButton field="city" label="City" /></TableHead>
                        <TableHead>Prediction</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead><SortButton field="odds" label="Odds" /></TableHead>
                        <TableHead><SortButton field="stake" label="Stake" /></TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Insurance</TableHead>
                        <TableHead><SortButton field="time" label="Time Left" /></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBets.map(bet => (
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
              {filteredParlays.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {hasActiveFilters ? 'No parlays match filters' : 'No pending parlays'}
                </p>
              ) : (
                <div className="rounded-md border overflow-auto max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead><SortButton field="odds" label="Combined Odds" /></TableHead>
                        <TableHead><SortButton field="stake" label="Stake" /></TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Insurance</TableHead>
                        <TableHead><SortButton field="time" label="Time Left" /></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredParlays.map(parlay => (
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
              {filteredCombined.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {hasActiveFilters ? 'No combined bets match filters' : 'No pending combined bets'}
                </p>
              ) : (
                <div className="rounded-md border overflow-auto max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead><SortButton field="city" label="City" /></TableHead>
                        <TableHead><SortButton field="odds" label="Combined Odds" /></TableHead>
                        <TableHead><SortButton field="stake" label="Stake" /></TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Insurance</TableHead>
                        <TableHead><SortButton field="time" label="Time Left" /></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCombined.map(bet => (
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
