import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cashOutBet } from '@/lib/supabase-auth-storage';
import { cashOutParlay } from '@/lib/supabase-parlays';
import { cashOutCombinedBet } from '@/lib/supabase-combined-bets';
import { useCurrencyMode } from '@/contexts/CurrencyModeContext';
import { sendAutoCashoutNotification } from '@/lib/push-notification-client';
export type RuleType = 
  | 'percentage_above' 
  | 'percentage_below' 
  | 'weather_bonus_above' 
  | 'weather_bonus_below' 
  | 'time_bonus_above' 
  | 'amount_above';

export type BetType = 'bet' | 'parlay' | 'combined_bet';

export interface AutoCashoutRule {
  id: string;
  user_id: string;
  bet_type: BetType;
  bet_id: string;
  rule_type: RuleType;
  threshold_value: number;
  is_active: boolean;
  triggered_at: string | null;
  cashout_amount: number | null;
  created_at: string;
  updated_at: string;
}

interface CashoutCalculation {
  amount: number;
  percentage: number;
  timeBonus: number;
  weatherBonus: number;
}

export const RULE_TYPE_LABELS: Record<RuleType, string> = {
  percentage_above: 'Cash-out % exceeds',
  percentage_below: 'Cash-out % drops below',
  weather_bonus_above: 'Weather bonus exceeds',
  weather_bonus_below: 'Weather bonus drops below',
  time_bonus_above: 'Time bonus exceeds',
  amount_above: 'Cash-out amount exceeds',
};

