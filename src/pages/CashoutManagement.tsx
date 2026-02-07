import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  ArrowLeft, 
  RefreshCw, 
  TrendingUp, 
  Clock, 
  Zap, 
  Settings2, 
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Coins,
  Activity,
  Banknote
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getBets } from '@/lib/supabase-auth-storage';
import { getParlays, ParlayWithLegs } from '@/lib/supabase-parlays';
import { getCombinedBets } from '@/lib/supabase-combined-bets';
import { partialCashOutBet, partialCashOutParlay, partialCashOutCombinedBet } from '@/lib/partial-cashout';
import { cashOutBet } from '@/lib/supabase-auth-storage';
import { cashOutParlay } from '@/lib/supabase-parlays';
import { cashOutCombinedBet } from '@/lib/supabase-combined-bets';
import { Bet } from '@/types/supabase-betting';
import { useToast } from '@/hooks/use-toast';
import { useCurrencyMode } from '@/contexts/CurrencyModeContext';
import { useRealtimeCashout, CashOutCalculation } from '@/hooks/useRealtimeCashout';
import { useAutoCashout, RuleType, BetType, AutoCashoutRule } from '@/hooks/useAutoCashout';
import { formatCurrency } from '@/lib/currency';
import { PartialCashoutSlider } from '@/components/betting/PartialCashoutSlider';
import { PartialCashoutHistory } from '@/components/betting/PartialCashoutHistory';
import { AutoCashoutBadge } from '@/components/betting/AutoCashoutBadge';
import { LiveCashoutValue } from '@/components/betting/LiveCashoutValue';
import CashOutHistoryChart from '@/components/betting/CashOutHistoryChart';
import PortfolioOverviewChart from '@/components/betting/PortfolioOverviewChart';
import { format } from 'date-fns';

