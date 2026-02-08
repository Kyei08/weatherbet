import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RefreshCw, Shield, TrendingUp, Zap, Clock, CheckCircle2, Circle, XCircle, Timer, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getBets, getUser, cashOutBet } from '@/lib/supabase-auth-storage';
import { getParlays, ParlayWithLegs, cashOutParlay } from '@/lib/supabase-parlays';
import { getCombinedBets, cashOutCombinedBet } from '@/lib/supabase-combined-bets';
import { partialCashOutBet, partialCashOutParlay, partialCashOutCombinedBet } from '@/lib/partial-cashout';
import { Bet } from '@/types/supabase-betting';
import { useToast } from '@/hooks/use-toast';
import { useChallengeTracker } from '@/hooks/useChallengeTracker';
import { useAchievementTracker } from '@/hooks/useAchievementTracker';
import { useLevelSystem } from '@/hooks/useLevelSystem';
import CashOutHistoryChart from './CashOutHistoryChart';
import OddsHistoryChart from './OddsHistoryChart';
import { formatRands } from '@/lib/currency';
import { useCurrencyMode } from '@/contexts/CurrencyModeContext';
import { getTimeSlot, BettingCategory, CATEGORY_TIME_SLOTS } from '@/lib/betting-timing';
import { Progress } from '@/components/ui/progress';
import { TimeSlotCountdown, MultiSlotCountdown } from './TimeSlotCountdown';
import { BetTimeline } from './BetTimeline';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useRealtimeCashout, CashOutCalculation } from '@/hooks/useRealtimeCashout';
import { LiveCashoutValue } from './LiveCashoutValue';
import { useAutoCashout, RuleType, BetType } from '@/hooks/useAutoCashout';
import { AutoCashoutBadge } from './AutoCashoutBadge';
import { PartialCashoutSlider } from './PartialCashoutSlider';
import { PartialCashoutHistory } from './PartialCashoutHistory';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// Helper to parse prediction type that may include time slot
function parsePredictionType(predictionType: string): { category: string; slotId?: string } {
  const knownCategories = ['temperature', 'rain', 'rainfall', 'wind', 'snow', 'cloud_coverage', 'pressure', 'dew_point', 'humidity'];
  
  for (const category of knownCategories) {
    if (predictionType === category) {
      return { category };
    }
    if (predictionType.startsWith(category + '_')) {
      const slotId = predictionType.substring(category.length + 1);
      const config = CATEGORY_TIME_SLOTS[category as BettingCategory];
      if (config && config.timeSlots.some(s => s.slotId === slotId)) {
        return { category, slotId };
      }
    }
  }
  
  return { category: predictionType };
}

// Check if a combined bet is a multi-time combo (same category at different times)
function isMultiTimeCombo(categories: any[]): boolean {
  if (categories.length < 2) return false;
  const { category: firstCategory } = parsePredictionType(categories[0].prediction_type);
  return categories.every(cat => {
    const { category } = parsePredictionType(cat.prediction_type);
    return category === firstCategory;
  }) && categories.some(cat => {
    const { slotId } = parsePredictionType(cat.prediction_type);
    return slotId !== undefined;
  });
}

interface MyBetsProps {
  onBack: () => void;
  onRefresh: () => void;
}

