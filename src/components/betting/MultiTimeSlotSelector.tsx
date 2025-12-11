import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Clock, Zap } from 'lucide-react';
import { 
  BettingCategory, 
  getCategoryTimeSlots, 
  hasMultipleTimeSlots,
  TimeSlotConfig 
} from '@/lib/betting-timing';

interface MultiTimeSlotSelectorProps {
  category: BettingCategory;
  selectedSlotIds: string[];
  onSlotsChange: (slotIds: string[]) => void;
  className?: string;
}

/**
 * Component for selecting multiple time slots for multi-time combination bets
 */
const MultiTimeSlotSelector = ({ 
  category, 
  selectedSlotIds, 
  onSlotsChange,
  className = ''
}: MultiTimeSlotSelectorProps) => {
  const timeSlots = getCategoryTimeSlots(category);
  const hasMultiple = hasMultipleTimeSlots(category);

  // If only one time slot available, auto-select it
  if (!hasMultiple) {
    const slot = timeSlots[0];
    return (
      <Badge variant="secondary" className={`text-xs ${className}`}>
        <Clock className="h-3 w-3 mr-1" />
        {slot.icon} {slot.label}
      </Badge>
    );
  }

  const handleSlotToggle = (slotId: string) => {
    if (selectedSlotIds.includes(slotId)) {
      onSlotsChange(selectedSlotIds.filter(id => id !== slotId));
    } else {
      onSlotsChange([...selectedSlotIds, slotId]);
    }
  };

  const getCombinedMultiplier = (): number => {
    if (selectedSlotIds.length === 0) return 1;
    return selectedSlotIds.reduce((acc, slotId) => {
      const slot = timeSlots.find(s => s.slotId === slotId);
      return acc * (slot?.oddsMultiplier || 1);
    }, 1);
  };

  const combinedMultiplier = getCombinedMultiplier();

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <Label className="text-sm text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Select Time Slots (Multi-Time Combo)
        </Label>
        {selectedSlotIds.length >= 2 && (
          <Badge variant="default" className="bg-primary text-primary-foreground flex items-center gap-1">
            <Zap className="h-3 w-3" />
            {selectedSlotIds.length}x Times
          </Badge>
        )}
      </div>
      
      <div className="grid gap-2">
        {timeSlots.map((slot) => {
          const isSelected = selectedSlotIds.includes(slot.slotId);
          return (
            <div 
              key={slot.slotId} 
              className={`
                flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-all
                ${isSelected 
                  ? 'border-primary bg-primary/10' 
                  : 'border-border hover:border-primary/50 hover:bg-accent'}
              `}
              onClick={() => handleSlotToggle(slot.slotId)}
            >
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`multi-${category}-${slot.slotId}`}
                  checked={isSelected}
                  onCheckedChange={() => handleSlotToggle(slot.slotId)}
                />
                <span className="text-lg">{slot.icon}</span>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{slot.label}</span>
                  <span className="text-xs text-muted-foreground">{slot.description}</span>
                </div>
              </div>
              <Badge variant="outline" className="text-xs">
                {slot.oddsMultiplier.toFixed(2)}x
              </Badge>
            </div>
          );
        })}
      </div>

      {selectedSlotIds.length >= 2 && (
        <div className="flex items-center justify-between p-2 bg-primary/5 rounded-lg border border-primary/20">
          <span className="text-sm font-medium">Combined Time Multiplier:</span>
          <span className="font-mono font-bold text-primary">{combinedMultiplier.toFixed(2)}x</span>
        </div>
      )}
      
      {selectedSlotIds.length === 1 && (
        <p className="text-xs text-muted-foreground">
          Select at least 2 time slots to create a multi-time combo bet
        </p>
      )}
    </div>
  );
};

export default MultiTimeSlotSelector;
