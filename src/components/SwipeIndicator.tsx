import { cn } from '@/lib/utils';

interface SwipeIndicatorProps {
  currentIndex: number;
  totalViews: number;
  labels?: string[];
}

export const SwipeIndicator = ({ currentIndex, totalViews, labels }: SwipeIndicatorProps) => {
  if (totalViews <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-1.5 py-2 md:hidden">
      {Array.from({ length: totalViews }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-all duration-300',
            i === currentIndex
              ? 'w-6 bg-primary'
              : 'w-1.5 bg-muted-foreground/30'
          )}
        />
      ))}
    </div>
  );
};
