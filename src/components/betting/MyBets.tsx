import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RefreshCw, Shield, TrendingUp, Zap, Clock, CheckCircle2, Circle, XCircle, Timer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getBets, updateBetResult, getUser, updateUserPoints, cashOutBet } from '@/lib/supabase-auth-storage';
import { getParlays, updateParlayResult, ParlayWithLegs, cashOutParlay } from '@/lib/supabase-parlays';
import { getCombinedBets, updateCombinedBetResult, cashOutCombinedBet } from '@/lib/supabase-combined-bets';
import { Bet } from '@/types/supabase-betting';
import { useToast } from '@/hooks/use-toast';
import { useChallengeTracker } from '@/hooks/useChallengeTracker';
import { useAchievementTracker } from '@/hooks/useAchievementTracker';
import { useLevelSystem } from '@/hooks/useLevelSystem';
import { calculateDynamicCashOut, calculateDynamicParlayCashOut } from '@/lib/dynamic-cashout';
import CashOutHistoryChart from './CashOutHistoryChart';
import OddsHistoryChart from './OddsHistoryChart';
import { formatRands } from '@/lib/currency';
import { useCurrencyMode } from '@/contexts/CurrencyModeContext';
import { getTimeSlot, BettingCategory, CATEGORY_TIME_SLOTS } from '@/lib/betting-timing';
import { Progress } from '@/components/ui/progress';
import { TimeSlotCountdown, MultiSlotCountdown } from './TimeSlotCountdown';

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
  const [cashOutCalculations, setCashOutCalculations] = useState<Record<string, any>>({});
  const [calculatingCashOuts, setCalculatingCashOuts] = useState(false);
  const [settlingBets, setSettlingBets] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'settled'>('all');
  const [resolvingBets, setResolvingBets] = useState(false);
  const { toast } = useToast();
  const { checkAndUpdateChallenges } = useChallengeTracker();
  const { checkAchievements } = useAchievementTracker();
  const { awardXPForAction } = useLevelSystem();

  // Calculate comprehensive statistics
  const calculateStats = () => {
    const allBets = [...bets, ...parlays, ...combinedBets];
    const settledBets = allBets.filter(bet => bet.result === 'win' || bet.result === 'loss' || bet.result === 'cashed_out');
    const wonBets = allBets.filter(bet => bet.result === 'win');
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
      
      // Calculate dynamic cash-outs for pending bets
      await calculateAllCashOuts(betsData, parlaysData, combinedBetsData);
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
          // Update the specific bet in state
          setBets(prevBets => 
            prevBets.map(bet => 
              bet.id === payload.new.id ? { ...bet, ...payload.new } : bet
            )
          );
          // Show toast for resolved bets
          if (payload.old.result === 'pending' && payload.new.result !== 'pending') {
            const resultEmoji = payload.new.result === 'win' ? '🎉' : payload.new.result === 'cashed_out' ? '💰' : '😞';
            toast({
              title: `Bet ${payload.new.result === 'win' ? 'Won!' : payload.new.result === 'cashed_out' ? 'Cashed Out!' : 'Lost'} ${resultEmoji}`,
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

    return () => {
      supabase.removeChannel(betsChannel);
    };
  }, [mode, toast]);

  const calculateAllCashOuts = async (betsData: Bet[], parlaysData: ParlayWithLegs[], combinedBetsData: any[]) => {
    setCalculatingCashOuts(true);
    const calculations: Record<string, any> = {};
    
    try {
      // Calculate for pending single bets
      const pendingBets = betsData.filter(bet => bet.result === 'pending');
      for (const bet of pendingBets) {
        try {
          const calc = await calculateDynamicCashOut(
            bet.stake,
            Number(bet.odds),
            bet.city,
            bet.prediction_type,
            bet.prediction_value,
            bet.created_at,
            bet.expires_at
          );
          calculations[bet.id] = calc;
        } catch (error) {
          console.error(`Error calculating cash-out for bet ${bet.id}:`, error);
        }
      }
      
      // Calculate for pending parlays
      const pendingParlays = parlaysData.filter(p => p.result === 'pending');
      for (const parlay of pendingParlays) {
        try {
          const calc = await calculateDynamicParlayCashOut(
            parlay.total_stake,
            Number(parlay.combined_odds),
            parlay.parlay_legs,
            parlay.created_at,
            parlay.expires_at
          );
          calculations[parlay.id] = calc;
        } catch (error) {
          console.error(`Error calculating cash-out for parlay ${parlay.id}:`, error);
        }
      }
      
      // Calculate for pending combined bets
      const pendingCombinedBets = combinedBetsData.filter(cb => cb.result === 'pending');
      for (const combinedBet of pendingCombinedBets) {
        try {
          const calc = await calculateDynamicParlayCashOut(
            combinedBet.total_stake,
            Number(combinedBet.combined_odds),
            combinedBet.combined_bet_categories,
            combinedBet.created_at,
            combinedBet.expires_at
          );
          calculations[combinedBet.id] = calc;
        } catch (error) {
          console.error(`Error calculating cash-out for combined bet ${combinedBet.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error calculating cash-outs:', error);
    } finally {
      setCashOutCalculations(calculations);
      setCalculatingCashOuts(false);
    }
  };

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
      await calculateAllCashOuts(betsData, parlaysData, combinedBetsData);
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

  const handleManualSettle = async (bet: Bet, result: 'win' | 'loss') => {
    if (settlingBets.has(bet.id)) return;
    
    setSettlingBets(prev => new Set(prev).add(bet.id));
    try {
      await updateBetResult(bet.id, result);
      
      const user = await getUser();
      
      if (result === 'win') {
        const winnings = Math.floor(bet.stake * Number(bet.odds));
        await updateUserPoints(user.points + winnings);
        
        // Track win for challenges
        await checkAndUpdateChallenges('bet_won');

        // Check for newly unlocked achievements
        await checkAchievements();

        // Award XP based on result
        await awardXPForAction('BET_WON');
        
        toast({
          title: "Bet Won! 🎉",
          description: `You won ${winnings} points!`,
        });
      } else {
        // Handle loss with insurance
        const betData = bet as any;
        if (betData.has_insurance && betData.insurance_payout_percentage) {
          const insurancePayout = Math.floor(bet.stake * betData.insurance_payout_percentage);
          await updateUserPoints(user.points + insurancePayout);
          
          toast({
            title: "Bet Lost (Insured) 🛡️",
            description: `Insurance returned ${insurancePayout} points!`,
          });
        } else {
          toast({
            title: "Bet Lost 😞",
            description: `Better luck next time!`,
          });
        }
        
        await awardXPForAction('BET_LOST');
      }
      
      await refreshBets();
    } catch (error) {
      console.error('Error settling bet:', error);
      toast({
        title: "Error",
        description: "Failed to settle bet. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSettlingBets(prev => {
        const next = new Set(prev);
        next.delete(bet.id);
        return next;
      });
    }
  };

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

      await cashOutBet(bet.id, calculation.amount);
      
      toast({
        title: "Bet Cashed Out! 💰",
        description: `You received ${calculation.amount} points (${calculation.percentage}% of potential win)`,
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

      await cashOutParlay(parlay.id, calculation.amount);
      
      toast({
        title: "Parlay Cashed Out! 💰",
        description: `You received ${calculation.amount} points (${calculation.percentage}% of potential win)`,
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

  const handleParlaySettle = async (parlay: ParlayWithLegs, result: 'win' | 'loss') => {
    if (settlingBets.has(parlay.id)) return;
    
    setSettlingBets(prev => new Set(prev).add(parlay.id));
    try {
      await updateParlayResult(parlay.id, result);
      
      const user = await getUser();
      
      if (result === 'win') {
        const winnings = Math.floor(parlay.total_stake * Number(parlay.combined_odds));
        await updateUserPoints(user.points + winnings);
        
        await checkAndUpdateChallenges('bet_won');
        await checkAchievements();
        await awardXPForAction('BET_WON');
        
        toast({
          title: "Parlay Won! 🎉",
          description: `You won ${winnings} points!`,
        });
      } else {
        // Handle loss with insurance
        if (parlay.has_insurance && parlay.insurance_payout_percentage) {
          const insurancePayout = Math.floor(parlay.total_stake * parlay.insurance_payout_percentage);
          await updateUserPoints(user.points + insurancePayout);
          
          toast({
            title: "Parlay Lost (Insured) 🛡️",
            description: `Insurance returned ${insurancePayout} points!`,
          });
        } else {
          toast({
            title: "Parlay Lost 😞",
            description: `Better luck next time!`,
          });
        }
        
        await awardXPForAction('BET_LOST');
      }
      
      await refreshBets();
    } catch (error) {
      console.error('Error settling parlay:', error);
      toast({
        title: "Error",
        description: "Failed to settle parlay. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSettlingBets(prev => {
        const next = new Set(prev);
        next.delete(parlay.id);
        return next;
      });
    }
  };

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

      await cashOutCombinedBet(combinedBet.id, calculation.amount);
      
      toast({
        title: "Combined Bet Cashed Out! 💰",
        description: `You received ${calculation.amount} points (${calculation.percentage}% of potential win)`,
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

  const handleCombinedBetSettle = async (combinedBet: any, result: 'win' | 'loss') => {
    if (settlingBets.has(combinedBet.id)) return;
    
    setSettlingBets(prev => new Set(prev).add(combinedBet.id));
    try {
      await updateCombinedBetResult(combinedBet.id, result);
      
      const user = await getUser();
      
      if (result === 'win') {
        const winnings = Math.floor(combinedBet.total_stake * Number(combinedBet.combined_odds));
        await updateUserPoints(user.points + winnings);
        
        await checkAndUpdateChallenges('bet_won');
        await checkAchievements();
        await awardXPForAction('BET_WON');
        
        toast({
          title: "Combined Bet Won! 🎉",
          description: `You won ${winnings} points!`,
        });
      } else {
        // Handle loss with insurance
        if (combinedBet.has_insurance && combinedBet.insurance_payout_percentage) {
          const insurancePayout = Math.floor(combinedBet.total_stake * combinedBet.insurance_payout_percentage);
          await updateUserPoints(user.points + insurancePayout);
          
          toast({
            title: "Combined Bet Lost (Insured) 🛡️",
            description: `Insurance returned ${insurancePayout} points!`,
          });
        } else {
          toast({
            title: "Combined Bet Lost 😞",
            description: `Better luck next time!`,
          });
        }
        
        await awardXPForAction('BET_LOST');
      }
      
      await refreshBets();
    } catch (error) {
      console.error('Error settling combined bet:', error);
      toast({
        title: "Error",
        description: "Failed to settle combined bet. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSettlingBets(prev => {
        const next = new Set(prev);
        next.delete(combinedBet.id);
        return next;
      });
    }
  };

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
                  <div key={bet.id} className="border rounded-lg p-4 space-y-3">
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
                          <Button 
                            size="sm" 
                            onClick={() => handleCashOut(bet)}
                            className="bg-gradient-primary ml-4"
                            disabled={calculatingCashOuts}
                          >
                            Cash Out
                            <span className="ml-2 font-bold">{formatCurrency(cashOutCalculations[bet.id].amount)}</span>
                          </Button>
                        </div>
                        
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
                    
                    {/* Manual Settlement Buttons */}
                    <div className="flex gap-2 pt-2 border-t mt-2">
                      <p className="text-sm text-muted-foreground mr-auto">Manual Settlement:</p>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleManualSettle(bet, 'win')}
                        disabled={settlingBets.has(bet.id)}
                        className="text-green-600 border-green-200 hover:bg-green-50"
                      >
                        {settlingBets.has(bet.id) ? 'Processing...' : 'Mark as Win'}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleManualSettle(bet, 'loss')}
                        disabled={settlingBets.has(bet.id)}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        {settlingBets.has(bet.id) ? 'Processing...' : 'Mark as Loss'}
                      </Button>
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
                  <div key={parlay.id} className="border-2 border-primary/20 rounded-lg p-4 space-y-3 bg-gradient-primary/5">
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
                          <Button 
                            size="sm" 
                            onClick={() => handleParlayCashOut(parlay)}
                            className="bg-gradient-primary ml-4"
                            disabled={calculatingCashOuts}
                          >
                            Cash Out
                            <span className="ml-2 font-bold">{formatCurrency(cashOutCalculations[parlay.id].amount)}</span>
                          </Button>
                        </div>
                        
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
                    
                    {/* Manual Settlement Buttons */}
                    <div className="flex gap-2 pt-2 border-t mt-2">
                      <p className="text-sm text-muted-foreground mr-auto">Manual Settlement:</p>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleParlaySettle(parlay, 'win')}
                        disabled={settlingBets.has(parlay.id)}
                        className="text-green-600 border-green-200 hover:bg-green-50"
                      >
                        {settlingBets.has(parlay.id) ? 'Processing...' : 'Mark as Win'}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleParlaySettle(parlay, 'loss')}
                        disabled={settlingBets.has(parlay.id)}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        {settlingBets.has(parlay.id) ? 'Processing...' : 'Mark as Loss'}
                      </Button>
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
                  <div key={combinedBet.id} className="border-2 border-accent/20 rounded-lg p-4 space-y-3 bg-gradient-to-br from-accent/5 to-primary/5">
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
                          <Button 
                            size="sm" 
                            onClick={() => handleCombinedBetCashOut(combinedBet)}
                            className="bg-gradient-primary ml-4"
                            disabled={calculatingCashOuts}
                          >
                            Cash Out
                            <span className="ml-2 font-bold">{formatCurrency(cashOutCalculations[combinedBet.id].amount)}</span>
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {/* Manual Settlement Buttons */}
                    <div className="flex gap-2 pt-2 border-t mt-2">
                      <p className="text-sm text-muted-foreground mr-auto">Manual Settlement:</p>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleCombinedBetSettle(combinedBet, 'win')}
                        disabled={settlingBets.has(combinedBet.id)}
                        className="text-green-600 border-green-200 hover:bg-green-50"
                      >
                        {settlingBets.has(combinedBet.id) ? 'Processing...' : 'Mark as Win'}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleCombinedBetSettle(combinedBet, 'loss')}
                        disabled={settlingBets.has(combinedBet.id)}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        {settlingBets.has(combinedBet.id) ? 'Processing...' : 'Mark as Loss'}
                      </Button>
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