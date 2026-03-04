import { ReactNode, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, RefreshCw, MapPin, Target, TrendingUp, ArrowUpDown } from 'lucide-react';
import { formatDistanceToNow, isPast } from 'date-fns';
import { FilterBar } from './FilterBar';
import { useFilteredSort } from '@/hooks/useFilteredSort';
import type { PendingBet, PendingParlay, PendingCombined, SortField } from './types';

interface InspectionTableProps {
  pendingBets: PendingBet[];
  pendingParlays: PendingParlay[];
  pendingCombined: PendingCombined[];
  detailsLoading: boolean;
  onRefresh: () => void;
}

const getTimeRemaining = (date: string | null): ReactNode => {
  if (!date) return <Badge variant="secondary">No date</Badge>;
  if (isPast(new Date(date))) return <Badge variant="destructive">Overdue</Badge>;
  return <Badge variant="outline">{formatDistanceToNow(new Date(date), { addSuffix: false })} left</Badge>;
};

const SortButton = ({ field, label, sortField, onToggle }: { field: SortField; label: string; sortField: SortField; onToggle: (f: SortField) => void }) => (
  <button onClick={() => onToggle(field)} className="flex items-center gap-1 hover:text-foreground transition-colors">
    {label}
    <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-primary' : 'text-muted-foreground/50'}`} />
  </button>
);

export const InspectionTable = ({ pendingBets, pendingParlays, pendingCombined, detailsLoading, onRefresh }: InspectionTableProps) => {
  const {
    filterCity, setFilterCity,
    filterPrediction, setFilterPrediction,
    filterCurrency, setFilterCurrency,
    sortField,
    searchQuery, setSearchQuery,
    hasActiveFilters,
    clearFilters,
    toggleSort,
    filterAndSort,
  } = useFilteredSort();

  const uniqueCities = useMemo(() => [...new Set([...pendingBets.map(b => b.city), ...pendingCombined.map(b => b.city)])].sort(), [pendingBets, pendingCombined]);
  const uniquePredictions = useMemo(() => [...new Set(pendingBets.map(b => b.prediction_type))].sort(), [pendingBets]);
  const uniqueCurrencies = useMemo(() => [...new Set([...pendingBets.map(b => b.currency_type), ...pendingParlays.map(b => b.currency_type), ...pendingCombined.map(b => b.currency_type)])].sort(), [pendingBets, pendingParlays, pendingCombined]);

  const filteredBets = useMemo(() =>
    filterAndSort(pendingBets, { cityKey: 'city', oddsKey: 'odds', stakeKey: 'stake', timeKey: 'target_date', applyCityFilter: true, applyPredictionFilter: true }),
    [pendingBets, filterAndSort]
  );

  const filteredParlays = useMemo(() =>
    filterAndSort(pendingParlays, { cityKey: 'id', oddsKey: 'combined_odds', stakeKey: 'total_stake', timeKey: 'expires_at' }),
    [pendingParlays, filterAndSort]
  );

  const filteredCombined = useMemo(() =>
    filterAndSort(pendingCombined, { cityKey: 'city', oddsKey: 'combined_odds', stakeKey: 'total_stake', timeKey: 'target_date', applyCityFilter: true }),
    [pendingCombined, filterAndSort]
  );

  return (
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
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={detailsLoading} className="gap-2">
            <RefreshCw className={`h-3 w-3 ${detailsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterCity={filterCity}
          onFilterCityChange={setFilterCity}
          filterPrediction={filterPrediction}
          onFilterPredictionChange={setFilterPrediction}
          filterCurrency={filterCurrency}
          onFilterCurrencyChange={setFilterCurrency}
          uniqueCities={uniqueCities}
          uniquePredictions={uniquePredictions}
          uniqueCurrencies={uniqueCurrencies}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
        />

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
                      <TableHead><SortButton field="city" label="City" sortField={sortField} onToggle={toggleSort} /></TableHead>
                      <TableHead>Prediction</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead><SortButton field="odds" label="Odds" sortField={sortField} onToggle={toggleSort} /></TableHead>
                      <TableHead><SortButton field="stake" label="Stake" sortField={sortField} onToggle={toggleSort} /></TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Insurance</TableHead>
                      <TableHead><SortButton field="time" label="Time Left" sortField={sortField} onToggle={toggleSort} /></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBets.map(bet => (
                      <TableRow key={bet.id}>
                        <TableCell className="font-medium">{bet.city}</TableCell>
                        <TableCell><Badge variant="outline">{bet.prediction_type}</Badge></TableCell>
                        <TableCell className="text-sm">{bet.prediction_value}</TableCell>
                        <TableCell className="font-mono">{Number(bet.odds).toFixed(2)}x</TableCell>
                        <TableCell>{bet.stake}</TableCell>
                        <TableCell>
                          <Badge variant={bet.currency_type === 'real' ? 'default' : 'secondary'}>{bet.currency_type}</Badge>
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
                      <TableHead><SortButton field="odds" label="Combined Odds" sortField={sortField} onToggle={toggleSort} /></TableHead>
                      <TableHead><SortButton field="stake" label="Stake" sortField={sortField} onToggle={toggleSort} /></TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Insurance</TableHead>
                      <TableHead><SortButton field="time" label="Time Left" sortField={sortField} onToggle={toggleSort} /></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredParlays.map(parlay => (
                      <TableRow key={parlay.id}>
                        <TableCell className="font-mono text-xs">{parlay.id.slice(0, 8)}…</TableCell>
                        <TableCell className="font-mono">{Number(parlay.combined_odds).toFixed(2)}x</TableCell>
                        <TableCell>{parlay.total_stake}</TableCell>
                        <TableCell>
                          <Badge variant={parlay.currency_type === 'real' ? 'default' : 'secondary'}>{parlay.currency_type}</Badge>
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
                      <TableHead><SortButton field="city" label="City" sortField={sortField} onToggle={toggleSort} /></TableHead>
                      <TableHead><SortButton field="odds" label="Combined Odds" sortField={sortField} onToggle={toggleSort} /></TableHead>
                      <TableHead><SortButton field="stake" label="Stake" sortField={sortField} onToggle={toggleSort} /></TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Insurance</TableHead>
                      <TableHead><SortButton field="time" label="Time Left" sortField={sortField} onToggle={toggleSort} /></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCombined.map(bet => (
                      <TableRow key={bet.id}>
                        <TableCell className="font-medium">{bet.city}</TableCell>
                        <TableCell className="font-mono">{Number(bet.combined_odds).toFixed(2)}x</TableCell>
                        <TableCell>{bet.total_stake}</TableCell>
                        <TableCell>
                          <Badge variant={bet.currency_type === 'real' ? 'default' : 'secondary'}>{bet.currency_type}</Badge>
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
  );
};
