import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock, Info } from 'lucide-react';
import { BettingCategory, getCategoryTiming } from '@/lib/betting-timing';

interface CategoryTimingInfoProps {
  category: BettingCategory;
  showFull?: boolean;
  className?: string;
}

const CategoryTimingInfo = ({ category, showFull = false, className = '' }: CategoryTimingInfoProps) => {
  const timing = getCategoryTiming(category);

  if (showFull) {
    return (
      <div className={`flex items-start gap-2 p-3 bg-accent/50 rounded-lg border border-border/50 ${className}`}>
        <div className="text-lg">{timing.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm capitalize">
              {category.replace('_', ' ')}
            </span>
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              {timing.timingLabel}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {timing.description}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-0.5 italic">
            {timing.reason}
          </p>
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
            {timing.timingLabel}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1">
            <p className="font-semibold flex items-center gap-2">
              <span>{timing.icon}</span>
              <span className="capitalize">{category.replace('_', ' ')}</span>
            </p>
            <p className="text-sm">{timing.description}</p>
            <p className="text-xs text-muted-foreground">{timing.reason}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default CategoryTimingInfo;