const MyBets = ({ onBack, onRefresh }: MyBetsProps) => {
  const { mode } = useCurrencyMode();
  const [bets, setBets] = useState<Bet[]>([]);
  const [parlays, setParlays] = useState<ParlayWithLegs[]>([]);
  const [combinedBets, setCombinedBets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [settlingBets, setSettlingBets] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'settled'>('all');
  const [resolvingBets, setResolvingBets] = useState(false);
  const [globalResolving, setGlobalResolving] = useState(false);
  const [resolutionProgress, setResolutionProgress] = useState<{
    current: number;
    total: number;
    phase: string;
  } | null>(null);
  const [resolvingMessage, setResolvingMessage] = useState('');
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set());
  const [showPartialCashout, setShowPartialCashout] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const { checkAndUpdateChallenges } = useChallengeTracker();
  const { checkAchievements } = useAchievementTracker();
  const { awardXPForAction } = useLevelSystem();
  const { playSound } = useNotificationSound();
  const { vibrateSuccess, vibrateError, vibrateInfo } = useHapticFeedback();
  
  // Auto-cashout rules
  const { 
    rules: autoCashoutRules, 
    createRule, 
    deleteRule, 
    updateRule,
    checkRules, 
    getRulesForBet 
  } = useAutoCashout();
  
  // Callback to check auto-cashout rules when calculations update
  const handleCalculationsUpdated = useCallback(
    (calculations: Record<string, CashOutCalculation>) => {
      checkRules(calculations);
    },
    [checkRules]
  );
  
  // Real-time cashout calculations with 30-second polling
  const { 
    calculations: cashOutCalculations, 
    isUpdating: calculatingCashOuts,
    updateAllCashouts 
  } = useRealtimeCashout(bets, parlays, combinedBets, {
    pollingInterval: 30000,
    enabled: !loading,
    onCalculationsUpdated: handleCalculationsUpdated,
  });

  // Calculate comprehensive statistics
  const calculateStats = () => {
    const allBets = [...bets, ...parlays, ...combinedBets];
    const settledBets = allBets.filter(bet => bet.result === 'win' || bet.result === 'partial' || bet.result === 'loss' || bet.result === 'cashed_out');
    const wonBets = allBets.filter(bet => bet.result === 'win');
    const partialBets = allBets.filter(bet => bet.result === 'partial');
    const lostBets = allBets.filter(bet => bet.result === 'loss');
    const cashedOutBets = allBets.filter(bet => bet.result === 'cashed_out');
    
    const totalWagered = allBets.reduce((sum, bet) => {
      if ('total_stake' in bet) return sum + bet.total_stake;
      return sum + bet.stake;
    }, 0);
    
    const totalWon = wonBets.reduce((sum, bet) => {
      const stake = 'total_stake' in bet ? bet.total_stake : bet.stake;
      const odds = 'combined_odds' in bet ? bet.combined_odds : bet.odds;
      return sum + Math.floor(stake * Number(odds));
    }, 0);
    
    const totalLost = lostBets.reduce((sum, bet) => {
      const stake = 'total_stake' in bet ? bet.total_stake : bet.stake;
      const hasInsurance = (bet as any).has_insurance;
      const insurancePayout = hasInsurance ? Math.floor(stake * 0.8) : 0;
      return sum + (stake - insurancePayout);
    }, 0);
    
    const totalCashedOut = cashedOutBets.reduce((sum, bet) => {
      return sum + ((bet as any).cashout_amount || 0);
    }, 0);
    
    const netProfit = totalWon + totalCashedOut - totalLost;
    const winRate = settledBets.length > 0 ? ((wonBets.length / settledBets.length) * 100).toFixed(1) : '0.0';
    
    return {
      totalBets: allBets.length,
      totalWagered,
      totalWon,
      totalLost,
      totalCashedOut,
      netProfit,
      winRate,
      wonCount: wonBets.length,
      lostCount: lostBets.length,
      cashedOutCount: cashedOutBets.length,
    };
  };

  const stats = calculateStats();
  
  const fetchData = async () => {
    try {
      const [betsData, parlaysData, combinedBetsData] = await Promise.all([
        getBets(undefined, mode),
        getParlays(undefined, mode),
        getCombinedBets(undefined, mode)
      ]);
      setBets(betsData);
      setParlays(parlaysData);
      setCombinedBets(combinedBetsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [mode]);

  // Real-time subscriptions for bet updates
  // Helper to mark an item as recently updated (with auto-clear)
  const markAsUpdated = (id: string) => {
    setRecentlyUpdated(prev => new Set(prev).add(id));
    // Clear the animation after 3 seconds
    setTimeout(() => {
      setRecentlyUpdated(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 3000);
  };

  useEffect(() => {
    const betsChannel = supabase
      .channel('bets-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bets'
        },
        (payload) => {
          console.log('Bet updated:', payload);
          // Mark as recently updated for animation
          markAsUpdated(payload.new.id);
          // Update the specific bet in state
          setBets(prevBets => 
            prevBets.map(bet => 
              bet.id === payload.new.id ? { ...bet, ...payload.new } : bet
            )
          );
          // Show toast for resolved bets
          if (payload.old.result === 'pending' && payload.new.result !== 'pending') {
            const resultEmoji = payload.new.result === 'win' ? '🎉' : payload.new.result === 'partial' ? '🎯' : payload.new.result === 'cashed_out' ? '💰' : '😞';
            const resultText = payload.new.result === 'win' ? 'Won!' : payload.new.result === 'partial' ? 'Partial Win!' : payload.new.result === 'cashed_out' ? 'Cashed Out!' : 'Lost';
            toast({
              title: `Bet ${resultText} ${resultEmoji}`,
              description: `Your bet on ${payload.new.city} has been resolved.`,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'parlays'
        },
        (payload) => {
          console.log('Parlay updated:', payload);
          // Mark as recently updated for animation
          markAsUpdated(payload.new.id);
          // Refresh parlays to get full data with legs
          fetchData();
          if (payload.old.result === 'pending' && payload.new.result !== 'pending') {
            const resultEmoji = payload.new.result === 'win' ? '🎉' : payload.new.result === 'cashed_out' ? '💰' : '😞';
            toast({
              title: `Parlay ${payload.new.result === 'win' ? 'Won!' : payload.new.result === 'cashed_out' ? 'Cashed Out!' : 'Lost'} ${resultEmoji}`,
              description: `Your parlay bet has been resolved.`,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'combined_bets'
        },
        (payload) => {
          console.log('Combined bet updated:', payload);
          // Mark as recently updated for animation
          markAsUpdated(payload.new.id);
          // Refresh combined bets to get full data with categories
          fetchData();
          if (payload.old.result === 'pending' && payload.new.result !== 'pending') {
            const resultEmoji = payload.new.result === 'win' ? '🎉' : payload.new.result === 'cashed_out' ? '💰' : '😞';
            toast({
              title: `Combined Bet ${payload.new.result === 'win' ? 'Won!' : payload.new.result === 'cashed_out' ? 'Cashed Out!' : 'Lost'} ${resultEmoji}`,
              description: `Your combined bet has been resolved.`,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'combined_bet_categories'
        },
        (payload) => {
          console.log('Combined bet category updated:', payload);
          // Refresh to get updated category results for multi-time combos
          fetchData();
        }
      )
      .subscribe();

    // Subscribe to resolution status broadcasts
    const resolutionChannel = supabase
      .channel('bet-resolution-status')
      .on('broadcast', { event: 'resolution_status' }, (payload) => {
        console.log('Resolution status:', payload);
        const { status, message, current, total, phase } = payload.payload;
        if (status === 'resolving') {
          setGlobalResolving(true);
          setResolvingMessage(message || 'Resolving bets...');
          if (current !== undefined && total !== undefined) {
            setResolutionProgress({ current, total, phase: phase || '' });
          }
        } else if (status === 'complete') {
          setGlobalResolving(false);
          setResolvingMessage('');
          setResolutionProgress(null);
          // Play notification sound and haptic when resolution completes
          playSound('success');
          vibrateSuccess();
          // Refresh data after resolution completes
          fetchData();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(betsChannel);
      supabase.removeChannel(resolutionChannel);
    };
  }, [mode, toast]);

  const refreshBets = async () => {
    try {
      const [betsData, parlaysData, combinedBetsData] = await Promise.all([
        getBets(),
        getParlays(),
        getCombinedBets()
      ]);
      setBets(betsData);
      setParlays(parlaysData);
      setCombinedBets(combinedBetsData);
      // Trigger real-time cashout recalculation
      await updateAllCashouts();
      onRefresh();
    } catch (error) {
      console.error('Error refreshing bets:', error);
    }
  };

  const handleResolveBets = async () => {
    setResolvingBets(true);
    try {
      const { data, error } = await supabase.functions.invoke('resolve-bets');
      
      if (error) {
        throw error;
      }
      
      // Play notification sound and haptic for successful resolution
      playSound('success');
      vibrateSuccess();
      
      toast({
        title: "Bets Resolved",
        description: `Resolved ${data?.singleBetsResolved || 0} single bets, ${data?.parlaysResolved || 0} parlays, ${data?.combinedBetsResolved || 0} combined bets`,
      });
      
      // Refresh the bets list
      await refreshBets();
    } catch (error) {
      console.error('Error resolving bets:', error);
      toast({
        title: "Error",
        description: "Failed to resolve bets. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setResolvingBets(false);
    }
  };

  // Manual settlement removed — bets are resolved server-side only via resolve-bets edge function

  const handleCashOut = async (bet: Bet) => {
    try {
      const calculation = cashOutCalculations[bet.id];
      if (!calculation) {
        toast({
          title: "Error",
          description: "Cash-out calculation not available. Please refresh.",
          variant: "destructive",
        });
        return;
      }

      await cashOutBet(bet.id, calculation.amount, mode);
      
      // Play cash-out sound and haptic
      playSound('info', 'cashouts');
      vibrateInfo('cashouts');
      
      toast({
        title: "Bet Cashed Out! 💰",
        description: `You received ${formatCurrency(calculation.amount)} (${calculation.percentage}% of potential win)`,
      });
      
      await refreshBets();
    } catch (error) {
      console.error('Error cashing out bet:', error);
      toast({
        title: "Error",
        description: "Failed to cash out bet. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handlePartialCashOut = async (bet: Bet, percentage: number, amount: number) => {
    try {
      await partialCashOutBet(bet.id, amount, percentage, mode);
      
      playSound('info', 'cashouts');
      vibrateInfo('cashouts');
      
      toast({
        title: "Partial Cash-Out! 💰",
        description: `You received ${formatCurrency(amount)} (${percentage}%). Remaining stake: ${formatCurrency(Math.floor(bet.stake * ((100 - percentage) / 100)))}`,
      });
      
      setShowPartialCashout(prev => ({ ...prev, [bet.id]: false }));
      await refreshBets();
    } catch (error) {
      console.error('Error with partial cash out:', error);
      toast({
        title: "Error",
        description: "Failed to complete partial cash out.",
        variant: "destructive",
      });
    }
  };

  const handleParlayCashOut = async (parlay: ParlayWithLegs) => {
    try {
      const calculation = cashOutCalculations[parlay.id];
      if (!calculation) {
        toast({
          title: "Error",
          description: "Cash-out calculation not available. Please refresh.",
          variant: "destructive",
        });
        return;
      }

      await cashOutParlay(parlay.id, calculation.amount, mode);
      
      playSound('info', 'cashouts');
      vibrateInfo('cashouts');
      
      toast({
        title: "Parlay Cashed Out! 💰",
        description: `You received ${formatCurrency(calculation.amount)} (${calculation.percentage}% of potential win)`,
      });
      
      await refreshBets();
    } catch (error) {
      console.error('Error cashing out parlay:', error);
      toast({
        title: "Error",
        description: "Failed to cash out parlay. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleParlayPartialCashOut = async (parlay: ParlayWithLegs, percentage: number, amount: number) => {
    try {
      await partialCashOutParlay(parlay.id, amount, percentage, mode);
      
      playSound('info', 'cashouts');
      vibrateInfo('cashouts');
      
      toast({
        title: "Partial Cash-Out! 💰",
        description: `You received ${formatCurrency(amount)} (${percentage}%). Remaining stake: ${formatCurrency(Math.floor(parlay.total_stake * ((100 - percentage) / 100)))}`,
      });
      
      setShowPartialCashout(prev => ({ ...prev, [parlay.id]: false }));
      await refreshBets();
    } catch (error) {
      console.error('Error with partial cash out:', error);
      toast({
        title: "Error",
        description: "Failed to complete partial cash out.",
        variant: "destructive",
      });
    }
  };

  // Manual parlay settlement removed — parlays are resolved server-side only

  const handleCombinedBetCashOut = async (combinedBet: any) => {
    try {
      const calculation = cashOutCalculations[combinedBet.id];
      if (!calculation) {
        toast({
          title: "Error",
          description: "Cash-out calculation not available. Please refresh.",
          variant: "destructive",
        });
        return;
      }

      await cashOutCombinedBet(combinedBet.id, calculation.amount, mode);
      
      playSound('info', 'cashouts');
      vibrateInfo('cashouts');
      
      toast({
        title: "Combined Bet Cashed Out! 💰",
        description: `You received ${formatCurrency(calculation.amount)} (${calculation.percentage}% of potential win)`,
      });
      
      await refreshBets();
    } catch (error) {
      console.error('Error cashing out combined bet:', error);
      toast({
        title: "Error",
        description: "Failed to cash out combined bet. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCombinedBetPartialCashOut = async (combinedBet: any, percentage: number, amount: number) => {
    try {
      await partialCashOutCombinedBet(combinedBet.id, amount, percentage, mode);
      
      playSound('info', 'cashouts');
      vibrateInfo('cashouts');
      
      toast({
        title: "Partial Cash-Out! 💰",
        description: `You received ${formatCurrency(amount)} (${percentage}%). Remaining stake: ${formatCurrency(Math.floor(combinedBet.total_stake * ((100 - percentage) / 100)))}`,
      });
      
      setShowPartialCashout(prev => ({ ...prev, [combinedBet.id]: false }));
      await refreshBets();
    } catch (error) {
      console.error('Error with partial cash out:', error);
      toast({
        title: "Error",
        description: "Failed to complete partial cash out.",
        variant: "destructive",
      });
    }
  };

  // Manual combined bet settlement removed — resolved server-side only

  const pendingBets = bets.filter(bet => bet.result === 'pending');
  const settledBets = bets.filter(bet => bet.result !== 'pending');
  const pendingParlays = parlays.filter(p => p.result === 'pending');
  const settledParlays = parlays.filter(p => p.result !== 'pending');
  
  const getCashOutBadgeVariant = (result: string) => {
    if (result === 'cashed_out') return 'outline';
    return getBadgeVariant(result);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getBadgeVariant = (result: string) => {
    switch (result) {
      case 'win': return 'default';
      case 'loss': return 'destructive';
      case 'cashed_out': return 'outline';
      default: return 'secondary';
    }
  };
  
  const formatResult = (result: string) => {
    if (result === 'cashed_out') return 'CASHED OUT';
    return result.toUpperCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading bets...</p>
      </div>
    );
  }

  const filteredBets = bets.filter(bet => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'pending') return bet.result === 'pending';
    return bet.result !== 'pending';
  });

  const filteredParlays = parlays.filter(parlay => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'pending') return parlay.result === 'pending';
    return parlay.result !== 'pending';
  });

  const filteredCombinedBets = combinedBets.filter(cb => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'pending') return cb.result === 'pending';
    return cb.result !== 'pending';
  });

  const formatCurrency = (amount: number) => {
    if (mode === 'real') return formatRands(amount);
    return `${amount} pts`;
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold">My Bets</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleResolveBets}
              disabled={resolvingBets}
              className="bg-primary/10 border-primary/30 hover:bg-primary/20"
            >
              <Zap className={`h-4 w-4 mr-2 ${resolvingBets ? 'animate-pulse' : ''}`} />
              {resolvingBets ? 'Resolving...' : 'Resolve Bets'}
            </Button>
            <Button variant="outline" size="sm" onClick={refreshBets}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Global Resolution Status Banner */}
        {(globalResolving || resolvingBets) && (
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Zap className="h-5 w-5 text-primary animate-bounce" />
                <div className="absolute inset-0 bg-primary/30 rounded-full blur-md animate-ping" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-primary">Resolving Bets...</p>
                <p className="text-sm text-muted-foreground">
                  {resolvingMessage || 'Checking weather conditions and resolving pending bets'}
                </p>
              </div>
              <Timer className="h-5 w-5 text-primary animate-spin" />
            </div>
            {resolutionProgress && resolutionProgress.total > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{resolutionProgress.phase}</span>
                  <span>{resolutionProgress.current} / {resolutionProgress.total}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${(resolutionProgress.current / resolutionProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bet Timeline */}
        <BetTimeline 
          bets={bets} 
          parlays={parlays} 
          combinedBets={combinedBets}
          mode={mode}
        />

        {/* Summary Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Total Bets</div>
              <div className="text-2xl font-bold">{stats.totalBets}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Win Rate</div>
              <div className="text-2xl font-bold text-green-600">{stats.winRate}%</div>
              <div className="text-xs text-muted-foreground">
                {stats.wonCount}W - {stats.lostCount}L
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Total Wagered</div>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalWagered)}</div>
            </CardContent>
          </Card>
          <Card className={stats.netProfit >= 0 ? 'border-green-500/50' : 'border-red-500/50'}>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                Net Profit/Loss
                <TrendingUp className={`h-3 w-3 ${stats.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              </div>
              <div className={`text-2xl font-bold ${stats.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.netProfit >= 0 ? '+' : ''}{formatCurrency(stats.netProfit)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Won: {formatCurrency(stats.totalWon)} | Lost: {formatCurrency(stats.totalLost)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex gap-2">
              <Button
                variant={filterStatus === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('all')}
              >
                All ({bets.length + parlays.length + combinedBets.length})
              </Button>
              <Button
                variant={filterStatus === 'pending' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('pending')}
              >
                Pending ({pendingBets.length + pendingParlays.length + combinedBets.filter(cb => cb.result === 'pending').length})
              </Button>
              <Button
                variant={filterStatus === 'settled' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('settled')}
              >
                Settled ({settledBets.length + settledParlays.length + combinedBets.filter(cb => cb.result !== 'pending').length})
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pending/Filtered Bets */}
        {filteredBets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Single Bets ({filteredBets.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredBets.map((bet) => {
                  const stake = bet.stake;
                  const potentialWin = Math.floor(stake * Number(bet.odds));
                  const profitLoss = bet.result === 'win' ? potentialWin : 
                                    bet.result === 'loss' ? -stake :
                                    bet.result === 'cashed_out' ? ((bet as any).cashout_amount - stake) : 0;
                  
                  return (
                  <div 
                    key={bet.id} 
                    className={`border rounded-lg p-4 space-y-3 transition-all duration-300 ${
                      recentlyUpdated.has(bet.id) 
                        ? 'ring-2 ring-primary ring-offset-2 animate-pulse bg-primary/5' 
                        : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg">{bet.city}</h3>
                        <p className="text-muted-foreground">
                          {bet.prediction_type === 'rain' 
                            ? `Rain: ${bet.prediction_value}` 
                            : `${bet.prediction_type.charAt(0).toUpperCase() + bet.prediction_type.slice(1).replace('_', ' ')}: ${bet.prediction_value}${bet.prediction_type === 'temperature' ? '°C' : ''}`
                          }
                        </p>
                        {bet.time_slot_id && (
                          <div className="flex flex-col gap-1 mt-1">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3 text-primary" />
                              <span className="text-sm text-primary font-medium">
                                {(() => {
                                  const slot = getTimeSlot(bet.prediction_type as BettingCategory, bet.time_slot_id);
                                  return slot ? `${slot.icon} ${slot.label}` : bet.time_slot_id;
                                })()}
                              </span>
                            </div>
                            {bet.result === 'pending' && (
                              <TimeSlotCountdown
                                category={bet.prediction_type as BettingCategory}
                                slotId={bet.time_slot_id}
                                targetDate={bet.target_date || undefined}
                              />
                            )}
                          </div>
                        )}
                        <p className="text-sm text-muted-foreground">{formatDate(bet.created_at)}</p>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="flex items-center gap-2 justify-end">
                          <Badge variant={getBadgeVariant(bet.result)}>
                            {bet.result.toUpperCase()}
                          </Badge>
                          {(bet as any).has_insurance && (
                            <Badge variant="outline" className="bg-primary/10 border-primary/30">
                              <Shield className="h-3 w-3 mr-1" />
                              INSURED
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm mt-1">Stake: {formatCurrency(stake)}</p>
                        <p className="text-sm">Odds: {Number(bet.odds).toFixed(2)}x</p>
                        {bet.result === 'pending' && (
                          <p className="text-sm text-muted-foreground">
                            Potential: {formatCurrency(potentialWin)}
                          </p>
                        )}
                        {bet.result !== 'pending' && (
                          <p className={`text-sm font-semibold ${profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            P/L: {profitLoss >= 0 ? '+' : ''}{formatCurrency(Math.abs(profitLoss))}
                          </p>
                        )}
                        {(bet as any).has_insurance && (
                          <p className="text-xs text-primary">Protected: {formatCurrency(Math.floor(stake * ((bet as any).insurance_payout_percentage || 0.8)))}</p>
                        )}
                      </div>
                    </div>
                    
                    {/* Dynamic Cash Out Section */}
                    {cashOutCalculations[bet.id] ? (
                      <div className="pt-2 border-t bg-gradient-to-br from-primary/5 to-accent/10 -mx-4 -mb-3 px-4 py-3 rounded-b-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-semibold text-primary">Dynamic Cash Out</p>
                              <Badge variant="outline" className="text-xs">
                                <TrendingUp className="h-3 w-3 mr-1" />
                                {cashOutCalculations[bet.id].percentage}%
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mb-1">
                              {cashOutCalculations[bet.id].reasoning}
                            </p>
                            <div className="flex gap-3 text-xs">
                              {cashOutCalculations[bet.id].timeBonus > 0 && (
                                <span className="text-muted-foreground">
                                  ⏱️ Time: +{cashOutCalculations[bet.id].timeBonus}%
                                </span>
                              )}
                              {cashOutCalculations[bet.id].weatherBonus > 0 && (
                                <span className="text-muted-foreground">
                                  🌤️ Weather: +{cashOutCalculations[bet.id].weatherBonus}%
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <AutoCashoutBadge
                              betId={bet.id}
                              betType="bet"
                              rules={getRulesForBet(bet.id)}
                              currentPercentage={cashOutCalculations[bet.id].percentage}
                              currentWeatherBonus={cashOutCalculations[bet.id].weatherBonus}
                              currentTimeBonus={cashOutCalculations[bet.id].timeBonus}
                              currentAmount={cashOutCalculations[bet.id].amount}
                              onCreateRule={async (ruleType, threshold) => {
                                await createRule('bet', bet.id, ruleType, threshold);
                              }}
                              onDeleteRule={deleteRule}
                              onToggleRule={(ruleId, isActive) => updateRule(ruleId, { is_active: isActive })}
                            />
                            <div className="flex flex-col gap-2">
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  onClick={() => handleCashOut(bet)}
                                  className="bg-gradient-primary"
                                  disabled={calculatingCashOuts}
                                >
                                  Cash Out All
                                  <span className="ml-2 font-bold">{formatCurrency(cashOutCalculations[bet.id].amount)}</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setShowPartialCashout(prev => ({ ...prev, [bet.id]: !prev[bet.id] }))}
                                  disabled={calculatingCashOuts}
                                >
                                  Partial
                                  {showPartialCashout[bet.id] ? (
                                    <ChevronUp className="h-4 w-4 ml-1" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 ml-1" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Partial Cashout Slider */}
                        {showPartialCashout[bet.id] && (
                          <div className="mt-3 animate-in slide-in-from-top-2 space-y-3">
                            <PartialCashoutSlider
                              totalCashoutAmount={cashOutCalculations[bet.id].amount}
                              currentStake={bet.stake}
                              onPartialCashout={(percentage, amount) => handlePartialCashOut(bet, percentage, amount)}
                              onFullCashout={() => handleCashOut(bet)}
                              disabled={calculatingCashOuts}
                            />
                            <PartialCashoutHistory
                              betId={bet.id}
                              betType="bet"
                              currencyType={mode}
                            />
                          </div>
                        )}
                        
                        {/* Cash-Out History Chart */}
                        <CashOutHistoryChart
                          stake={bet.stake}
                          odds={Number(bet.odds)}
                          city={bet.city}
                          predictionType={bet.prediction_type}
                          predictionValue={bet.prediction_value}
                          createdAt={bet.created_at}
                          expiresAt={bet.expires_at}
                        />
                        
                        {/* Odds History Chart */}
                        <OddsHistoryChart
                          city={bet.city}
                          predictionType={bet.prediction_type}
                          predictionValue={bet.prediction_value}
                          createdAt={bet.created_at}
                          expiresAt={bet.expires_at}
                          currentOdds={Number(bet.odds)}
                        />
                      </div>
                    ) : (
                      <div className="pt-2 border-t bg-accent/10 -mx-4 -mb-3 px-4 py-3 rounded-b-lg">
                        <p className="text-sm text-muted-foreground text-center">
                          {calculatingCashOuts ? 'Calculating cash-out value...' : 'Cash-out unavailable'}
                        </p>
                      </div>
                    )}
                    
                    {/* Bets are resolved automatically by the server */}
                    <div className="pt-2 border-t mt-2">
                      <p className="text-xs text-muted-foreground text-center">
                        ⏳ This bet will be resolved automatically when weather data is verified
                      </p>
                    </div>
                  </div>
                )})}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filtered Parlays */}
        {filteredParlays.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Parlays ({filteredParlays.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredParlays.map((parlay) => {
                  const stake = parlay.total_stake;
                  const potentialWin = Math.floor(stake * Number(parlay.combined_odds));
                  const profitLoss = parlay.result === 'win' ? potentialWin : 
                                    parlay.result === 'loss' ? -stake :
                                    parlay.result === 'cashed_out' ? ((parlay as any).cashout_amount - stake) : 0;
                  
                  return (
                  <div 
                    key={parlay.id} 
                    className={`border-2 border-primary/20 rounded-lg p-4 space-y-3 bg-gradient-primary/5 transition-all duration-300 ${
                      recentlyUpdated.has(parlay.id) 
                        ? 'ring-2 ring-primary ring-offset-2 animate-pulse' 
                        : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          💰 {parlay.parlay_legs.length}-Leg Parlay
                        </h3>
                        <p className="text-sm text-muted-foreground">{formatDate(parlay.created_at)}</p>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="flex items-center gap-2 justify-end">
                          <Badge variant={getBadgeVariant(parlay.result)}>
                            {parlay.result.toUpperCase()}
                          </Badge>
                          {parlay.has_insurance && (
                            <Badge variant="outline" className="bg-primary/10 border-primary/30">
                              <Shield className="h-3 w-3 mr-1" />
                              INSURED
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm mt-1 font-bold">Stake: {formatCurrency(stake)}</p>
                        <p className="text-sm font-bold text-primary">Odds: {Number(parlay.combined_odds).toFixed(2)}x</p>
                        {parlay.result === 'pending' && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Potential: {formatCurrency(potentialWin)}
                          </p>
                        )}
                        {parlay.result !== 'pending' && (
                          <p className={`text-sm font-semibold ${profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            P/L: {profitLoss >= 0 ? '+' : ''}{formatCurrency(Math.abs(profitLoss))}
                          </p>
                        )}
                        {parlay.has_insurance && (
                          <p className="text-xs text-primary">Protected: {formatCurrency(Math.floor(stake * (parlay.insurance_payout_percentage || 0.75)))}</p>
                        )}
                      </div>
                    </div>

                    {/* Parlay Legs */}
                    <div className="space-y-2 pl-4 border-l-2 border-primary/30">
                      {parlay.parlay_legs.map((leg, idx) => (
                        <div key={leg.id} className="text-sm">
                          <span className="font-medium">Leg {idx + 1}: {leg.city}</span>
                          <span className="text-muted-foreground ml-2">
                            {leg.prediction_type === 'rain' 
                              ? `Rain: ${leg.prediction_value}` 
                              : `Temp: ${leg.prediction_value}°C`
                            } ({Number(leg.odds).toFixed(2)}x)
                          </span>
                        </div>
                      ))}
                    </div>
                    
                    {/* Dynamic Cash Out Section */}
                    {cashOutCalculations[parlay.id] ? (
                      <div className="pt-2 border-t bg-gradient-to-br from-primary/5 to-accent/10 -mx-4 -mb-3 px-4 py-3 rounded-b-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-semibold text-primary">Dynamic Parlay Cash Out</p>
                              <Badge variant="outline" className="text-xs">
                                <TrendingUp className="h-3 w-3 mr-1" />
                                {cashOutCalculations[parlay.id].percentage}%
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mb-1">
                              {cashOutCalculations[parlay.id].reasoning}
                            </p>
                            <div className="flex gap-3 text-xs">
                              {cashOutCalculations[parlay.id].timeBonus > 0 && (
                                <span className="text-muted-foreground">
                                  ⏱️ Time: +{cashOutCalculations[parlay.id].timeBonus}%
                                </span>
                              )}
                              {cashOutCalculations[parlay.id].weatherBonus > 0 && (
                                <span className="text-muted-foreground">
                                  🌤️ Weather: +{cashOutCalculations[parlay.id].weatherBonus}%
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <AutoCashoutBadge
                              betId={parlay.id}
                              betType="parlay"
                              rules={getRulesForBet(parlay.id)}
                              currentPercentage={cashOutCalculations[parlay.id].percentage}
                              currentWeatherBonus={cashOutCalculations[parlay.id].weatherBonus}
                              currentTimeBonus={cashOutCalculations[parlay.id].timeBonus}
                              currentAmount={cashOutCalculations[parlay.id].amount}
                              onCreateRule={async (ruleType, threshold) => {
                                await createRule('parlay', parlay.id, ruleType, threshold);
                              }}
                              onDeleteRule={deleteRule}
                              onToggleRule={(ruleId, isActive) => updateRule(ruleId, { is_active: isActive })}
                            />
                            <div className="flex flex-col gap-2">
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  onClick={() => handleParlayCashOut(parlay)}
                                  className="bg-gradient-primary"
                                  disabled={calculatingCashOuts}
                                >
                                  Cash Out All
                                  <span className="ml-2 font-bold">{formatCurrency(cashOutCalculations[parlay.id].amount)}</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setShowPartialCashout(prev => ({ ...prev, [parlay.id]: !prev[parlay.id] }))}
                                  disabled={calculatingCashOuts}
                                >
                                  Partial
                                  {showPartialCashout[parlay.id] ? (
                                    <ChevronUp className="h-4 w-4 ml-1" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 ml-1" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Partial Cashout Slider */}
                        {showPartialCashout[parlay.id] && (
                          <div className="mt-3 animate-in slide-in-from-top-2 space-y-3">
                            <PartialCashoutSlider
                              totalCashoutAmount={cashOutCalculations[parlay.id].amount}
                              currentStake={parlay.total_stake}
                              onPartialCashout={(percentage, amount) => handleParlayPartialCashOut(parlay, percentage, amount)}
                              onFullCashout={() => handleParlayCashOut(parlay)}
                              disabled={calculatingCashOuts}
                            />
                            <PartialCashoutHistory
                              betId={parlay.id}
                              betType="parlay"
                              currencyType={mode}
                            />
                          </div>
                        )}
                        
                        {/* Cash-Out History Chart */}
                        <CashOutHistoryChart
                          stake={parlay.total_stake}
                          odds={Number(parlay.combined_odds)}
                          createdAt={parlay.created_at}
                          expiresAt={parlay.expires_at}
                          isParlay={true}
                          parlayLegs={parlay.parlay_legs}
                          combinedOdds={Number(parlay.combined_odds)}
                          totalStake={parlay.total_stake}
                        />
                        
                        {/* Odds History Chart */}
                        <OddsHistoryChart
                          createdAt={parlay.created_at}
                          expiresAt={parlay.expires_at}
                          currentOdds={Number(parlay.combined_odds)}
                          isParlay={true}
                          parlayLegs={parlay.parlay_legs}
                          combinedOdds={Number(parlay.combined_odds)}
                        />
                      </div>
                    ) : (
                      <div className="pt-2 border-t bg-accent/10 -mx-4 -mb-3 px-4 py-3 rounded-b-lg">
                        <p className="text-sm text-muted-foreground text-center">
                          {calculatingCashOuts ? 'Calculating cash-out value...' : 'Cash-out unavailable'}
                        </p>
                      </div>
                    )}
                    
                    {/* Parlays are resolved automatically by the server */}
                    <div className="pt-2 border-t mt-2">
                      <p className="text-xs text-muted-foreground text-center">
                        ⏳ This parlay will be resolved automatically when weather data is verified
                      </p>
                    </div>
                  </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filtered Combined Bets */}
        {filteredCombinedBets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Combined Bets ({filteredCombinedBets.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredCombinedBets.map((combinedBet) => {
                  const stake = combinedBet.total_stake;
                  const potentialWin = Math.floor(stake * Number(combinedBet.combined_odds));
                  const profitLoss = combinedBet.result === 'win' ? potentialWin : 
                                    combinedBet.result === 'loss' ? -stake :
                                    combinedBet.result === 'cashed_out' ? ((combinedBet as any).cashout_amount - stake) : 0;
                  
                  return (
                  <div 
                    key={combinedBet.id} 
                    className={`border-2 border-accent/20 rounded-lg p-4 space-y-3 bg-gradient-to-br from-accent/5 to-primary/5 transition-all duration-300 ${
                      recentlyUpdated.has(combinedBet.id) 
                        ? 'ring-2 ring-primary ring-offset-2 animate-pulse' 
                        : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          {isMultiTimeCombo(combinedBet.combined_bet_categories) ? (
                            <>
                              <Zap className="h-4 w-4 text-primary" />
                              Multi-Time Combo
                            </>
                          ) : (
                            <>⚡ {combinedBet.combined_bet_categories.length}-Category Combined</>
                          )}
                        </h3>
                        <p className="text-sm text-muted-foreground">{combinedBet.city}</p>
                        <p className="text-sm text-muted-foreground">{formatDate(combinedBet.created_at)}</p>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="flex items-center gap-2 justify-end">
                          <Badge variant={getBadgeVariant(combinedBet.result)}>
                            {combinedBet.result.toUpperCase()}
                          </Badge>
                          {combinedBet.has_insurance && (
                            <Badge variant="outline" className="bg-primary/10 border-primary/30">
                              <Shield className="h-3 w-3 mr-1" />
                              INSURED
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm mt-1 font-bold">Stake: {formatCurrency(stake)}</p>
                        <p className="text-sm font-bold text-primary">Odds: {Number(combinedBet.combined_odds).toFixed(2)}x</p>
                        {combinedBet.result === 'pending' && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Potential: {formatCurrency(potentialWin)}
                          </p>
                        )}
                        {combinedBet.result !== 'pending' && (
                          <p className={`text-sm font-semibold ${profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            P/L: {profitLoss >= 0 ? '+' : ''}{formatCurrency(Math.abs(profitLoss))}
                          </p>
                        )}
                        {combinedBet.has_insurance && (
                          <p className="text-xs text-primary">Protected: {formatCurrency(Math.floor(stake * (combinedBet.insurance_payout_percentage || 0.75)))}</p>
                        )}
                      </div>
                    </div>

                    {/* Multi-Time Combo Progress Indicator */}
                    {isMultiTimeCombo(combinedBet.combined_bet_categories) && combinedBet.result === 'pending' && (
                      <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-primary" />
                            Time Slot Progress
                          </span>
                          <span className="text-muted-foreground">
                            {combinedBet.combined_bet_categories.filter((c: any) => c.result !== 'pending').length}/{combinedBet.combined_bet_categories.length} resolved
                          </span>
                        </div>
                        <Progress 
                          value={(combinedBet.combined_bet_categories.filter((c: any) => c.result !== 'pending').length / combinedBet.combined_bet_categories.length) * 100} 
                          className="h-2"
                        />
                        <div className="flex flex-wrap gap-2 mt-2">
                          {combinedBet.combined_bet_categories.map((cat: any) => {
                            const { category, slotId } = parsePredictionType(cat.prediction_type);
                            const slot = slotId ? getTimeSlot(category as BettingCategory, slotId) : null;
                            const statusIcon = cat.result === 'win' 
                              ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                              : cat.result === 'loss'
                              ? <XCircle className="h-3.5 w-3.5 text-red-500" />
                              : <Circle className="h-3.5 w-3.5 text-muted-foreground" />;
                            
                            return (
                              <div 
                                key={cat.id}
                                className={`flex flex-col gap-1 px-2 py-1.5 rounded-lg text-xs font-medium ${
                                  cat.result === 'win' ? 'bg-green-500/10 text-green-700 dark:text-green-400' :
                                  cat.result === 'loss' ? 'bg-red-500/10 text-red-700 dark:text-red-400' :
                                  'bg-muted text-muted-foreground'
                                }`}
                              >
                                <div className="flex items-center gap-1.5">
                                  {statusIcon}
                                  {slot ? `${slot.icon} ${slot.label}` : cat.prediction_type}
                                </div>
                                {cat.result === 'pending' && slotId && (
                                  <TimeSlotCountdown
                                    category={category as BettingCategory}
                                    slotId={slotId}
                                    targetDate={combinedBet.target_date}
                                    compact
                                    showIcon={false}
                                    className="mt-0.5"
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Categories - Enhanced for multi-time combos */}
                    <div className="space-y-2 pl-4 border-l-2 border-accent/30">
                      {combinedBet.combined_bet_categories.map((cat: any, idx: number) => {
                        const { category, slotId } = parsePredictionType(cat.prediction_type);
                        const slot = slotId ? getTimeSlot(category as BettingCategory, slotId) : null;
                        const displayName = slot 
                          ? `${category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ')} @ ${slot.label}`
                          : cat.prediction_type;
                        
                        return (
                          <div key={cat.id} className="text-sm flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {cat.result === 'win' && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                              {cat.result === 'loss' && <XCircle className="h-3.5 w-3.5 text-red-500" />}
                              {cat.result === 'pending' && <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
                              <span className="font-medium">
                                {slot?.icon} {displayName}
                              </span>
                            </div>
                            <span className="text-muted-foreground">
                              {cat.prediction_value} ({Number(cat.odds).toFixed(2)}x)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Dynamic Cash Out Section */}
                    {cashOutCalculations[combinedBet.id] && (
                      <div className="pt-2 border-t bg-gradient-to-br from-primary/5 to-accent/10 -mx-4 -mb-3 px-4 py-3 rounded-b-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-semibold text-primary">Dynamic Cash Out</p>
                              <Badge variant="outline" className="text-xs">
                                <TrendingUp className="h-3 w-3 mr-1" />
                                {cashOutCalculations[combinedBet.id].percentage}%
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mb-1">
                              {cashOutCalculations[combinedBet.id].reasoning}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <AutoCashoutBadge
                              betId={combinedBet.id}
                              betType="combined_bet"
                              rules={getRulesForBet(combinedBet.id)}
                              currentPercentage={cashOutCalculations[combinedBet.id].percentage}
                              currentWeatherBonus={cashOutCalculations[combinedBet.id].weatherBonus}
                              currentTimeBonus={cashOutCalculations[combinedBet.id].timeBonus}
                              currentAmount={cashOutCalculations[combinedBet.id].amount}
                              onCreateRule={async (ruleType, threshold) => {
                                await createRule('combined_bet', combinedBet.id, ruleType, threshold);
                              }}
                              onDeleteRule={deleteRule}
                              onToggleRule={(ruleId, isActive) => updateRule(ruleId, { is_active: isActive })}
                            />
                            <div className="flex flex-col gap-2">
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  onClick={() => handleCombinedBetCashOut(combinedBet)}
                                  className="bg-gradient-primary"
                                  disabled={calculatingCashOuts}
                                >
                                  Cash Out All
                                  <span className="ml-2 font-bold">{formatCurrency(cashOutCalculations[combinedBet.id].amount)}</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setShowPartialCashout(prev => ({ ...prev, [combinedBet.id]: !prev[combinedBet.id] }))}
                                  disabled={calculatingCashOuts}
                                >
                                  Partial
                                  {showPartialCashout[combinedBet.id] ? (
                                    <ChevronUp className="h-4 w-4 ml-1" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 ml-1" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Partial Cashout Slider */}
                        {showPartialCashout[combinedBet.id] && (
                          <div className="mt-3 animate-in slide-in-from-top-2 space-y-3">
                            <PartialCashoutSlider
                              totalCashoutAmount={cashOutCalculations[combinedBet.id].amount}
                              currentStake={combinedBet.total_stake}
                              onPartialCashout={(percentage, amount) => handleCombinedBetPartialCashOut(combinedBet, percentage, amount)}
                              onFullCashout={() => handleCombinedBetCashOut(combinedBet)}
                              disabled={calculatingCashOuts}
                            />
                            <PartialCashoutHistory
                              betId={combinedBet.id}
                              betType="combined_bet"
                              currencyType={mode}
                            />
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Combined bets are resolved automatically by the server */}
                    <div className="pt-2 border-t mt-2">
                      <p className="text-xs text-muted-foreground text-center">
                        ⏳ This bet will be resolved automatically when weather data is verified
                      </p>
                    </div>
                  </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* No Bets */}
        {bets.length === 0 && parlays.length === 0 && combinedBets.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground text-lg">No bets placed yet</p>
              <Button className="mt-4" onClick={onBack}>
                Place Your First Bet
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MyBets;