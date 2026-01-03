import { Timer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTimeSlotCountdown } from '@/hooks/useTimeSlotCountdown';
import { BettingCategory, getTimeSlot } from '@/lib/betting-timing';
import { cn } from '@/lib/utils';

interface TimeSlotCountdownProps {
  category: BettingCategory;
  slotId: string;
  targetDate?: string;
  showIcon?: boolean;
  compact?: boolean;
  className?: string;
}

export function TimeSlotCountdown({
  category,
  slotId,
  targetDate,
  showIcon = true,
  compact = false,
  className
}: TimeSlotCountdownProps) {
  const countdown = useTimeSlotCountdown(category, slotId, targetDate);
  const slot = getTimeSlot(category, slotId);

  if (!countdown || !slot) return null;

  if (countdown.isExpired) {
    return (
      <Badge variant="outline" className={cn("text-muted-foreground", className)}>
        {showIcon && <Timer className="h-3 w-3 mr-1" />}
        {countdown.label}
      </Badge>
    );
  }

  const formatTimeUnit = (value: number, unit: string) => {
    if (compact) {
      return `${value}${unit.charAt(0)}`;
    }
    return `${value}${unit}`;
  };

  const timeDisplay = compact
    ? `${countdown.hours}h ${countdown.minutes}m`
    : countdown.hours > 0
      ? `${countdown.hours}h ${countdown.minutes}m ${countdown.seconds}s`
      : countdown.minutes > 0
        ? `${countdown.minutes}m ${countdown.seconds}s`
        : `${countdown.seconds}s`;

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "bg-accent/20 border-accent/40 text-foreground animate-pulse",
        className
      )}
    >
      {showIcon && <Timer className="h-3 w-3 mr-1 text-accent-foreground" />}
      <span className="font-mono text-xs">
        {slot.icon} {timeDisplay}
      </span>
    </Badge>
  );
}

interface MultiSlotCountdownProps {
  categories: Array<{
    prediction_type: string;
    result: string;
  }>;
  targetDate?: string;
  className?: string;
}

// Helper to parse prediction type
function parsePredictionType(predictionType: string): { category: string; slotId?: string } {
  const knownCategories = ['temperature', 'rain', 'rainfall', 'wind', 'snow', 'cloud_coverage', 'pressure', 'dew_point', 'humidity'];
  
  for (const category of knownCategories) {
    if (predictionType === category) {
      return { category };
    }
    if (predictionType.startsWith(category + '_')) {
      const slotId = predictionType.substring(category.length + 1);
      return { category, slotId };
    }
  }
  
  return { category: predictionType };
}

export function MultiSlotCountdown({
  categories,
  targetDate,
  className
}: MultiSlotCountdownProps) {
  // Get pending categories with time slots
  const pendingSlots = categories
    .filter(cat => cat.result === 'pending')
    .map(cat => {
      const { category, slotId } = parsePredictionType(cat.prediction_type);
      return { category, slotId, predictionType: cat.prediction_type };
    })
    .filter(item => item.slotId);

  if (pendingSlots.length === 0) return null;

  // Sort by which comes first (we'll show the next one)
  const nextSlot = pendingSlots[0];

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {pendingSlots.map((item, index) => (
        <TimeSlotCountdown
          key={item.predictionType}
          category={item.category as BettingCategory}
          slotId={item.slotId!}
          targetDate={targetDate}
          compact={pendingSlots.length > 1}
          showIcon={index === 0}
        />
      ))}
    </div>
  );
}
