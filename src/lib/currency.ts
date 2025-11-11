/**
 * Currency utilities for handling South African Rands
 * All monetary values are stored as cents (integers) in the database
 * Example: R1.50 = 150 cents
 */

/**
 * Format cents as Rands (R#.##)
 */
export const formatRands = (cents: number): string => {
  const rands = cents / 100;
  return `R${rands.toFixed(2)}`;
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
