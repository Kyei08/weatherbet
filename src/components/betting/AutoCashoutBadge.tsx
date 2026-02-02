import { useState } from 'react';
import { Bot, Zap, X, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { AutoCashoutRule, RULE_TYPE_LABELS, RuleType, BetType } from '@/hooks/useAutoCashout';
import { AutoCashoutRuleForm } from './AutoCashoutRuleForm';

interface AutoCashoutBadgeProps {
  betId: string;
  betType: BetType;
  rules: AutoCashoutRule[];
  currentPercentage?: number;
  currentWeatherBonus?: number;
  currentTimeBonus?: number;
  currentAmount?: number;
  onCreateRule: (ruleType: RuleType, thresholdValue: number) => Promise<void>;
  onDeleteRule: (ruleId: string) => Promise<boolean | void>;
  onToggleRule: (ruleId: string, isActive: boolean) => Promise<boolean | void>;
}

export const AutoCashoutBadge = ({
  betId,
  betType,
  rules,
  currentPercentage,
  currentWeatherBonus,
  currentTimeBonus,
  currentAmount,
  onCreateRule,
  onDeleteRule,
  onToggleRule,
}: AutoCashoutBadgeProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const activeRules = rules.filter(r => r.is_active && !r.triggered_at);
  const triggeredRules = rules.filter(r => r.triggered_at);
  const hasActiveRules = activeRules.length > 0;

  const handleCreateRule = async (ruleType: RuleType, thresholdValue: number) => {
    await onCreateRule(ruleType, thresholdValue);
    setShowForm(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={hasActiveRules ? "default" : "outline"}
          size="sm"
          className={cn(
            "gap-1.5 h-7 text-xs",
            hasActiveRules && "bg-gradient-to-r from-primary to-primary/80"
          )}
        >
          <Bot className={cn("h-3.5 w-3.5", hasActiveRules && "animate-pulse")} />
          {hasActiveRules ? (
            <span>{activeRules.length} Auto</span>
          ) : (
            <span>Auto</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Auto-Cashout Rules
            </h4>
            {!showForm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowForm(true)}
                className="h-7 text-xs"
              >
                <Zap className="h-3 w-3 mr-1" />
                Add Rule
              </Button>
            )}
          </div>

          {showForm && (
            <AutoCashoutRuleForm
              betId={betId}
              betType={betType}
              currentPercentage={currentPercentage}
              currentWeatherBonus={currentWeatherBonus}
              currentTimeBonus={currentTimeBonus}
              currentAmount={currentAmount}
              onSubmit={handleCreateRule}
              onCancel={() => setShowForm(false)}
              compact
            />
          )}

          {/* Active Rules */}
          {activeRules.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Active Rules</p>
              {activeRules.map(rule => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/50 border border-border"
                >
                  <div className="flex items-center gap-2">
                    <div className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </div>
                    <span className="text-xs">
                      {RULE_TYPE_LABELS[rule.rule_type as RuleType]}{' '}
                      <strong>{rule.threshold_value}</strong>
                      {rule.rule_type !== 'amount_above' && '%'}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onDeleteRule(rule.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Triggered Rules */}
          {triggeredRules.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Triggered</p>
              {triggeredRules.map(rule => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-2 rounded-md bg-green-500/10 border border-green-500/20"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] bg-green-500/20 text-green-500">
                      ✓ Triggered
                    </Badge>
                    <span className="text-xs">
                      {RULE_TYPE_LABELS[rule.rule_type as RuleType]}{' '}
                      <strong>{rule.threshold_value}</strong>
                      {rule.rule_type !== 'amount_above' && '%'}
                    </span>
                  </div>
                  {rule.cashout_amount && (
                    <span className="text-xs text-green-500 font-medium">
                      +{rule.cashout_amount}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeRules.length === 0 && triggeredRules.length === 0 && !showForm && (
            <div className="text-center py-4">
              <Settings className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground">
                No auto-cashout rules set.
                <br />
                Add a rule to automatically cash out.
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
