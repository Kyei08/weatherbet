import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Zap } from 'lucide-react';
import { RuleType, BetType, RULE_TYPE_LABELS } from '@/hooks/useAutoCashout';

interface AutoCashoutRuleFormProps {
  betId: string;
  betType: BetType;
  currentPercentage?: number;
  currentWeatherBonus?: number;
  currentTimeBonus?: number;
  currentAmount?: number;
  onSubmit: (ruleType: RuleType, thresholdValue: number) => Promise<void>;
  onCancel?: () => void;
  compact?: boolean;
}

export const AutoCashoutRuleForm = ({
  betId,
  betType,
  currentPercentage,
  currentWeatherBonus,
  currentTimeBonus,
  currentAmount,
  onSubmit,
  onCancel,
  compact = false,
}: AutoCashoutRuleFormProps) => {
  const [ruleType, setRuleType] = useState<RuleType>('percentage_above');
  const [thresholdValue, setThresholdValue] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thresholdValue || isNaN(Number(thresholdValue))) return;

    setIsSubmitting(true);
    try {
      await onSubmit(ruleType, Number(thresholdValue));
      setThresholdValue('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPlaceholder = () => {
    switch (ruleType) {
      case 'percentage_above':
        return currentPercentage ? `Current: ${currentPercentage}%` : 'e.g., 80';
      case 'percentage_below':
        return currentPercentage ? `Current: ${currentPercentage}%` : 'e.g., 60';
      case 'weather_bonus_above':
        return currentWeatherBonus ? `Current: ${currentWeatherBonus}%` : 'e.g., 15';
      case 'weather_bonus_below':
        return currentWeatherBonus ? `Current: ${currentWeatherBonus}%` : 'e.g., 5';
      case 'time_bonus_above':
        return currentTimeBonus ? `Current: ${currentTimeBonus}%` : 'e.g., 20';
      case 'amount_above':
        return currentAmount ? `Current: ${currentAmount}` : 'e.g., 500';
      default:
        return 'Enter threshold';
    }
  };

  const getSuffix = () => {
    if (ruleType === 'amount_above') return '';
    return '%';
  };

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <Select value={ruleType} onValueChange={(v) => setRuleType(v as RuleType)}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(RULE_TYPE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key} className="text-xs">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative">
          <Input
            type="number"
            value={thresholdValue}
            onChange={(e) => setThresholdValue(e.target.value)}
            placeholder={getPlaceholder()}
            className="w-24 h-8 text-xs pr-6"
          />
          {getSuffix() && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              {getSuffix()}
            </span>
          )}
        </div>
        <Button type="submit" size="sm" disabled={isSubmitting || !thresholdValue}>
          <Zap className="h-3 w-3 mr-1" />
          Set
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </form>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bot className="h-4 w-4" />
          Set Auto-Cashout Rule
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Trigger Condition</Label>
            <Select value={ruleType} onValueChange={(v) => setRuleType(v as RuleType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RULE_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Threshold Value</Label>
            <div className="relative">
              <Input
                type="number"
                value={thresholdValue}
                onChange={(e) => setThresholdValue(e.target.value)}
                placeholder={getPlaceholder()}
                className="pr-8"
              />
              {getSuffix() && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {getSuffix()}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {ruleType.includes('above') 
                ? 'Trigger when value goes above this threshold'
                : 'Trigger when value drops below this threshold'}
            </p>
          </div>

          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={isSubmitting || !thresholdValue}>
              <Zap className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Creating...' : 'Create Rule'}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
