import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';
import { 
  BettingCategory, 
  getCategoryTimeSlots, 
  getDefaultTimeSlot,
  hasMultipleTimeSlots,
  TimeSlotConfig 
} from '@/lib/betting-timing';

interface TimeSlotSelectorProps {
  category: BettingCategory;
  selectedSlotId: string;
  onSlotChange: (slotId: string) => void;
  className?: string;
}

const TimeSlotSelector = ({ 
  category, 
  selectedSlotId, 
  onSlotChange,
  className = ''
}: TimeSlotSelectorProps) => {
  const timeSlots = getCategoryTimeSlots(category);
  const hasMultiple = hasMultipleTimeSlots(category);

  // If only one time slot, show a simple badge
  if (!hasMultiple) {
    const slot = timeSlots[0];
    return (
      <Badge variant="secondary" className={`text-xs ${className}`}>
        <Clock className="h-3 w-3 mr-1" />
        {slot.icon} {slot.label}
      </Badge>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="text-sm text-muted-foreground flex items-center gap-1">
        <Clock className="h-3 w-3" />
        Measurement Time
      </Label>
      <RadioGroup
        value={selectedSlotId}
        onValueChange={onSlotChange}
        className="flex flex-wrap gap-2"
      >
        {timeSlots.map((slot) => (
          <div key={slot.slotId} className="flex items-center">
            <RadioGroupItem
              value={slot.slotId}
              id={`${category}-${slot.slotId}`}
              className="sr-only"
            />
            <Label
              htmlFor={`${category}-${slot.slotId}`}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer transition-all text-sm
                ${selectedSlotId === slot.slotId 
                  ? 'border-primary bg-primary/10 text-primary font-medium' 
                  : 'border-border hover:border-primary/50 hover:bg-accent'}
              `}
            >
              <span>{slot.icon}</span>
              <span>{slot.label}</span>
              {slot.oddsMultiplier !== 1.0 && (
                <span className="text-xs text-muted-foreground">
                  ({slot.oddsMultiplier > 1 ? '+' : ''}{((slot.oddsMultiplier - 1) * 100).toFixed(0)}%)
                </span>
              )}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
};

export default TimeSlotSelector;
