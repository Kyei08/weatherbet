// Streak Bonus System
// Rewards consecutive correct predictions with multiplier bonuses

export interface StreakConfig {
  // Minimum streak length to start earning bonuses
  minStreakForBonus: number;
  // Maximum multiplier cap
  maxMultiplier: number;
  // Base multiplier increment per streak level
  multiplierIncrement: number;
  // Streak thresholds and their multipliers
  thresholds: StreakThreshold[];
}

export interface StreakThreshold {
  minStreak: number;
  multiplier: number;
  label: string;
  emoji: string;
  color: string;
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  multiplier: number;
  threshold: StreakThreshold | null;
  nextThreshold: StreakThreshold | null;
  winsToNextThreshold: number;
  isActive: boolean;
}

// Default configuration
export const STREAK_CONFIG: StreakConfig = {
  minStreakForBonus: 3,
  maxMultiplier: 2.0,
  multiplierIncrement: 0.05,
  thresholds: [
    { minStreak: 3, multiplier: 1.1, label: 'Hot Streak', emoji: '🔥', color: 'text-orange-500' },
    { minStreak: 5, multiplier: 1.2, label: 'On Fire', emoji: '🔥🔥', color: 'text-orange-600' },
    { minStreak: 7, multiplier: 1.35, label: 'Blazing', emoji: '🔥🔥🔥', color: 'text-red-500' },
    { minStreak: 10, multiplier: 1.5, label: 'Unstoppable', emoji: '💥', color: 'text-red-600' },
    { minStreak: 15, multiplier: 1.75, label: 'Legendary', emoji: '⭐', color: 'text-amber-500' },
    { minStreak: 20, multiplier: 2.0, label: 'Mythical', emoji: '👑', color: 'text-yellow-500' },
  ],
};

/**
 * Calculate the streak multiplier for a given streak length
 */
export function calculateStreakMultiplier(streak: number, config: StreakConfig = STREAK_CONFIG): number {
  if (streak < config.minStreakForBonus) {
    return 1.0;
  }
  
  // Find the highest threshold that applies
  let multiplier = 1.0;
  for (const threshold of config.thresholds) {
    if (streak >= threshold.minStreak) {
      multiplier = threshold.multiplier;
    }
  }
  
  // Cap at max multiplier
  return Math.min(multiplier, config.maxMultiplier);
}

/**
 * Get the current streak threshold info
 */
export function getStreakThreshold(streak: number, config: StreakConfig = STREAK_CONFIG): StreakThreshold | null {
  if (streak < config.minStreakForBonus) {
    return null;
  }
  
  let currentThreshold: StreakThreshold | null = null;
  for (const threshold of config.thresholds) {
    if (streak >= threshold.minStreak) {
      currentThreshold = threshold;
    }
  }
  
  return currentThreshold;
}

/**
 * Get the next streak threshold info
 */
export function getNextStreakThreshold(streak: number, config: StreakConfig = STREAK_CONFIG): StreakThreshold | null {
  for (const threshold of config.thresholds) {
    if (streak < threshold.minStreak) {
      return threshold;
    }
  }
  return null;
}

/**
 * Calculate complete streak info from a streak count
 */
export function getStreakInfo(currentStreak: number, longestStreak: number = 0, config: StreakConfig = STREAK_CONFIG): StreakInfo {
  const multiplier = calculateStreakMultiplier(currentStreak, config);
  const threshold = getStreakThreshold(currentStreak, config);
  const nextThreshold = getNextStreakThreshold(currentStreak, config);
  
  return {
    currentStreak,
    longestStreak: Math.max(currentStreak, longestStreak),
    multiplier,
    threshold,
    nextThreshold,
    winsToNextThreshold: nextThreshold ? nextThreshold.minStreak - currentStreak : 0,
    isActive: currentStreak >= config.minStreakForBonus,
  };
}

/**
 * Calculate the bonus amount from a streak multiplier
 */
export function calculateStreakBonus(baseWinnings: number, streak: number, config: StreakConfig = STREAK_CONFIG): number {
  const multiplier = calculateStreakMultiplier(streak, config);
  if (multiplier <= 1.0) return 0;
  
  return Math.round(baseWinnings * (multiplier - 1));
}

/**
 * Calculate total winnings with streak bonus
 */
export function calculateWinningsWithStreak(baseWinnings: number, streak: number, config: StreakConfig = STREAK_CONFIG): {
  baseWinnings: number;
  streakBonus: number;
  totalWinnings: number;
  multiplier: number;
} {
  const multiplier = calculateStreakMultiplier(streak, config);
  const streakBonus = calculateStreakBonus(baseWinnings, streak, config);
  
  return {
    baseWinnings,
    streakBonus,
    totalWinnings: baseWinnings + streakBonus,
    multiplier,
  };
}
