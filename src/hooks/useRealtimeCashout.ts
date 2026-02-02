import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateDynamicCashOut, calculateDynamicParlayCashOut } from '@/lib/dynamic-cashout';
import { Bet } from '@/types/supabase-betting';
import { ParlayWithLegs } from '@/lib/supabase-parlays';

export interface CashOutCalculation {
  amount: number;
  percentage: number;
  timeBonus: number;
  weatherBonus: number;
  reasoning: string;
  lastUpdated: number;
  trend: 'up' | 'down' | 'stable';
  previousAmount?: number;
}

interface RealtimeCashoutState {
  calculations: Record<string, CashOutCalculation>;
  isUpdating: boolean;
  lastGlobalUpdate: number | null;
}

interface UseRealtimeCashoutOptions {
  pollingInterval?: number; // in milliseconds, default 30 seconds
  enabled?: boolean;
  onCalculationsUpdated?: (calculations: Record<string, CashOutCalculation>) => void;
}

export const useRealtimeCashout = (
  bets: Bet[],
  parlays: ParlayWithLegs[],
  combinedBets: any[],
  options: UseRealtimeCashoutOptions = {}
) => {
  const { pollingInterval = 30000, enabled = true, onCalculationsUpdated } = options;
  
  const [state, setState] = useState<RealtimeCashoutState>({
    calculations: {},
    isUpdating: false,
    lastGlobalUpdate: null,
  });
  
  const previousCalculations = useRef<Record<string, number>>({});
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Calculate trend based on previous value
  const calculateTrend = (
    betId: string,
    newAmount: number
  ): 'up' | 'down' | 'stable' => {
    const prevAmount = previousCalculations.current[betId];
    if (prevAmount === undefined) return 'stable';
    if (newAmount > prevAmount) return 'up';
    if (newAmount < prevAmount) return 'down';
    return 'stable';
  };

  // Calculate cashout for a single bet
  const calculateSingleBetCashout = useCallback(async (bet: Bet): Promise<CashOutCalculation | null> => {
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
      
      const trend = calculateTrend(bet.id, calc.amount);
      const previousAmount = previousCalculations.current[bet.id];
      previousCalculations.current[bet.id] = calc.amount;
      
      return {
        ...calc,
        lastUpdated: Date.now(),
        trend,
        previousAmount,
      };
    } catch (error) {
      console.error(`Error calculating cashout for bet ${bet.id}:`, error);
      return null;
    }
  }, []);

  // Calculate cashout for a parlay
  const calculateParlayCashout = useCallback(async (parlay: ParlayWithLegs): Promise<CashOutCalculation | null> => {
    try {
      const calc = await calculateDynamicParlayCashOut(
        parlay.total_stake,
        Number(parlay.combined_odds),
        parlay.parlay_legs,
        parlay.created_at,
        parlay.expires_at
      );
      
      const trend = calculateTrend(parlay.id, calc.amount);
      const previousAmount = previousCalculations.current[parlay.id];
      previousCalculations.current[parlay.id] = calc.amount;
      
      return {
        ...calc,
        lastUpdated: Date.now(),
        trend,
        previousAmount,
      };
    } catch (error) {
      console.error(`Error calculating cashout for parlay ${parlay.id}:`, error);
      return null;
    }
  }, []);

  // Calculate cashout for a combined bet
  const calculateCombinedBetCashout = useCallback(async (combinedBet: any): Promise<CashOutCalculation | null> => {
    try {
      const calc = await calculateDynamicParlayCashOut(
        combinedBet.total_stake,
        Number(combinedBet.combined_odds),
        combinedBet.combined_bet_categories?.map((cat: any) => ({
          city: combinedBet.city,
          prediction_type: cat.prediction_type,
          prediction_value: cat.prediction_value,
        })) || [],
        combinedBet.created_at,
        combinedBet.expires_at
      );
      
      const trend = calculateTrend(combinedBet.id, calc.amount);
      const previousAmount = previousCalculations.current[combinedBet.id];
      previousCalculations.current[combinedBet.id] = calc.amount;
      
      return {
        ...calc,
        lastUpdated: Date.now(),
        trend,
        previousAmount,
      };
    } catch (error) {
      console.error(`Error calculating cashout for combined bet ${combinedBet.id}:`, error);
      return null;
    }
  }, []);

  // Update all cashouts
  const updateAllCashouts = useCallback(async () => {
    if (!enabled) return;
    
    setState(prev => ({ ...prev, isUpdating: true }));
    
    const newCalculations: Record<string, CashOutCalculation> = {};
    
    // Calculate for pending single bets
    const pendingBets = bets.filter(bet => bet.result === 'pending');
    const betPromises = pendingBets.map(async (bet) => {
      const calc = await calculateSingleBetCashout(bet);
      if (calc) newCalculations[bet.id] = calc;
    });
    
    // Calculate for pending parlays
    const pendingParlays = parlays.filter(p => p.result === 'pending');
    const parlayPromises = pendingParlays.map(async (parlay) => {
      const calc = await calculateParlayCashout(parlay);
      if (calc) newCalculations[parlay.id] = calc;
    });
    
    // Calculate for pending combined bets
    const pendingCombinedBets = combinedBets.filter(cb => cb.result === 'pending');
    const combinedBetPromises = pendingCombinedBets.map(async (combinedBet) => {
      const calc = await calculateCombinedBetCashout(combinedBet);
      if (calc) newCalculations[combinedBet.id] = calc;
    });
    
    await Promise.all([...betPromises, ...parlayPromises, ...combinedBetPromises]);
    
    setState({
      calculations: newCalculations,
      isUpdating: false,
      lastGlobalUpdate: Date.now(),
    });
    
    // Notify callback for auto-cashout checking
    if (onCalculationsUpdated) {
      onCalculationsUpdated(newCalculations);
    }
    
    // Broadcast update via Supabase Realtime
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'cashout_update',
        payload: {
          timestamp: Date.now(),
          updatedIds: Object.keys(newCalculations),
        },
      });
    }
  }, [bets, parlays, combinedBets, enabled, calculateSingleBetCashout, calculateParlayCashout, calculateCombinedBetCashout, onCalculationsUpdated]);

  // Update a single bet's cashout value
  const updateSingleCashout = useCallback(async (betId: string) => {
    const bet = bets.find(b => b.id === betId);
    const parlay = parlays.find(p => p.id === betId);
    const combinedBet = combinedBets.find(cb => cb.id === betId);
    
    let calc: CashOutCalculation | null = null;
    
    if (bet && bet.result === 'pending') {
      calc = await calculateSingleBetCashout(bet);
    } else if (parlay && parlay.result === 'pending') {
      calc = await calculateParlayCashout(parlay);
    } else if (combinedBet && combinedBet.result === 'pending') {
      calc = await calculateCombinedBetCashout(combinedBet);
    }
    
    if (calc) {
      setState(prev => ({
        ...prev,
        calculations: {
          ...prev.calculations,
          [betId]: calc,
        },
      }));
    }
  }, [bets, parlays, combinedBets, calculateSingleBetCashout, calculateParlayCashout, calculateCombinedBetCashout]);

  // Set up realtime channel and polling
  useEffect(() => {
    if (!enabled) return;
    
    // Create realtime channel for cashout updates
    channelRef.current = supabase
      .channel('realtime-cashout')
      .on('broadcast', { event: 'weather_update' }, () => {
        // When weather changes, recalculate all cashouts
        updateAllCashouts();
      })
      .subscribe();
    
    // Initial calculation
    updateAllCashouts();
    
    // Set up polling interval
    updateIntervalRef.current = setInterval(() => {
      updateAllCashouts();
    }, pollingInterval);
    
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [enabled, pollingInterval, updateAllCashouts]);

  // Recalculate when bets change
  useEffect(() => {
    if (enabled && (bets.length > 0 || parlays.length > 0 || combinedBets.length > 0)) {
      updateAllCashouts();
    }
  }, [bets.length, parlays.length, combinedBets.length]);

  return {
    calculations: state.calculations,
    isUpdating: state.isUpdating,
    lastGlobalUpdate: state.lastGlobalUpdate,
    updateAllCashouts,
    updateSingleCashout,
  };
};
