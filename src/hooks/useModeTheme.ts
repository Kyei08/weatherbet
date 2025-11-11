import { useCurrencyMode } from '@/contexts/CurrencyModeContext';

export const useModeTheme = () => {
  const { mode } = useCurrencyMode();
  
  const isVirtual = mode === 'virtual';
  const isReal = mode === 'real';

  return {
    mode,
    isVirtual,
    isReal,
    
    // Background colors
    bgColor: isVirtual ? 'bg-virtual-bg' : 'bg-real-bg',
    cardBg: isVirtual ? 'bg-virtual-bg/50' : 'bg-real-bg/50',
    
    // Border colors
    borderColor: isVirtual ? 'border-virtual-border' : 'border-real-border',
    borderColorHeavy: isVirtual ? 'border-virtual-primary/30' : 'border-real-primary/30',
    
    // Primary colors
    primary: isVirtual ? 'bg-virtual-primary' : 'bg-real-primary',
    primaryText: isVirtual ? 'text-virtual-primary' : 'text-real-primary',
    primaryForeground: isVirtual ? 'text-virtual-primary-foreground' : 'text-real-primary-foreground',
    
    // Secondary colors
    secondary: isVirtual ? 'bg-virtual-secondary' : 'bg-real-secondary',
    secondaryText: isVirtual ? 'text-virtual-secondary' : 'text-real-secondary',
    
    // Accent colors
    accent: isVirtual ? 'bg-virtual-accent' : 'bg-real-accent',
    accentText: isVirtual ? 'text-virtual-accent' : 'text-real-accent',
    
    // Glow/shadow effects
    glowShadow: isVirtual 
      ? 'shadow-lg shadow-virtual-glow/20' 
      : 'shadow-lg shadow-real-glow/20',
    
    // Gradient backgrounds
    gradient: isVirtual
      ? 'bg-gradient-to-br from-virtual-primary/10 via-virtual-accent/10 to-virtual-secondary/10'
      : 'bg-gradient-to-br from-real-primary/10 via-real-secondary/10 to-real-accent/10',
    
    gradientBorder: isVirtual
      ? 'border-2 border-transparent bg-gradient-to-r from-virtual-primary to-virtual-accent bg-clip-border'
      : 'border-2 border-transparent bg-gradient-to-r from-real-primary to-real-secondary bg-clip-border',
      
    // Button styles
    buttonPrimary: isVirtual
      ? 'bg-virtual-primary hover:bg-virtual-primary/90 text-virtual-primary-foreground'
      : 'bg-real-primary hover:bg-real-primary/90 text-real-primary-foreground',
      
    buttonSecondary: isVirtual
      ? 'bg-virtual-secondary hover:bg-virtual-secondary/90 text-white'
      : 'bg-real-secondary hover:bg-real-secondary/90 text-black',
    
    // Ring/focus colors
    ring: isVirtual ? 'ring-virtual-primary' : 'ring-real-primary',
    
    // Hover effects
    hoverBg: isVirtual ? 'hover:bg-virtual-primary/10' : 'hover:bg-real-primary/10',
    
    // Combined utility class
    card: isVirtual
      ? 'border-virtual-border bg-virtual-bg/30 hover:border-virtual-primary/50 transition-all'
      : 'border-real-border bg-real-bg/30 hover:border-real-primary/50 transition-all',
  };
};