export const useAutoCashout = () => {
  const [rules, setRules] = useState<AutoCashoutRule[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { mode } = useCurrencyMode();

  // Fetch user's auto-cashout rules
  const fetchRules = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('auto_cashout_rules')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRules((data || []) as AutoCashoutRule[]);
    } catch (error) {
      console.error('Error fetching auto-cashout rules:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  // Create a new rule
  const createRule = async (
    betType: BetType,
    betId: string,
    ruleType: RuleType,
    thresholdValue: number
  ): Promise<AutoCashoutRule | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('auto_cashout_rules')
        .insert({
          user_id: user.id,
          bet_type: betType,
          bet_id: betId,
          rule_type: ruleType,
          threshold_value: thresholdValue,
        })
        .select()
        .single();

      if (error) throw error;

      const newRule = data as AutoCashoutRule;
      setRules(prev => [newRule, ...prev]);

      toast({
        title: 'Auto-cashout rule created',
        description: `Will trigger when ${RULE_TYPE_LABELS[ruleType]} ${thresholdValue}${ruleType.includes('percentage') || ruleType.includes('bonus') ? '%' : ''}`,
      });

      return newRule;
    } catch (error) {
      console.error('Error creating auto-cashout rule:', error);
      toast({
        title: 'Error',
        description: 'Failed to create auto-cashout rule',
        variant: 'destructive',
      });
      return null;
    }
  };

  // Update a rule
  const updateRule = async (
    ruleId: string,
    updates: Partial<Pick<AutoCashoutRule, 'threshold_value' | 'is_active'>>
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('auto_cashout_rules')
        .update(updates)
        .eq('id', ruleId);

      if (error) throw error;

      setRules(prev =>
        prev.map(rule =>
          rule.id === ruleId ? { ...rule, ...updates } : rule
        )
      );

      toast({
        title: 'Rule updated',
        description: 'Auto-cashout rule has been updated',
      });

      return true;
    } catch (error) {
      console.error('Error updating auto-cashout rule:', error);
      toast({
        title: 'Error',
        description: 'Failed to update rule',
        variant: 'destructive',
      });
      return false;
    }
  };

  // Delete a rule
  const deleteRule = async (ruleId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('auto_cashout_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;

      setRules(prev => prev.filter(rule => rule.id !== ruleId));

      toast({
        title: 'Rule deleted',
        description: 'Auto-cashout rule has been removed',
      });

      return true;
    } catch (error) {
      console.error('Error deleting auto-cashout rule:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete rule',
        variant: 'destructive',
      });
      return false;
    }
  };

  // Check if a rule should trigger based on current cashout calculation
  const shouldTrigger = (
    rule: AutoCashoutRule,
    calculation: CashoutCalculation
  ): boolean => {
    if (!rule.is_active || rule.triggered_at) return false;

    switch (rule.rule_type) {
      case 'percentage_above':
        return calculation.percentage >= rule.threshold_value;
      case 'percentage_below':
        return calculation.percentage <= rule.threshold_value;
      case 'weather_bonus_above':
        return calculation.weatherBonus >= rule.threshold_value;
      case 'weather_bonus_below':
        return calculation.weatherBonus <= rule.threshold_value;
      case 'time_bonus_above':
        return calculation.timeBonus >= rule.threshold_value;
      case 'amount_above':
        return calculation.amount >= rule.threshold_value;
      default:
        return false;
    }
  };

  // Execute auto-cashout for a triggered rule
  const executeAutoCashout = async (
    rule: AutoCashoutRule,
    cashoutAmount: number
  ): Promise<boolean> => {
    try {
      // Get current user for push notification
      const { data: { user } } = await supabase.auth.getUser();
      
      // Execute cashout based on bet type
      switch (rule.bet_type) {
        case 'bet':
          await cashOutBet(rule.bet_id, cashoutAmount, mode);
          break;
        case 'parlay':
          await cashOutParlay(rule.bet_id, cashoutAmount, mode);
          break;
        case 'combined_bet':
          await cashOutCombinedBet(rule.bet_id, cashoutAmount, mode);
          break;
      }

      // Mark rule as triggered
      await supabase
        .from('auto_cashout_rules')
        .update({
          triggered_at: new Date().toISOString(),
          cashout_amount: cashoutAmount,
          is_active: false,
        })
        .eq('id', rule.id);

      setRules(prev =>
        prev.map(r =>
          r.id === rule.id
            ? {
                ...r,
                triggered_at: new Date().toISOString(),
                cashout_amount: cashoutAmount,
                is_active: false,
              }
            : r
        )
      );

      // Send push notification (async, don't wait)
      if (user) {
        sendAutoCashoutNotification({
          userId: user.id,
          betId: rule.bet_id,
          betType: rule.bet_type,
          ruleType: rule.rule_type,
          thresholdValue: rule.threshold_value,
          cashoutAmount,
        }).catch(err => console.warn('Push notification failed:', err));
      }

      toast({
        title: '🤖 Auto-cashout triggered!',
        description: `Rule "${RULE_TYPE_LABELS[rule.rule_type]} ${rule.threshold_value}" executed. Cashed out for ${cashoutAmount}!`,
      });

      return true;
    } catch (error) {
      console.error('Error executing auto-cashout:', error);
      toast({
        title: 'Auto-cashout failed',
        description: 'Failed to execute auto-cashout rule',
        variant: 'destructive',
      });
      return false;
    }
  };

  // Check all active rules against current calculations
  const checkRules = useCallback(
    async (calculations: Record<string, CashoutCalculation>) => {
      const activeRules = rules.filter(r => r.is_active && !r.triggered_at);

      for (const rule of activeRules) {
        const calculation = calculations[rule.bet_id];
        if (!calculation) continue;

        if (shouldTrigger(rule, calculation)) {
          await executeAutoCashout(rule, calculation.amount);
        }
      }
    },
    [rules, mode]
  );

  // Get rules for a specific bet
  const getRulesForBet = useCallback(
    (betId: string): AutoCashoutRule[] => {
      return rules.filter(r => r.bet_id === betId);
    },
    [rules]
  );

  // Get active rules count
  const activeRulesCount = rules.filter(r => r.is_active && !r.triggered_at).length;

  return {
    rules,
    loading,
    activeRulesCount,
    createRule,
    updateRule,
    deleteRule,
    checkRules,
    getRulesForBet,
    fetchRules,
  };
};
