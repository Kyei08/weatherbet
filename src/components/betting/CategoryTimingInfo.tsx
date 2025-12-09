import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock } from 'lucide-react';
import { 
  BettingCategory, 
  getTimeSlot, 
  getDefaultTimeSlot,
  hasMultipleTimeSlots,
  getCategoryTimeSlots 
} from '@/lib/betting-timing';

interface CategoryTimingInfoProps {
  category: BettingCategory;
  slotId?: string;
  showFull?: boolean;
  className?: string;
}

const CategoryTimingInfo = ({ 
  category, 
  slotId,
  showFull = false, 
  className = '' 
}: CategoryTimingInfoProps) => {
  const slot = slotId ? getTimeSlot(category, slotId) : getDefaultTimeSlot(category);
  const hasMultiple = hasMultipleTimeSlots(category);
  const allSlots = getCategoryTimeSlots(category);

  if (!slot) return null;

  if (showFull) {
    return (
      <div className={`flex items-start gap-2 p-3 bg-accent/50 rounded-lg border border-border/50 ${className}`}>
        <div className="text-lg">{slot.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm capitalize">
              {category.replace('_', ' ')}
            </span>
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              {slot.label}
            </Badge>
            {slot.oddsMultiplier !== 1.0 && (
              <Badge variant="secondary" className="text-xs">
                {slot.oddsMultiplier > 1 ? '+' : ''}{((slot.oddsMultiplier - 1) * 100).toFixed(0)}% odds
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {slot.description}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-0.5 italic">
            {slot.reason}
          </p>
          {hasMultiple && (
            <p className="text-xs text-primary mt-1">
              {allSlots.length} time slots available
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="secondary" 
            className={`text-xs cursor-help inline-flex items-center gap-1 ${className}`}
          >
            <Clock className="h-3 w-3" />
            {slot.label}
            {hasMultiple && (
              <span className="text-primary ml-0.5">+{allSlots.length - 1}</span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-2">
            <p className="font-semibold flex items-center gap-2">
              <span>{slot.icon}</span>
              <span className="capitalize">{category.replace('_', ' ')}</span>
            </p>
            <p className="text-sm">{slot.description}</p>
            <p className="text-xs text-muted-foreground">{slot.reason}</p>
            {hasMultiple && (
              <div className="border-t pt-2 mt-2">
                <p className="text-xs font-medium mb-1">Available time slots:</p>
                <div className="flex flex-wrap gap-1">
                  {allSlots.map(s => (
                    <Badge 
                      key={s.slotId} 
                      variant={s.slotId === slot.slotId ? 'default' : 'outline'} 
                      className="text-xs"
                    >
                      {s.icon} {s.label}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default CategoryTimingInfo;
