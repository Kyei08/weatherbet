import { Badge } from '@/components/ui/badge';
import { useCurrencyMode } from '@/contexts/CurrencyModeContext';
import { Coins, Banknote } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModeBadgeProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const ModeBadge = ({ className, size = 'md' }: ModeBadgeProps) => {
  const { mode } = useCurrencyMode();
  const isVirtual = mode === 'virtual';

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5'
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16
  };

  return (
    <Badge
      className={cn(
        'font-semibold border-2 flex items-center gap-1.5 transition-all',
        sizeClasses[size],
        isVirtual
          ? 'bg-virtual-primary/10 text-virtual-primary border-virtual-primary/30 hover:bg-virtual-primary/20'
          : 'bg-real-primary/10 text-real-primary border-real-primary/30 hover:bg-real-primary/20',
        className
      )}
    >
      {isVirtual ? (
        <>
          <Coins size={iconSizes[size]} />
          <span>Virtual Points</span>
        </>
      ) : (
        <>
          <Banknote size={iconSizes[size]} />
          <span>Real Money</span>
        </>
      )}
    </Badge>
  );
};
