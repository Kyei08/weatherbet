import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlayCircle, Loader2, CheckCircle, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import type { ResolutionLog } from './types';

interface PendingCounts {
  bets: number;
  parlays: number;
  combinedBets: number;
}

interface ResolutionPanelProps {
  pendingCounts: PendingCounts;
  loading: boolean;
  resolving: boolean;
  lastResult: any;
  logs: ResolutionLog[];
  onResolve: () => void;
  onRefresh: () => void;
}

export const ResolutionPanel = ({
  pendingCounts,
  loading,
  resolving,
  lastResult,
  logs,
  onResolve,
  onRefresh,
}: ResolutionPanelProps) => {
  const totalPending = pendingCounts.bets + pendingCounts.parlays + pendingCounts.combinedBets;

  return (
    <>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Pending Bets', count: pendingCounts.bets },
              { label: 'Pending Parlays', count: pendingCounts.parlays },
              { label: 'Pending Combined', count: pendingCounts.combinedBets },
            ].map(({ label, count }) => (
              <Card key={label}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <Badge variant={count > 0 ? 'default' : 'secondary'}>
                      {loading ? '...' : count}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <Button size="lg" onClick={onResolve} disabled={resolving || totalPending === 0} className="gap-2">
              {resolving ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Resolving...</>
              ) : (
                <><PlayCircle className="h-4 w-4" />Resolve All Pending ({totalPending})</>
              )}
            </Button>
            <Button variant="outline" size="lg" onClick={onRefresh} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {lastResult && !lastResult.error && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  Last Resolution Result ({lastResult.elapsed}s)
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Bets:</span> <span className="font-medium">{lastResult.resolved_bets ?? 0}</span></div>
                  <div><span className="text-muted-foreground">Parlays:</span> <span className="font-medium">{lastResult.resolved_parlays ?? 0}</span></div>
                  <div><span className="text-muted-foreground">Combined:</span> <span className="font-medium">{lastResult.resolved_combined_bets ?? 0}</span></div>
                  <div><span className="text-muted-foreground">Skipped:</span> <span className="font-medium">{lastResult.skipped ?? 0}</span></div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

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
                      <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>{log.status}</Badge>
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
    </>
  );
};
