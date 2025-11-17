/**
 * Centralized Betting Configuration
 * Adjust these values to buff/nerf odds, outcomes, and betting mechanics
 */

// ============================================
// GLOBAL BETTING SETTINGS
// ============================================

export const BETTING_CONFIG = {
  // Global odds multiplier (1.0 = normal, 1.5 = 50% better odds, 0.8 = 20% worse odds)
  globalOddsMultiplier: 1.0,
  
  // House edge percentage (default 5%, increase to nerf player winnings)
  houseEdgePercentage: 5,
  
  // Minimum and maximum odds allowed
  minOdds: 1.1,
  maxOdds: 10.0,
  
  // Insurance settings
  insurance: {
    costPercentage: 10, // Cost as % of stake (10 = 10% of stake)
    payoutPercentage: 80, // Payout as % of stake on loss (80 = get 80% back)
  },
  
  // Cash out settings
  cashOut: {
    enabled: true,
    minTimeBeforeExpiry: 1, // Minimum hours before expiry to allow cash out
    penaltyPercentage: 15, // Penalty for cashing out (15 = lose 15% of potential winnings)
  },
} as const;

// ============================================
// CATEGORY-SPECIFIC MULTIPLIERS
// ============================================

export const CATEGORY_MULTIPLIERS = {
  // Individual multipliers per category (1.0 = normal, 1.5 = easier odds, 0.8 = harder odds)
  rain: 1.0,
  temperature: 1.0,
  rainfall: 1.0,
  snow: 1.0,
  wind: 1.0,
  dew_point: 1.0,
  pressure: 1.0,
  cloud_coverage: 1.0,
} as const;

// ============================================
// STATIC ODDS CONFIGURATION
// ============================================

export const ODDS_RANGES = {
  temperature: [
    { label: '20-25°C', value: '20-25', baseOdds: 2.5 },
    { label: '25-30°C', value: '25-30', baseOdds: 2.0 },  
    { label: '30-35°C', value: '30-35', baseOdds: 3.0 },
  ],
  
  rainfall: [
    { label: '0-5mm', value: '0-5', baseOdds: 2.0 },
    { label: '5-10mm', value: '5-10', baseOdds: 2.5 },
    { label: '10-20mm', value: '10-20', baseOdds: 3.0 },
    { label: '20+mm', value: '20-999', baseOdds: 4.0 },
  ],
  
  wind: [
    { label: '0-10 km/h', value: '0-10', baseOdds: 2.0 },
    { label: '10-20 km/h', value: '10-20', baseOdds: 2.2 },
    { label: '20-30 km/h', value: '20-30', baseOdds: 2.5 },
    { label: '30+ km/h', value: '30-999', baseOdds: 3.5 },
  ],
  
  dew_point: [
    { label: '0-10°C', value: '0-10', baseOdds: 2.0 },
    { label: '10-15°C', value: '10-15', baseOdds: 2.2 },
    { label: '15-20°C', value: '15-20', baseOdds: 2.5 },
    { label: '20+°C', value: '20-999', baseOdds: 3.0 },
  ],
  
  pressure: [
    { label: '980-1000 hPa', value: '980-1000', baseOdds: 2.5 },
    { label: '1000-1020 hPa', value: '1000-1020', baseOdds: 2.0 },
    { label: '1020-1040 hPa', value: '1020-1040', baseOdds: 2.5 },
  ],
  
  cloud_coverage: [
    { label: '0-25%', value: '0-25', baseOdds: 2.5 },
    { label: '25-50%', value: '25-50', baseOdds: 2.2 },
    { label: '50-75%', value: '50-75', baseOdds: 2.2 },
    { label: '75-100%', value: '75-100', baseOdds: 2.5 },
  ],
} as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get adjusted odds for a specific category
 * Applies both global and category-specific multipliers
 */
export function getAdjustedOdds(
  baseOdds: number, 
  category: keyof typeof CATEGORY_MULTIPLIERS
): number {
  const categoryMultiplier = CATEGORY_MULTIPLIERS[category] || 1.0;
  const adjustedOdds = baseOdds * categoryMultiplier * BETTING_CONFIG.globalOddsMultiplier;
  
  // Clamp to min/max odds
  return Math.max(
    BETTING_CONFIG.minOdds, 
    Math.min(BETTING_CONFIG.maxOdds, adjustedOdds)
  );
}

/**
 * Get odds ranges for a category with multipliers applied
 */
export function getCategoryOddsRanges(category: keyof typeof ODDS_RANGES) {
  const ranges = ODDS_RANGES[category];
  if (!ranges) return [];
  
  return ranges.map(range => ({
    ...range,
    odds: getAdjustedOdds(range.baseOdds, category as keyof typeof CATEGORY_MULTIPLIERS)
  }));
}

/**
 * Calculate insurance cost for a given stake
 */
export function calculateInsuranceCost(stake: number): number {
  return Math.floor((stake * BETTING_CONFIG.insurance.costPercentage) / 100);
}

/**
 * Calculate insurance payout for a given stake
 */
export function calculateInsurancePayout(stake: number): number {
  return Math.floor((stake * BETTING_CONFIG.insurance.payoutPercentage) / 100);
}

/**
 * Check if cash out is available for a bet
 */
export function canCashOut(expiresAt: Date): boolean {
  if (!BETTING_CONFIG.cashOut.enabled) return false;
  
  const hoursUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
  return hoursUntilExpiry >= BETTING_CONFIG.cashOut.minTimeBeforeExpiry;
}

/**
 * Calculate cash out amount with penalty applied
 */
export function calculateCashOutAmount(potentialWinnings: number): number {
  const penaltyAmount = (potentialWinnings * BETTING_CONFIG.cashOut.penaltyPercentage) / 100;
  return Math.floor(potentialWinnings - penaltyAmount);
}
