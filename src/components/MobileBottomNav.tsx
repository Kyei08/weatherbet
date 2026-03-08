import { useLocation, useNavigate } from 'react-router-dom';
import { Home, ListChecks, DollarSign, BarChart3, MoreHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface NavItem {
  icon: typeof Home;
  label: string;
  path?: string;
  action?: string;
}

const navItems: NavItem[] = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: ListChecks, label: 'My Bets', action: 'mybets' },
  { icon: DollarSign, label: 'Cash Out', path: '/cashout' },
  { icon: BarChart3, label: 'Analytics', action: 'analytics' },
  { icon: MoreHorizontal, label: 'More', action: 'more' },
];

const moreItems = [
  { label: '💳 Banking', path: '/transactions' },
  { label: '🏙️ Cities', path: '/city-analytics' },
  { label: '📊 Compare', path: '/mode-comparison' },
  { label: '🛒 Shop', action: 'shop' },
];

interface MobileBottomNavProps {
  onAction?: (action: string) => void;
}

export const MobileBottomNav = ({ onAction }: MobileBottomNavProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showMore, setShowMore] = useState(false);

  const handleTap = (item: NavItem) => {
    if (item.action === 'more') {
      setShowMore((v) => !v);
      return;
    }
    setShowMore(false);
    if (item.path) {
      navigate(item.path);
    } else if (item.action && onAction) {
      onAction(item.action);
    }
  };

  const isActive = (item: NavItem) => {
    if (item.path) return location.pathname === item.path;
    return false;
  };

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-16 right-2 z-50 rounded-xl border bg-background/95 backdrop-blur-md shadow-xl p-2 min-w-[160px]"
        >
          {moreItems.map((mi) => (
            <button
              key={mi.label}
              className="w-full text-left px-4 py-3 rounded-lg text-sm font-medium hover:bg-muted transition-colors min-h-[44px]"
              onClick={() => {
                setShowMore(false);
                if (mi.path) navigate(mi.path);
                else if (mi.action && onAction) onAction(mi.action);
              }}
            >
              {mi.label}
            </button>
          ))}
        </motion.div>
      )}

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-md md:hidden safe-area-bottom">
        <div className="flex items-center justify-around px-1 h-16">
          {navItems.map((item) => {
            const active = isActive(item) || (item.action === 'more' && showMore);
            return (
              <motion.button
                key={item.label}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleTap(item)}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[44px] rounded-lg transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </motion.button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
