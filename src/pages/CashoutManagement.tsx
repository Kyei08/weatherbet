import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
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
  Coins,
  Activity,
  Banknote,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BarChart3,
  Shield
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
import { useModeTheme } from '@/hooks/useModeTheme';
import { PartialCashoutSlider } from '@/components/betting/PartialCashoutSlider';
import { PartialCashoutHistory } from '@/components/betting/PartialCashoutHistory';
import { AutoCashoutBadge } from '@/components/betting/AutoCashoutBadge';
import { LiveCashoutValue } from '@/components/betting/LiveCashoutValue';
import CashOutHistoryChart from '@/components/betting/CashOutHistoryChart';
import PortfolioOverviewChart from '@/components/betting/PortfolioOverviewChart';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

const CashoutManagement = () => {
  const navigate = useNavigate();
  const { mode } = useCurrencyMode();
  const theme = useModeTheme();
  const { toast } = useToast();
  
  const [bets, setBets] = useState<Bet[]>([]);
  const [parlays, setParlays] = useState<ParlayWithLegs[]>([]);
  const [combinedBets, setCombinedBets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBets, setExpandedBets] = useState<Set<string>>(new Set());
  
  const { 
    rules: autoCashoutRules, 
    createRule, 
    deleteRule, 
    updateRule,
    checkRules, 
    getRulesForBet 
  } = useAutoCashout();
  
  const handleCalculationsUpdated = useCallback(
    (calculations: Record<string, CashOutCalculation>) => {
      checkRules(calculations);
    },
    [checkRules]
  );
  
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
    toast({ title: "Refreshed ✓", description: "Cash-out values updated" });
  };

  const toggleExpanded = (id: string) => {
    setExpandedBets(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
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

  const [isCashingOutAll, setIsCashingOutAll] = useState(false);
  
  const handleCashOutAll = async () => {
    if (totalActiveBets === 0) return;
    setIsCashingOutAll(true);
    let successCount = 0;
    let failCount = 0;
    let totalCashedOut = 0;
    
    try {
      for (const bet of bets) {
        const calc = cashOutCalculations[bet.id];
        if (calc) {
          try {
            await cashOutBet(bet.id, calc.amount, mode);
            successCount++;
            totalCashedOut += calc.amount;
          } catch { failCount++; }
        }
      }
      for (const parlay of parlays) {
        const calc = cashOutCalculations[parlay.id];
        if (calc) {
          try {
            await cashOutParlay(parlay.id, calc.amount, mode);
            successCount++;
            totalCashedOut += calc.amount;
          } catch { failCount++; }
        }
      }
      for (const cb of combinedBets) {
        const calc = cashOutCalculations[cb.id];
        if (calc) {
          try {
            await cashOutCombinedBet(cb.id, calc.amount, mode);
            successCount++;
            totalCashedOut += calc.amount;
          } catch { failCount++; }
        }
      }
      
      toast({
        title: failCount === 0 ? "All Bets Cashed Out! 🎉" : "Partial Success",
        description: `Cashed out ${successCount} bets for ${formatCurrency(totalCashedOut, mode)}${failCount ? `. ${failCount} failed.` : ''}`,
        variant: failCount > successCount ? "destructive" : "default",
      });
      fetchData();
    } catch {
      toast({ title: "Error", description: "Failed to complete bulk cash out", variant: "destructive" });
    } finally {
      setIsCashingOutAll(false);
    }
  };

  const [isCashingOutProfitable, setIsCashingOutProfitable] = useState(false);

  // Calculate totals
  const totalPotentialCashout = Object.values(cashOutCalculations).reduce((sum, calc) => sum + calc.amount, 0);
  const totalStake = [...bets, ...parlays, ...combinedBets].reduce((sum, bet) => {
    return sum + ('total_stake' in bet ? bet.total_stake : bet.stake);
  }, 0);
  const totalActiveBets = bets.length + parlays.length + combinedBets.length;
  const activeRulesCount = autoCashoutRules.filter(r => r.is_active).length;

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
          try { await cashOutBet(bet.id, calc.amount, mode); successCount++; totalCashedOut += calc.amount; } catch { failCount++; }
        }
      }
      for (const parlay of profitableParlays) {
        const calc = cashOutCalculations[parlay.id];
        if (calc) {
          try { await cashOutParlay(parlay.id, calc.amount, mode); successCount++; totalCashedOut += calc.amount; } catch { failCount++; }
        }
      }
      for (const cb of profitableCombinedBets) {
        const calc = cashOutCalculations[cb.id];
        if (calc) {
          try { await cashOutCombinedBet(cb.id, calc.amount, mode); successCount++; totalCashedOut += calc.amount; } catch { failCount++; }
        }
      }
      toast({
        title: failCount === 0 ? "Profitable Bets Cashed Out! 💰" : "Partial Success",
        description: `Cashed out ${successCount} bets for ${formatCurrency(totalCashedOut, mode)}${failCount ? `. ${failCount} failed.` : ''}`,
        variant: failCount > successCount ? "destructive" : "default",
      });
      fetchData();
    } catch {
      toast({ title: "Error", description: "Failed to complete profitable cash out", variant: "destructive" });
    } finally {
      setIsCashingOutProfitable(false);
    }
  };

  const pnlPercent = totalStake > 0 ? ((totalPotentialCashout - totalStake) / totalStake) * 100 : 0;
  const isProfitable = totalPotentialCashout >= totalStake;

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-16 w-full rounded-xl" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" />
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.gradient} p-4`}>
      <motion.div 
        className="max-w-6xl mx-auto space-y-6"
        initial="initial" animate="animate" variants={stagger}
      >
        {/* Header */}
        <motion.div variants={fadeUp} transition={{ duration: 0.4 }}>
          <Card className={`${theme.card} border-2 ${theme.glowShadow} overflow-hidden`}>
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5 pointer-events-none" />
            <CardHeader className="relative">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div>
                    <CardTitle className={`text-2xl flex items-center gap-2 ${theme.primaryText}`}>
                      <Sparkles className="h-6 w-6" />
                      Cash-Out Management
                    </CardTitle>
                    <CardDescription>
                      Manage all your active bets and cash-out options
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {totalProfitableBets > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <motion.div whileTap={{ scale: 0.95 }}>
                          <Button 
                            variant="outline" 
                            disabled={isCashingOutProfitable || calculatingCashOuts}
                            className="border-green-500/50 text-green-600 hover:bg-green-500/10"
                          >
                            {isCashingOutProfitable ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <TrendingUp className="h-4 w-4 mr-2" />}
                            Profitable Only ({totalProfitableBets})
                          </Button>
                        </motion.div>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-green-500" />
                            Cash Out Profitable Bets?
                          </AlertDialogTitle>
                          <AlertDialogDescription className="space-y-3">
                            <p>Cash out <strong>{totalProfitableBets} profitable bets</strong> for:</p>
                            <p className="text-2xl font-bold text-green-600">{formatCurrency(profitableCashoutTotal, mode)}</p>
                            <p className="text-sm text-green-600">
                              Stake: {formatCurrency(profitableStakeTotal, mode)} • Profit: +{formatCurrency(profitAmount, mode)}
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
                        <motion.div whileTap={{ scale: 0.95 }}>
                          <Button variant="default" disabled={isCashingOutAll || calculatingCashOuts}>
                            {isCashingOutAll ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Banknote className="h-4 w-4 mr-2" />}
                            Cash Out All
                          </Button>
                        </motion.div>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-yellow-500" />
                            Cash Out All Bets?
                          </AlertDialogTitle>
                          <AlertDialogDescription className="space-y-3">
                            <p>Cash out <strong>{totalActiveBets} active bets</strong> for:</p>
                            <p className="text-2xl font-bold text-primary">{formatCurrency(totalPotentialCashout, mode)}</p>
                            <p className="text-sm">
                              Stake: {formatCurrency(totalStake, mode)} • 
                              {isProfitable ? ` Profit: +${formatCurrency(totalPotentialCashout - totalStake, mode)}` : ` Loss: -${formatCurrency(totalStake - totalPotentialCashout, mode)}`}
                            </p>
                            <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleCashOutAll}>Confirm Cash Out All</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <motion.div whileTap={{ scale: 0.95 }}>
                    <Button variant="outline" onClick={refreshData} disabled={calculatingCashOuts} className={`${theme.borderColor}`}>
                      <RefreshCw className={`h-4 w-4 mr-2 ${calculatingCashOuts ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </motion.div>
                </div>
              </div>
            </CardHeader>
          </Card>
        </motion.div>

        {/* Summary Cards */}
        <motion.div variants={fadeUp} transition={{ duration: 0.4 }} className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: 'Active Bets',
              value: totalActiveBets.toString(),
              sub: `${bets.length} single • ${parlays.length} parlay • ${combinedBets.length} combo`,
              icon: <Activity className="h-5 w-5" />,
              color: theme.primaryText,
            },
            {
              label: 'Total Stake',
              value: formatCurrency(totalStake, mode),
              sub: 'At risk',
              icon: <Coins className="h-5 w-5" />,
              color: 'text-muted-foreground',
            },
            {
              label: 'Cash-Out Value',
              value: formatCurrency(totalPotentialCashout, mode),
              sub: `${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(1)}% P&L`,
              icon: <DollarSign className="h-5 w-5" />,
              color: isProfitable ? 'text-green-500' : 'text-red-500',
              highlight: true,
            },
            {
              label: 'Auto Rules',
              value: activeRulesCount.toString(),
              sub: 'Active triggers',
              icon: <Zap className="h-5 w-5 text-yellow-500" />,
              color: 'text-yellow-500',
            },
          ].map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 + 0.2 }}
            >
              <Card className={`${card.highlight ? `${theme.card} border-2 ${theme.borderColor}` : `${theme.card} border`} overflow-hidden relative`}>
                {card.highlight && <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />}
                <CardContent className="pt-5 pb-4 relative">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.label}</p>
                    <div className={`${card.color} opacity-60`}>{card.icon}</div>
                  </div>
                  <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Portfolio Overview Chart */}
        <motion.div variants={fadeUp} transition={{ duration: 0.4 }}>
          <PortfolioOverviewChart
            bets={bets}
            parlays={parlays}
            combinedBets={combinedBets}
            currencyMode={mode}
          />
        </motion.div>

        {/* Main Content */}
        <motion.div variants={fadeUp} transition={{ duration: 0.4 }}>
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All ({totalActiveBets})</TabsTrigger>
              <TabsTrigger value="single">Single ({bets.length})</TabsTrigger>
              <TabsTrigger value="parlay">Parlay ({parlays.length})</TabsTrigger>
              <TabsTrigger value="combined">Combined ({combinedBets.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              {totalActiveBets === 0 ? (
                <EmptyState type="active bets" onAction={() => navigate('/')} theme={theme} />
              ) : (
                <motion.div className="space-y-4" variants={stagger} initial="initial" animate="animate">
                  {bets.map((bet, i) => (
                    <motion.div key={bet.id} variants={fadeUp} transition={{ delay: i * 0.05 }}>
                      <BetCard bet={bet} type="bet" calculation={cashOutCalculations[bet.id]} isExpanded={expandedBets.has(bet.id)} onToggle={() => toggleExpanded(bet.id)} onCashOut={() => handleCashOut(bet)} onPartialCashOut={(p, a) => handlePartialCashOut(bet, p, a)} rules={getRulesForBet(bet.id)} onCreateRule={async (rt, t) => { await createRule('bet', bet.id, rt, t); }} onDeleteRule={deleteRule} onToggleRule={async (id, a) => { await updateRule(id, { is_active: a }); }} currencyMode={mode} isUpdating={calculatingCashOuts} theme={theme} />
                    </motion.div>
                  ))}
                  {parlays.map((parlay, i) => (
                    <motion.div key={parlay.id} variants={fadeUp} transition={{ delay: (bets.length + i) * 0.05 }}>
                      <BetCard bet={parlay} type="parlay" calculation={cashOutCalculations[parlay.id]} isExpanded={expandedBets.has(parlay.id)} onToggle={() => toggleExpanded(parlay.id)} onCashOut={() => handleParlayCashOut(parlay)} onPartialCashOut={(p, a) => handleParlayPartialCashOut(parlay, p, a)} rules={getRulesForBet(parlay.id)} onCreateRule={async (rt, t) => { await createRule('parlay', parlay.id, rt, t); }} onDeleteRule={deleteRule} onToggleRule={async (id, a) => { await updateRule(id, { is_active: a }); }} currencyMode={mode} isUpdating={calculatingCashOuts} theme={theme} />
                    </motion.div>
                  ))}
                  {combinedBets.map((cb, i) => (
                    <motion.div key={cb.id} variants={fadeUp} transition={{ delay: (bets.length + parlays.length + i) * 0.05 }}>
                      <BetCard bet={cb} type="combined_bet" calculation={cashOutCalculations[cb.id]} isExpanded={expandedBets.has(cb.id)} onToggle={() => toggleExpanded(cb.id)} onCashOut={() => handleCombinedCashOut(cb)} onPartialCashOut={(p, a) => handleCombinedPartialCashOut(cb, p, a)} rules={getRulesForBet(cb.id)} onCreateRule={async (rt, t) => { await createRule('combined_bet', cb.id, rt, t); }} onDeleteRule={deleteRule} onToggleRule={async (id, a) => { await updateRule(id, { is_active: a }); }} currencyMode={mode} isUpdating={calculatingCashOuts} theme={theme} />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </TabsContent>

            {(['single', 'parlay', 'combined'] as const).map(tab => {
              const items = tab === 'single' ? bets : tab === 'parlay' ? parlays : combinedBets;
              const betType: BetType = tab === 'single' ? 'bet' : tab === 'parlay' ? 'parlay' : 'combined_bet';
              const handleCO = tab === 'single' ? handleCashOut : tab === 'parlay' ? handleParlayCashOut : handleCombinedCashOut;
              const handlePCO = tab === 'single' ? handlePartialCashOut : tab === 'parlay' ? handleParlayPartialCashOut : handleCombinedPartialCashOut;

              return (
                <TabsContent key={tab} value={tab} className="space-y-4">
                  {items.length === 0 ? (
                    <EmptyState type={`${tab} bets`} theme={theme} />
                  ) : (
                    <motion.div className="space-y-4" variants={stagger} initial="initial" animate="animate">
                      {items.map((item: any, i: number) => (
                        <motion.div key={item.id} variants={fadeUp} transition={{ delay: i * 0.05 }}>
                          <BetCard bet={item} type={betType} calculation={cashOutCalculations[item.id]} isExpanded={expandedBets.has(item.id)} onToggle={() => toggleExpanded(item.id)} onCashOut={() => handleCO(item)} onPartialCashOut={(p, a) => handlePCO(item, p, a)} rules={getRulesForBet(item.id)} onCreateRule={async (rt, t) => { await createRule(betType, item.id, rt, t); }} onDeleteRule={deleteRule} onToggleRule={async (id, a) => { await updateRule(id, { is_active: a }); }} currencyMode={mode} isUpdating={calculatingCashOuts} theme={theme} />
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </motion.div>
      </motion.div>
    </div>
  );
};

// Empty state
const EmptyState = ({ type, onAction, theme }: { type: string; onAction?: () => void; theme: any }) => (
  <Card className={`${theme.card} border-2`}>
    <CardContent className="text-center py-16">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 15 }}>
        <div className={`w-16 h-16 rounded-2xl ${theme.gradient} flex items-center justify-center mx-auto mb-4`}>
          <Activity className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-lg font-medium mb-1">No {type}</p>
        <p className="text-sm text-muted-foreground mb-4">Place some bets to manage them here</p>
        {onAction && (
          <Button onClick={onAction} className={theme.buttonPrimary}>
            Place a Bet
          </Button>
        )}
      </motion.div>
    </CardContent>
  </Card>
);

// BetCard
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
  theme: any;
}

const BetCard = ({
  bet, type, calculation, isExpanded, onToggle, onCashOut, onPartialCashOut,
  rules, onCreateRule, onDeleteRule, onToggleRule, currencyMode, isUpdating, theme,
}: BetCardProps) => {
  const stake = 'total_stake' in bet ? bet.total_stake : bet.stake;
  const odds = 'combined_odds' in bet ? bet.combined_odds : bet.odds;
  const potentialWin = Math.floor(stake * Number(odds));
  const isProfit = calculation && calculation.amount > stake;
  
  const typeConfig = {
    bet: { label: '🎯 Single', color: 'border-blue-500/30', bg: 'bg-blue-500/5', accent: 'text-blue-500' },
    parlay: { label: `💰 ${bet.parlay_legs?.length || 0}-Leg Parlay`, color: 'border-purple-500/30', bg: 'bg-purple-500/5', accent: 'text-purple-500' },
    combined_bet: { label: `⚡ ${bet.combined_bet_categories?.length || 0}-Cat Combined`, color: 'border-amber-500/30', bg: 'bg-amber-500/5', accent: 'text-amber-500' },
  }[type];

  return (
    <Card className={`${typeConfig.color} ${typeConfig.bg} transition-all duration-300 hover:shadow-lg overflow-hidden`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base">{typeConfig.label}</CardTitle>
              {rules.some(r => r.is_active) && (
                <Badge variant="outline" className="text-xs bg-yellow-500/10 border-yellow-500/30 text-yellow-600">
                  <Zap className="h-3 w-3 mr-1" /> Auto
                </Badge>
              )}
              {isProfit && (
                <Badge className="text-xs bg-green-500/10 text-green-600 border-green-500/30" variant="outline">
                  <TrendingUp className="h-3 w-3 mr-1" /> Profit
                </Badge>
              )}
            </div>
            <CardDescription className="flex items-center gap-1.5 text-xs">
              {type === 'bet' && <><span className="font-medium">{bet.city}</span> <span>•</span> <span>{bet.prediction_type}: {bet.prediction_value}</span></>}
              {type === 'parlay' && <span className="truncate">{bet.parlay_legs?.map((l: any) => l.city).join(' → ')}</span>}
              {type === 'combined_bet' && <><span className="font-medium">{bet.city}</span> <span>•</span> <span>{bet.combined_bet_categories?.length} categories</span></>}
            </CardDescription>
          </div>
          
          <div className="text-right shrink-0">
            <div className="text-lg font-bold">{formatCurrency(stake, currencyMode)}</div>
            <div className="text-xs text-muted-foreground">
              @ {Number(odds).toFixed(2)}x → {formatCurrency(potentialWin, currencyMode)}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4 pt-0">
        {/* Cash-out value */}
        {calculation ? (
          <div className={`p-4 rounded-xl border ${isProfit ? 'border-green-500/20 bg-green-500/5' : 'border-muted bg-muted/30'}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">Cash-Out Value</span>
                  <Badge variant={calculation.percentage >= 80 ? 'default' : 'secondary'} className="text-xs">
                    {calculation.percentage}%
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>⏱️ {calculation.timeBonus}%</span>
                  <span>🌤️ {calculation.weatherBonus}%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 italic truncate">{calculation.reasoning}</p>
              </div>
              <div className="text-right">
                <motion.div
                  key={calculation.amount}
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  className={`text-2xl font-bold ${isProfit ? 'text-green-500' : theme.primaryText}`}
                >
                  {formatCurrency(calculation.amount, currencyMode)}
                </motion.div>
                <div className="flex items-center gap-2 mt-2">
                  <AutoCashoutBadge
                    betId={bet.id} betType={type} rules={rules}
                    currentPercentage={calculation.percentage} currentWeatherBonus={calculation.weatherBonus}
                    currentTimeBonus={calculation.timeBonus} currentAmount={calculation.amount}
                    onCreateRule={onCreateRule} onDeleteRule={onDeleteRule} onToggleRule={onToggleRule}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-muted/30 border border-muted text-center">
            <p className="text-sm text-muted-foreground">
              {isUpdating ? (
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw className="h-3 w-3 animate-spin" /> Calculating...
                </span>
              ) : 'Cash-out unavailable'}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <motion.div className="flex-1" whileTap={{ scale: 0.97 }}>
            <Button className="w-full" onClick={onCashOut} disabled={!calculation || isUpdating}>
              <DollarSign className="h-4 w-4 mr-2" />
              Cash Out
              {calculation && <span className="ml-2 font-bold">{formatCurrency(calculation.amount, currencyMode)}</span>}
            </Button>
          </motion.div>
          <motion.div whileTap={{ scale: 0.95 }}>
            <Button variant="outline" onClick={onToggle} disabled={!calculation} className={theme.borderColor}>
              {isExpanded ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
              {isExpanded ? 'Less' : 'More'}
            </Button>
          </motion.div>
        </div>

        {/* Expanded */}
        <AnimatePresence>
          {isExpanded && calculation && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="space-y-5 pt-4 border-t border-muted">
                <div>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" /> Value History
                  </h4>
                  <CashOutHistoryChart
                    stake={stake} odds={Number(odds)}
                    city={type === 'bet' ? bet.city : type === 'combined_bet' ? bet.city : undefined}
                    predictionType={type === 'bet' ? bet.prediction_type : undefined}
                    predictionValue={type === 'bet' ? bet.prediction_value : undefined}
                    createdAt={bet.created_at} expiresAt={bet.expires_at}
                    isParlay={type === 'parlay'} parlayLegs={type === 'parlay' ? bet.parlay_legs : []}
                    combinedOdds={type !== 'bet' ? Number(odds) : undefined}
                    totalStake={type !== 'bet' ? stake : undefined}
                  />
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Coins className="h-4 w-4" /> Partial Cash-Out
                  </h4>
                  <PartialCashoutSlider
                    totalCashoutAmount={calculation.amount} currentStake={stake}
                    onPartialCashout={onPartialCashOut} onFullCashout={onCashOut} disabled={isUpdating}
                  />
                </div>
                
                <div>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Partial History
                  </h4>
                  <PartialCashoutHistory betId={bet.id} betType={type} currencyType={currencyMode} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};

export default CashoutManagement;
