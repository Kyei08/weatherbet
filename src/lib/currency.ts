/**
 * Currency utilities for handling both Virtual Points and Real Rands
 * Virtual: stored as integer points (1 point = 1 point)
 * Real: stored as cents (100 cents = R1.00)
 */

export type CurrencyMode = 'virtual' | 'real';

/**
 * Format currency based on mode
 */
export const formatCurrency = (amount: number, mode: CurrencyMode = 'virtual'): string => {
  if (mode === 'real') {
    const rands = amount / 100;
    return `R${rands.toFixed(2)}`;
  }
  return `${amount} Points`;
};

/**
 * Format cents as Rands (R#.##) - for real money mode
 */
export const formatRands = (cents: number): string => {
  const rands = cents / 100;
  return `R${rands.toFixed(2)}`;
};

/**
 * Format points - for virtual mode
 */
export const formatPoints = (points: number): string => {
  return `${points} Points`;
};

/**
 * Parse Rands string to cents
 */
export const parseRandsToCents = (randsString: string): number => {
  const cleaned = randsString.replace(/[R,\s]/g, '');
  const rands = parseFloat(cleaned);
  return Math.round(rands * 100);
};

/**
 * Convert Rands to cents
 */
export const randsToCents = (rands: number): number => {
  return Math.round(rands * 100);
};

/**
 * Convert cents to Rands
 */
export const centsToRands = (cents: number): number => {
  return cents / 100;
};
