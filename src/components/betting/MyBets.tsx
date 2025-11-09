import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RefreshCw, Shield, TrendingUp } from 'lucide-react';
import { getBets, updateBetResult, getUser, updateUserPoints, cashOutBet } from '@/lib/supabase-auth-storage';
import { getParlays, updateParlayResult, ParlayWithLegs, cashOutParlay } from '@/lib/supabase-parlays';
import { Bet } from '@/types/supabase-betting';
import { useToast } from '@/hooks/use-toast';
import { useChallengeTracker } from '@/hooks/useChallengeTracker';
import { useAchievementTracker } from '@/hooks/useAchievementTracker';
import { useLevelSystem } from '@/hooks/useLevelSystem';
import { calculateDynamicCashOut, calculateDynamicParlayCashOut } from '@/lib/dynamic-cashout';
import CashOutHistoryChart from './CashOutHistoryChart';

interface MyBetsProps {
  onBack: () => void;
  onRefresh: () => void;
}

const MyBets = ({ onBack, onRefresh }: MyBetsProps) => {
  const [bets, setBets] = useState<Bet[]>([]);
  const [parlays, setParlays] = useState<ParlayWithLegs[]>([]);
  const [loading, setLoading] = useState(true);
  const [cashOutCalculations, setCashOutCalculations] = useState<Record<string, any>>({});
  const [calculatingCashOuts, setCalculatingCashOuts] = useState(false);
  const { toast } = useToast();
  const { checkAndUpdateChallenges } = useChallengeTracker();
  const { checkAchievements } = useAchievementTracker();
  const { awardXPForAction } = useLevelSystem();
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [betsData, parlaysData] = await Promise.all([
          getBets(),
          getParlays()
        ]);
        setBets(betsData);
        setParlays(parlaysData);
        
        // Calculate dynamic cash-outs for pending bets
        await calculateAllCashOuts(betsData, parlaysData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const calculateAllCashOuts = async (betsData: Bet[], parlaysData: ParlayWithLegs[]) => {
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
    } catch (error) {
      console.error('Error calculating cash-outs:', error);
    } finally {
      setCashOutCalculations(calculations);
      setCalculatingCashOuts(false);
    }
  };

  const refreshBets = async () => {
    try {
      const [betsData, parlaysData] = await Promise.all([
        getBets(),
        getParlays()
      ]);
      setBets(betsData);
      setParlays(parlaysData);
      await calculateAllCashOuts(betsData, parlaysData);
      onRefresh();
    } catch (error) {
      console.error('Error refreshing bets:', error);
    }
  };

  const handleManualSettle = async (bet: Bet, result: 'win' | 'loss') => {
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
          <Button variant="outline" size="sm" onClick={refreshBets}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Pending Bets */}
        {pendingBets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Pending Single Bets ({pendingBets.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingBets.map((bet) => (
                  <div key={bet.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg">{bet.city}</h3>
                        <p className="text-muted-foreground">
                          {bet.prediction_type === 'rain' 
                            ? `Rain: ${bet.prediction_value}` 
                            : `Temperature: ${bet.prediction_value}°C`
                          }
                        </p>
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
                        <p className="text-sm mt-1">Stake: {bet.stake} pts</p>
                        <p className="text-sm">Odds: {bet.odds}x</p>
                        {(bet as any).has_insurance && (
                          <p className="text-xs text-primary">Protected: {Math.floor(bet.stake * ((bet as any).insurance_payout_percentage || 0.8))} pts</p>
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
                            <span className="ml-2 font-bold">{cashOutCalculations[bet.id].amount} pts</span>
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
                        className="text-green-600 border-green-200 hover:bg-green-50"
                      >
                        Mark as Win
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleManualSettle(bet, 'loss')}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        Mark as Loss
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending Parlays */}
        {pendingParlays.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Pending Parlays ({pendingParlays.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingParlays.map((parlay) => (
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
                        <p className="text-sm mt-1 font-bold">Stake: {parlay.total_stake} pts</p>
                        <p className="text-sm font-bold text-primary">Odds: {Number(parlay.combined_odds).toFixed(2)}x</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Potential: {Math.floor(parlay.total_stake * Number(parlay.combined_odds))} pts
                        </p>
                        {parlay.has_insurance && (
                          <p className="text-xs text-primary">Protected: {Math.floor(parlay.total_stake * (parlay.insurance_payout_percentage || 0.75))} pts</p>
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
                            <span className="ml-2 font-bold">{cashOutCalculations[parlay.id].amount} pts</span>
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
                        className="text-green-600 border-green-200 hover:bg-green-50"
                      >
                        Mark as Win
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleParlaySettle(parlay, 'loss')}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        Mark as Loss
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Settled Bets */}
        {settledBets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Single Bet History ({settledBets.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {settledBets.map((bet) => (
                  <div key={bet.id} className="flex justify-between items-center p-3 border rounded">
                    <div>
                      <h3 className="font-medium">{bet.city}</h3>
                      <p className="text-sm text-muted-foreground">
                        {bet.prediction_type === 'rain' 
                          ? `Rain: ${bet.prediction_value}` 
                          : `Temperature: ${bet.prediction_value}°C`
                        }
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(bet.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant={getCashOutBadgeVariant(bet.result)}>
                        {formatResult(bet.result)}
                      </Badge>
                      <p className="text-sm mt-1">
                        {bet.result === 'win' 
                          ? `+${Math.floor(bet.stake * Number(bet.odds))} pts`
                          : bet.result === 'cashed_out'
                          ? `+${(bet as any).cashout_amount || 0} pts`
                          : `-${bet.stake} pts`
                        }
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Settled Parlays */}
        {settledParlays.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Parlay History ({settledParlays.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {settledParlays.map((parlay) => (
                  <div key={parlay.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          💰 {parlay.parlay_legs.length}-Leg Parlay
                        </h3>
                        <p className="text-sm text-muted-foreground">{formatDate(parlay.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={getCashOutBadgeVariant(parlay.result)}>
                          {formatResult(parlay.result)}
                        </Badge>
                        <p className="text-sm mt-1">Stake: {parlay.total_stake} pts</p>
                        <p className="text-sm">Odds: {Number(parlay.combined_odds).toFixed(2)}x</p>
                        {parlay.result === 'win' && (
                          <p className="text-sm font-bold text-green-600">
                            Won: {Math.floor(parlay.total_stake * Number(parlay.combined_odds))} pts
                          </p>
                        )}
                        {parlay.result === 'cashed_out' && (
                          <p className="text-sm font-bold text-primary">
                            Cashed Out: {parlay.cashout_amount || 0} pts
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Parlay Legs */}
                    <div className="space-y-1 pl-4 border-l-2 border-muted">
                      {parlay.parlay_legs.map((leg, idx) => (
                        <div key={leg.id} className="text-sm text-muted-foreground">
                          <span className="font-medium">Leg {idx + 1}: {leg.city}</span>
                          <span className="ml-2">
                            {leg.prediction_type === 'rain' 
                              ? `Rain: ${leg.prediction_value}` 
                              : `Temp: ${leg.prediction_value}°C`
                            } ({Number(leg.odds).toFixed(2)}x)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* No Bets */}
        {bets.length === 0 && parlays.length === 0 && (
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