const CashoutManagement = () => {
  const navigate = useNavigate();
  const { mode } = useCurrencyMode();
  const { toast } = useToast();
  
  const [bets, setBets] = useState<Bet[]>([]);
  const [parlays, setParlays] = useState<ParlayWithLegs[]>([]);
  const [combinedBets, setCombinedBets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBets, setExpandedBets] = useState<Set<string>>(new Set());
  
  // Auto-cashout rules
  const { 
    rules: autoCashoutRules, 
    createRule, 
    deleteRule, 
    updateRule,
    checkRules, 
    getRulesForBet 
  } = useAutoCashout();
  
  // Callback for real-time updates
  const handleCalculationsUpdated = useCallback(
    (calculations: Record<string, CashOutCalculation>) => {
      checkRules(calculations);
    },
    [checkRules]
  );
  
  // Real-time cashout calculations
  const { 
    calculations: cashOutCalculations, 
    isUpdating: calculatingCashOuts,
    updateAllCashouts 
  } = useRealtimeCashout(bets, parlays, combinedBets, {
    pollingInterval: 30000,
    enabled: !loading,
    onCalculationsUpdated: handleCalculationsUpdated,
  });
  
  const fetchData = async () => {
    try {
      const [betsData, parlaysData, combinedBetsData] = await Promise.all([
        getBets(undefined, mode),
        getParlays(undefined, mode),
        getCombinedBets(undefined, mode)
      ]);
      // Filter only pending bets
      setBets(betsData.filter(b => b.result === 'pending'));
      setParlays(parlaysData.filter(p => p.result === 'pending'));
      setCombinedBets(combinedBetsData.filter(cb => cb.result === 'pending'));
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [mode]);

  const refreshData = async () => {
    setLoading(true);
    await fetchData();
    await updateAllCashouts();
    toast({
      title: "Refreshed",
      description: "Cash-out values updated",
    });
  };

  const toggleExpanded = (id: string) => {
    setExpandedBets(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Cash out handlers
  const handleCashOut = async (bet: Bet) => {
    const calc = cashOutCalculations[bet.id];
    if (!calc) return;
    
    try {
      await cashOutBet(bet.id, calc.amount, mode);
      toast({ title: "Cashed Out! 💰", description: `Received ${formatCurrency(calc.amount, mode)}` });
      fetchData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to cash out", variant: "destructive" });
    }
  };

  const handleParlayCashOut = async (parlay: ParlayWithLegs) => {
    const calc = cashOutCalculations[parlay.id];
    if (!calc) return;
    
    try {
      await cashOutParlay(parlay.id, calc.amount, mode);
      toast({ title: "Parlay Cashed Out! 💰", description: `Received ${formatCurrency(calc.amount, mode)}` });
      fetchData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to cash out parlay", variant: "destructive" });
    }
  };

  const handleCombinedCashOut = async (combinedBet: any) => {
    const calc = cashOutCalculations[combinedBet.id];
    if (!calc) return;
    
    try {
      await cashOutCombinedBet(combinedBet.id, calc.amount, mode);
      toast({ title: "Combined Bet Cashed Out! 💰", description: `Received ${formatCurrency(calc.amount, mode)}` });
      fetchData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to cash out combined bet", variant: "destructive" });
    }
  };

  // Partial cashout handlers
  const handlePartialCashOut = async (bet: Bet, percentage: number, amount: number) => {
    try {
      await partialCashOutBet(bet.id, amount, percentage, mode);
      toast({ title: "Partial Cash Out! 💰", description: `Cashed out ${percentage}% for ${formatCurrency(amount, mode)}` });
      fetchData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to partial cash out", variant: "destructive" });
    }
  };

  const handleParlayPartialCashOut = async (parlay: ParlayWithLegs, percentage: number, amount: number) => {
    try {
      await partialCashOutParlay(parlay.id, amount, percentage, mode);
      toast({ title: "Partial Cash Out! 💰", description: `Cashed out ${percentage}% for ${formatCurrency(amount, mode)}` });
      fetchData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to partial cash out", variant: "destructive" });
    }
  };

  const handleCombinedPartialCashOut = async (combinedBet: any, percentage: number, amount: number) => {
    try {
      await partialCashOutCombinedBet(combinedBet.id, amount, percentage, mode);
      toast({ title: "Partial Cash Out! 💰", description: `Cashed out ${percentage}% for ${formatCurrency(amount, mode)}` });
      fetchData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to partial cash out", variant: "destructive" });
    }
  };

  // Quick Cash Out All handler
  const [isCashingOutAll, setIsCashingOutAll] = useState(false);
  
  const handleCashOutAll = async () => {
    if (totalActiveBets === 0) return;
    
    setIsCashingOutAll(true);
    let successCount = 0;
    let failCount = 0;
    let totalCashedOut = 0;
    
    try {
      // Cash out single bets
      for (const bet of bets) {
        const calc = cashOutCalculations[bet.id];
        if (calc) {
          try {
            await cashOutBet(bet.id, calc.amount, mode);
            successCount++;
            totalCashedOut += calc.amount;
          } catch (error) {
            console.error('Failed to cash out bet:', bet.id, error);
            failCount++;
          }
        }
      }
      
      // Cash out parlays
      for (const parlay of parlays) {
        const calc = cashOutCalculations[parlay.id];
        if (calc) {
          try {
            await cashOutParlay(parlay.id, calc.amount, mode);
            successCount++;
            totalCashedOut += calc.amount;
          } catch (error) {
            console.error('Failed to cash out parlay:', parlay.id, error);
            failCount++;
          }
        }
      }
      
      // Cash out combined bets
      for (const cb of combinedBets) {
        const calc = cashOutCalculations[cb.id];
        if (calc) {
          try {
            await cashOutCombinedBet(cb.id, calc.amount, mode);
            successCount++;
            totalCashedOut += calc.amount;
          } catch (error) {
            console.error('Failed to cash out combined bet:', cb.id, error);
            failCount++;
          }
        }
      }
      
      if (failCount === 0) {
        toast({
          title: "All Bets Cashed Out! 🎉",
          description: `Successfully cashed out ${successCount} bets for ${formatCurrency(totalCashedOut, mode)}`,
        });
      } else {
        toast({
          title: "Partial Success",
          description: `Cashed out ${successCount} bets for ${formatCurrency(totalCashedOut, mode)}. ${failCount} failed.`,
          variant: failCount > successCount ? "destructive" : "default",
        });
      }
      
      fetchData();
    } catch (error) {
      console.error('Error in bulk cash out:', error);
      toast({
        title: "Error",
        description: "Failed to complete bulk cash out",
        variant: "destructive",
      });
    } finally {
      setIsCashingOutAll(false);
    }
  };

  // Cash Out Profitable Only handler
  const [isCashingOutProfitable, setIsCashingOutProfitable] = useState(false);

  // Calculate totals
  const totalPotentialCashout = Object.values(cashOutCalculations).reduce((sum, calc) => sum + calc.amount, 0);
  const totalStake = [...bets, ...parlays, ...combinedBets].reduce((sum, bet) => {
    return sum + ('total_stake' in bet ? bet.total_stake : bet.stake);
  }, 0);
  const totalActiveBets = bets.length + parlays.length + combinedBets.length;
  const activeRulesCount = autoCashoutRules.filter(r => r.is_active).length;

  // Calculate profitable bets
  const profitableBets = bets.filter(bet => {
    const calc = cashOutCalculations[bet.id];
    return calc && calc.amount > bet.stake;
  });
  
  const profitableParlays = parlays.filter(parlay => {
    const calc = cashOutCalculations[parlay.id];
    return calc && calc.amount > parlay.total_stake;
  });
  
  const profitableCombinedBets = combinedBets.filter(cb => {
    const calc = cashOutCalculations[cb.id];
    return calc && calc.amount > cb.total_stake;
  });
  
  const totalProfitableBets = profitableBets.length + profitableParlays.length + profitableCombinedBets.length;
  
  const profitableCashoutTotal = [
    ...profitableBets.map(b => cashOutCalculations[b.id]?.amount || 0),
    ...profitableParlays.map(p => cashOutCalculations[p.id]?.amount || 0),
    ...profitableCombinedBets.map(cb => cashOutCalculations[cb.id]?.amount || 0),
  ].reduce((sum, val) => sum + val, 0);
  
  const profitableStakeTotal = [
    ...profitableBets.map(b => b.stake),
    ...profitableParlays.map(p => p.total_stake),
    ...profitableCombinedBets.map(cb => cb.total_stake),
  ].reduce((sum, val) => sum + val, 0);
  
  const profitAmount = profitableCashoutTotal - profitableStakeTotal;

  const handleCashOutProfitableOnly = async () => {
    if (totalProfitableBets === 0) return;
    
    setIsCashingOutProfitable(true);
    let successCount = 0;
    let failCount = 0;
    let totalCashedOut = 0;
    
    try {
      for (const bet of profitableBets) {
        const calc = cashOutCalculations[bet.id];
        if (calc) {
          try {
            await cashOutBet(bet.id, calc.amount, mode);
            successCount++;
            totalCashedOut += calc.amount;
          } catch (error) {
            console.error('Failed to cash out bet:', bet.id, error);
            failCount++;
          }
        }
      }
      
      for (const parlay of profitableParlays) {
        const calc = cashOutCalculations[parlay.id];
        if (calc) {
          try {
            await cashOutParlay(parlay.id, calc.amount, mode);
            successCount++;
            totalCashedOut += calc.amount;
          } catch (error) {
            console.error('Failed to cash out parlay:', parlay.id, error);
            failCount++;
          }
        }
      }
      
      for (const cb of profitableCombinedBets) {
        const calc = cashOutCalculations[cb.id];
        if (calc) {
          try {
            await cashOutCombinedBet(cb.id, calc.amount, mode);
            successCount++;
            totalCashedOut += calc.amount;
          } catch (error) {
            console.error('Failed to cash out combined bet:', cb.id, error);
            failCount++;
          }
        }
      }
      
      if (failCount === 0) {
        toast({
          title: "Profitable Bets Cashed Out! 💰",
          description: `Cashed out ${successCount} profitable bets for ${formatCurrency(totalCashedOut, mode)}`,
        });
      } else {
        toast({
          title: "Partial Success",
          description: `Cashed out ${successCount} bets for ${formatCurrency(totalCashedOut, mode)}. ${failCount} failed.`,
          variant: failCount > successCount ? "destructive" : "default",
        });
      }
      
      fetchData();
    } catch (error) {
      console.error('Error in profitable cash out:', error);
      toast({
        title: "Error",
        description: "Failed to complete profitable cash out",
        variant: "destructive",
      });
    } finally {
      setIsCashingOutProfitable(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <DollarSign className="h-6 w-6 text-primary" />
                Cash-Out Management
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage all your active bets and cash-out options in one place
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {totalProfitableBets > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    disabled={isCashingOutProfitable || calculatingCashOuts}
                    className="border-green-500/50 text-green-600 hover:bg-green-500/10"
                  >
                    {isCashingOutProfitable ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <TrendingUp className="h-4 w-4 mr-2" />
                    )}
                    Profitable Only ({totalProfitableBets})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-green-500" />
                      Cash Out Profitable Bets?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3">
                      <p>
                        You are about to cash out <strong>{totalProfitableBets} profitable bets</strong> for:
                      </p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(profitableCashoutTotal, mode)}
                      </p>
                      <p className="text-sm text-green-600">
                        Original stake: {formatCurrency(profitableStakeTotal, mode)} • 
                        Profit: +{formatCurrency(profitAmount, mode)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Only bets currently showing a profit will be cashed out. {totalActiveBets - totalProfitableBets} other bets will remain active.
                      </p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCashOutProfitableOnly} className="bg-green-600 hover:bg-green-700">
                      Cash Out Profitable
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {totalActiveBets > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="default" 
                    disabled={isCashingOutAll || calculatingCashOuts}
                  >
                    {isCashingOutAll ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Banknote className="h-4 w-4 mr-2" />
                    )}
                    Cash Out All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      Cash Out All Bets?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3">
                      <p>
                        You are about to cash out <strong>{totalActiveBets} active bets</strong> for a total of:
                      </p>
                      <p className="text-2xl font-bold text-primary">
                        {formatCurrency(totalPotentialCashout, mode)}
                      </p>
                      <p className="text-sm">
                        Original stake: {formatCurrency(totalStake, mode)} • 
                        {totalPotentialCashout >= totalStake 
                          ? ` Profit: ${formatCurrency(totalPotentialCashout - totalStake, mode)}`
                          : ` Loss: ${formatCurrency(totalStake - totalPotentialCashout, mode)}`
                        }
                      </p>
                      <p className="text-sm text-muted-foreground">
                        This action cannot be undone. All pending bets will be settled immediately.
                      </p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCashOutAll}>
                      Confirm Cash Out All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button variant="outline" onClick={refreshData} disabled={calculatingCashOuts}>
              <RefreshCw className={`h-4 w-4 mr-2 ${calculatingCashOuts ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Bets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalActiveBets}</div>
              <p className="text-xs text-muted-foreground">
                {bets.length} single • {parlays.length} parlay • {combinedBets.length} combined
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Stake</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalStake, mode)}</div>
              <p className="text-xs text-muted-foreground">At risk</p>
            </CardContent>
          </Card>
          
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-primary">Cash-Out Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{formatCurrency(totalPotentialCashout, mode)}</div>
              <p className="text-xs text-muted-foreground">
                {totalStake > 0 ? `${((totalPotentialCashout / totalStake) * 100).toFixed(0)}% of stake` : 'No bets'}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Auto Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                {activeRulesCount}
                {activeRulesCount > 0 && <Zap className="h-5 w-5 text-yellow-500" />}
              </div>
              <p className="text-xs text-muted-foreground">Active triggers</p>
            </CardContent>
          </Card>
        </div>

        {/* Portfolio Overview Chart */}
        <PortfolioOverviewChart
          bets={bets}
          parlays={parlays}
          combinedBets={combinedBets}
          currencyMode={mode}
        />

        {/* Main Content */}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All ({totalActiveBets})</TabsTrigger>
            <TabsTrigger value="single">Single ({bets.length})</TabsTrigger>
            <TabsTrigger value="parlay">Parlay ({parlays.length})</TabsTrigger>
            <TabsTrigger value="combined">Combined ({combinedBets.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {totalActiveBets === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg text-muted-foreground">No active bets</p>
                  <Button className="mt-4" onClick={() => navigate('/')}>
                    Place a Bet
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Single Bets */}
                {bets.map(bet => (
                  <BetCard
                    key={bet.id}
                    bet={bet}
                    type="bet"
                    calculation={cashOutCalculations[bet.id]}
                    isExpanded={expandedBets.has(bet.id)}
                    onToggle={() => toggleExpanded(bet.id)}
                    onCashOut={() => handleCashOut(bet)}
                    onPartialCashOut={(p, a) => handlePartialCashOut(bet, p, a)}
                    rules={getRulesForBet(bet.id)}
                    onCreateRule={async (ruleType, threshold) => { await createRule('bet', bet.id, ruleType, threshold); }}
                    onDeleteRule={deleteRule}
                    onToggleRule={async (ruleId, isActive) => { await updateRule(ruleId, { is_active: isActive }); }}
                    currencyMode={mode}
                    isUpdating={calculatingCashOuts}
                  />
                ))}
                
                {/* Parlays */}
                {parlays.map(parlay => (
                  <BetCard
                    key={parlay.id}
                    bet={parlay}
                    type="parlay"
                    calculation={cashOutCalculations[parlay.id]}
                    isExpanded={expandedBets.has(parlay.id)}
                    onToggle={() => toggleExpanded(parlay.id)}
                    onCashOut={() => handleParlayCashOut(parlay)}
                    onPartialCashOut={(p, a) => handleParlayPartialCashOut(parlay, p, a)}
                    rules={getRulesForBet(parlay.id)}
                    onCreateRule={async (ruleType, threshold) => { await createRule('parlay', parlay.id, ruleType, threshold); }}
                    onDeleteRule={deleteRule}
                    onToggleRule={async (ruleId, isActive) => { await updateRule(ruleId, { is_active: isActive }); }}
                    currencyMode={mode}
                    isUpdating={calculatingCashOuts}
                  />
                ))}
                
                {/* Combined Bets */}
                {combinedBets.map(cb => (
                  <BetCard
                    key={cb.id}
                    bet={cb}
                    type="combined_bet"
                    calculation={cashOutCalculations[cb.id]}
                    isExpanded={expandedBets.has(cb.id)}
                    onToggle={() => toggleExpanded(cb.id)}
                    onCashOut={() => handleCombinedCashOut(cb)}
                    onPartialCashOut={(p, a) => handleCombinedPartialCashOut(cb, p, a)}
                    rules={getRulesForBet(cb.id)}
                    onCreateRule={async (ruleType, threshold) => { await createRule('combined_bet', cb.id, ruleType, threshold); }}
                    onDeleteRule={deleteRule}
                    onToggleRule={async (ruleId, isActive) => { await updateRule(ruleId, { is_active: isActive }); }}
                    currencyMode={mode}
                    isUpdating={calculatingCashOuts}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="single" className="space-y-4">
            {bets.length === 0 ? (
              <EmptyState type="single bets" />
            ) : (
              bets.map(bet => (
                <BetCard
                  key={bet.id}
                  bet={bet}
                  type="bet"
                  calculation={cashOutCalculations[bet.id]}
                  isExpanded={expandedBets.has(bet.id)}
                  onToggle={() => toggleExpanded(bet.id)}
                  onCashOut={() => handleCashOut(bet)}
                  onPartialCashOut={(p, a) => handlePartialCashOut(bet, p, a)}
                  rules={getRulesForBet(bet.id)}
                  onCreateRule={async (ruleType, threshold) => { await createRule('bet', bet.id, ruleType, threshold); }}
                  onDeleteRule={deleteRule}
                  onToggleRule={async (ruleId, isActive) => { await updateRule(ruleId, { is_active: isActive }); }}
                  currencyMode={mode}
                  isUpdating={calculatingCashOuts}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="parlay" className="space-y-4">
            {parlays.length === 0 ? (
              <EmptyState type="parlays" />
            ) : (
              parlays.map(parlay => (
                <BetCard
                  key={parlay.id}
                  bet={parlay}
                  type="parlay"
                  calculation={cashOutCalculations[parlay.id]}
                  isExpanded={expandedBets.has(parlay.id)}
                  onToggle={() => toggleExpanded(parlay.id)}
                  onCashOut={() => handleParlayCashOut(parlay)}
                  onPartialCashOut={(p, a) => handleParlayPartialCashOut(parlay, p, a)}
                  rules={getRulesForBet(parlay.id)}
                  onCreateRule={async (ruleType, threshold) => { await createRule('parlay', parlay.id, ruleType, threshold); }}
                  onDeleteRule={deleteRule}
                  onToggleRule={async (ruleId, isActive) => { await updateRule(ruleId, { is_active: isActive }); }}
                  currencyMode={mode}
                  isUpdating={calculatingCashOuts}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="combined" className="space-y-4">
            {combinedBets.length === 0 ? (
              <EmptyState type="combined bets" />
            ) : (
              combinedBets.map(cb => (
                <BetCard
                  key={cb.id}
                  bet={cb}
                  type="combined_bet"
                  calculation={cashOutCalculations[cb.id]}
                  isExpanded={expandedBets.has(cb.id)}
                  onToggle={() => toggleExpanded(cb.id)}
                  onCashOut={() => handleCombinedCashOut(cb)}
                  onPartialCashOut={(p, a) => handleCombinedPartialCashOut(cb, p, a)}
                  rules={getRulesForBet(cb.id)}
                  onCreateRule={async (ruleType, threshold) => { await createRule('combined_bet', cb.id, ruleType, threshold); }}
                  onDeleteRule={deleteRule}
                  onToggleRule={async (ruleId, isActive) => { await updateRule(ruleId, { is_active: isActive }); }}
                  currencyMode={mode}
                  isUpdating={calculatingCashOuts}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

// Empty state component
const EmptyState = ({ type }: { type: string }) => (
  <Card>
    <CardContent className="text-center py-8">
      <p className="text-muted-foreground">No active {type}</p>
    </CardContent>
  </Card>
);

// Individual bet card component
interface BetCardProps {
  bet: any;
  type: BetType;
  calculation?: CashOutCalculation;
  isExpanded: boolean;
  onToggle: () => void;
  onCashOut: () => void;
  onPartialCashOut: (percentage: number, amount: number) => Promise<void>;
  rules: AutoCashoutRule[];
  onCreateRule: (ruleType: RuleType, threshold: number) => Promise<void>;
  onDeleteRule: (ruleId: string) => Promise<boolean | void>;
  onToggleRule: (ruleId: string, isActive: boolean) => Promise<boolean | void>;
  currencyMode: 'virtual' | 'real';
  isUpdating: boolean;
}

const BetCard = ({
  bet,
  type,
  calculation,
  isExpanded,
  onToggle,
  onCashOut,
  onPartialCashOut,
  rules,
  onCreateRule,
  onDeleteRule,
  onToggleRule,
  currencyMode,
  isUpdating,
}: BetCardProps) => {
  const stake = 'total_stake' in bet ? bet.total_stake : bet.stake;
  const odds = 'combined_odds' in bet ? bet.combined_odds : bet.odds;
  const potentialWin = Math.floor(stake * Number(odds));
  
  const getTypeLabel = () => {
    if (type === 'bet') return '🎯 Single Bet';
    if (type === 'parlay') return `💰 ${bet.parlay_legs?.length || 0}-Leg Parlay`;
    return `⚡ ${bet.combined_bet_categories?.length || 0}-Category Combined`;
  };

  const getTypeColor = () => {
    if (type === 'bet') return 'border-blue-500/30 bg-blue-500/5';
    if (type === 'parlay') return 'border-primary/30 bg-primary/5';
    return 'border-accent/30 bg-accent/5';
  };

  return (
    <Card className={`${getTypeColor()} transition-all duration-200`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              {getTypeLabel()}
              {rules.some(r => r.is_active) && (
                <Badge variant="outline" className="text-xs bg-yellow-500/10 border-yellow-500/30 text-yellow-600">
                  <Zap className="h-3 w-3 mr-1" />
                  Auto
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              {type === 'bet' && (
                <>
                  <span>{bet.city}</span>
                  <span>•</span>
                  <span>{bet.prediction_type}: {bet.prediction_value}</span>
                </>
              )}
              {type === 'parlay' && (
                <span>{bet.parlay_legs?.map((l: any) => l.city).join(' → ')}</span>
              )}
              {type === 'combined_bet' && (
                <span>{bet.city} • {bet.combined_bet_categories?.length} categories</span>
              )}
            </CardDescription>
          </div>
          
          <div className="text-right">
            <div className="text-lg font-bold">{formatCurrency(stake, currencyMode)}</div>
            <div className="text-sm text-muted-foreground">
              @ {Number(odds).toFixed(2)}x → {formatCurrency(potentialWin, currencyMode)}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Cash-out value display */}
        {calculation ? (
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Current Cash-Out Value</span>
                <Badge variant={calculation.percentage >= 80 ? 'default' : 'secondary'} className="text-xs">
                  {calculation.percentage}%
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span>⏱️ Time: +{calculation.timeBonus}%</span>
                <span>🌤️ Weather: +{calculation.weatherBonus}%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 italic">{calculation.reasoning}</p>
            </div>
            <div className="text-right ml-4">
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(calculation.amount, currencyMode)}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <AutoCashoutBadge
                  betId={bet.id}
                  betType={type}
                  rules={rules}
                  currentPercentage={calculation.percentage}
                  currentWeatherBonus={calculation.weatherBonus}
                  currentTimeBonus={calculation.timeBonus}
                  currentAmount={calculation.amount}
                  onCreateRule={onCreateRule}
                  onDeleteRule={onDeleteRule}
                  onToggleRule={onToggleRule}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-muted/50 border text-center">
            <p className="text-sm text-muted-foreground">
              {isUpdating ? 'Calculating...' : 'Cash-out unavailable'}
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={onCashOut}
            disabled={!calculation || isUpdating}
          >
            <DollarSign className="h-4 w-4 mr-2" />
            Cash Out All
            {calculation && (
              <span className="ml-2 font-bold">{formatCurrency(calculation.amount, currencyMode)}</span>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={onToggle}
            disabled={!calculation}
          >
            <Settings2 className="h-4 w-4 mr-2" />
            {isExpanded ? 'Hide Options' : 'More Options'}
          </Button>
        </div>

        {/* Expanded section with partial cashout, history chart, and partial history */}
        {isExpanded && calculation && (
          <div className="space-y-4 pt-4 border-t animate-in slide-in-from-top-2">
            {/* Cash-Out Value History Chart */}
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Cash-Out Value History
              </h4>
              <CashOutHistoryChart
                stake={stake}
                odds={Number(odds)}
                city={type === 'bet' ? bet.city : type === 'combined_bet' ? bet.city : undefined}
                predictionType={type === 'bet' ? bet.prediction_type : undefined}
                predictionValue={type === 'bet' ? bet.prediction_value : undefined}
                createdAt={bet.created_at}
                expiresAt={bet.expires_at}
                isParlay={type === 'parlay'}
                parlayLegs={type === 'parlay' ? bet.parlay_legs : []}
                combinedOdds={type !== 'bet' ? Number(odds) : undefined}
                totalStake={type !== 'bet' ? stake : undefined}
              />
            </div>

            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Coins className="h-4 w-4" />
                Partial Cash-Out
              </h4>
              <PartialCashoutSlider
                totalCashoutAmount={calculation.amount}
                currentStake={stake}
                onPartialCashout={onPartialCashOut}
                onFullCashout={onCashOut}
                disabled={isUpdating}
              />
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Partial Cash-Out History
              </h4>
              <PartialCashoutHistory
                betId={bet.id}
                betType={type}
                currencyType={currencyMode}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CashoutManagement;
