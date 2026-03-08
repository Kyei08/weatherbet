import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Medal, Award, Calendar, TrendingUp, Target } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { getSeasonHistory, getSeasonResults, getCurrentSeason, type SeasonData, type SeasonResult } from '@/lib/supabase-seasons';
import { format, formatDistanceToNow } from 'date-fns';

interface SeasonHistoryProps {
  groupId: string;
}

const rankIcons = [
  <Trophy key="1" className="h-5 w-5 text-yellow-500" />,
  <Medal key="2" className="h-5 w-5 text-gray-400" />,
  <Award key="3" className="h-5 w-5 text-amber-600" />,
];

const SeasonHistory = ({ groupId }: SeasonHistoryProps) => {
  const [seasons, setSeasons] = useState<SeasonData[]>([]);
  const [results, setResults] = useState<Map<string, SeasonResult[]>>(new Map());
  const [currentSeason, setCurrentSeason] = useState<SeasonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingResults, setLoadingResults] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchSeasons = async () => {
      setLoading(true);
      const [history, current] = await Promise.all([
        getSeasonHistory(groupId),
        getCurrentSeason(groupId),
      ]);
      setSeasons(history);
      setCurrentSeason(current);
      setLoading(false);
    };
    fetchSeasons();
  }, [groupId]);

  const loadResults = async (seasonId: string) => {
    if (results.has(seasonId)) return;
    setLoadingResults(prev => new Set(prev).add(seasonId));
    const data = await getSeasonResults(seasonId);
    setResults(prev => new Map(prev).set(seasonId, data));
    setLoadingResults(prev => {
      const next = new Set(prev);
      next.delete(seasonId);
      return next;
    });
  };

  const pastSeasons = seasons.filter(s => !s.is_active);

  if (loading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-fade-in" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Season History
        </CardTitle>
        {currentSeason && (
          <div className="flex items-center gap-2 mt-1">
            <Badge className="bg-primary/10 text-primary border-primary/20">
              Season {currentSeason.season_number} — Active
            </Badge>
            <span className="text-xs text-muted-foreground">
              Started {formatDistanceToNow(new Date(currentSeason.started_at), { addSuffix: true })}
            </span>
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          Weekly resets every Monday at midnight UTC. Top 3 finishers are immortalized.
        </p>
      </CardHeader>
      <CardContent>
        {pastSeasons.length === 0 ? (
          <div className="text-center py-6">
            <Trophy className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No completed seasons yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              The first season reset happens next Monday!
            </p>
          </div>
        ) : (
          <Accordion type="single" collapsible className="space-y-2">
            {pastSeasons.map(season => (
              <AccordionItem key={season.id} value={season.id} className="border rounded-lg px-3">
                <AccordionTrigger
                  className="hover:no-underline py-3"
                  onClick={() => loadResults(season.id)}
                >
                  <div className="flex items-center gap-3 text-left">
                    <Badge variant="outline" className="shrink-0">
                      Season {season.season_number}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {season.ended_at
                        ? format(new Date(season.ended_at), 'MMM d, yyyy')
                        : '—'}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {loadingResults.has(season.id) ? (
                    <div className="space-y-2 py-2">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-md" />)}
                    </div>
                  ) : (
                    <div className="space-y-2 py-2">
                      {(results.get(season.id) || []).map(result => (
                        <div
                          key={result.id}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            result.final_rank === 1 ? 'bg-yellow-500/5 border-yellow-500/20' :
                            result.final_rank === 2 ? 'bg-gray-400/5 border-gray-400/20' :
                            'bg-amber-600/5 border-amber-600/20'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {rankIcons[result.final_rank - 1]}
                            <div>
                              <p className="font-semibold text-sm">{result.username}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-0.5">
                                  <TrendingUp className="h-3 w-3" />
                                  {result.final_points.toLocaleString()} pts
                                </span>
                                <span className="flex items-center gap-0.5">
                                  <Target className="h-3 w-3" />
                                  {result.total_wins}/{result.total_bets} wins
                                </span>
                              </div>
                            </div>
                          </div>
                          <Badge
                            variant={result.final_rank === 1 ? 'default' : 'secondary'}
                            className="shrink-0"
                          >
                            #{result.final_rank}
                          </Badge>
                        </div>
                      ))}
                      {(results.get(season.id) || []).length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-3">
                          No results recorded for this season.
                        </p>
                      )}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
};

export default SeasonHistory;
