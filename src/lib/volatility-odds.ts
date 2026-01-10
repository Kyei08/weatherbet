/**
 * Volatility-Based Odds System
 * Adjusts odds based on historical forecast accuracy
 * Lower accuracy = higher volatility = better odds (harder to predict)
 */

import { supabase } from "@/integrations/supabase/client";
import { BETTING_CONFIG, CATEGORY_MULTIPLIERS } from './betting-config';

// ============================================
// VOLATILITY CONFIGURATION
// ============================================

export const VOLATILITY_CONFIG = {
  enabled: true,
  
  // Base accuracy threshold (80% = normal odds)
  baseAccuracyThreshold: 80,
  
  // Maximum volatility bonus (for very low accuracy, e.g., 0.4 = 40% better odds)
  maxVolatilityBonus: 0.40,
  
  // Minimum data points required to calculate volatility
  minDataPoints: 5,
  
  // How much to weight recent predictions vs older ones
  recencyWeight: 0.7, // 70% weight on last month, 30% on older
  
  // Cache duration in milliseconds (5 minutes)
  cacheDuration: 5 * 60 * 1000,
} as const;

// ============================================
// TYPES
// ============================================

export interface VolatilityData {
  city: string;
  category: string;
  avgAccuracy: number;
  totalPredictions: number;
  volatilityMultiplier: number;
  volatilityLabel: string;
  lastUpdated: Date;
}

interface AccuracySummary {
  city: string;
  category: string;
  total_predictions: number;
  avg_accuracy: number;
  min_accuracy: number;
  max_accuracy: number;
  month: string;
}

// ============================================
// VOLATILITY CACHE
// ============================================

const volatilityCache = new Map<string, { data: VolatilityData; timestamp: number }>();

function getCacheKey(city: string, category: string): string {
  return `${city.toLowerCase()}-${category}`;
}

function getCachedVolatility(city: string, category: string): VolatilityData | null {
  const key = getCacheKey(city, category);
  const cached = volatilityCache.get(key);
  
  if (cached && Date.now() - cached.timestamp < VOLATILITY_CONFIG.cacheDuration) {
    return cached.data;
  }
  
  return null;
}

function setCachedVolatility(city: string, category: string, data: VolatilityData): void {
  const key = getCacheKey(city, category);
  volatilityCache.set(key, { data, timestamp: Date.now() });
}

// ============================================
// VOLATILITY CALCULATION
// ============================================

/**
 * Calculate volatility multiplier based on accuracy
 * Lower accuracy = higher multiplier = better odds
 * 
 * Example:
 * - 90% accuracy = 1.0x (easy to predict, normal odds)
 * - 80% accuracy = 1.0x (baseline)
 * - 60% accuracy = 1.20x (20% bonus)
 * - 40% accuracy = 1.40x (40% bonus - max)
 */
export function calculateVolatilityMultiplier(avgAccuracy: number): number {
  if (!VOLATILITY_CONFIG.enabled) {
    return 1.0;
  }
  
  const { baseAccuracyThreshold, maxVolatilityBonus } = VOLATILITY_CONFIG;
  
  // If accuracy is above threshold, no bonus
  if (avgAccuracy >= baseAccuracyThreshold) {
    return 1.0;
  }
  
  // Calculate how much below threshold (0 to baseAccuracyThreshold)
  const accuracyDeficit = baseAccuracyThreshold - avgAccuracy;
  
  // Normalize to 0-1 range (0 = at threshold, 1 = 0% accuracy)
  const normalizedDeficit = Math.min(accuracyDeficit / baseAccuracyThreshold, 1.0);
  
  // Apply exponential curve for more dramatic effect at very low accuracy
  const bonusMultiplier = Math.pow(normalizedDeficit, 0.7) * maxVolatilityBonus;
  
  return 1.0 + bonusMultiplier;
}

/**
 * Get volatility label based on multiplier
 */
export function getVolatilityLabel(multiplier: number): string {
  if (multiplier >= 1.35) return 'Very Volatile ⚡';
  if (multiplier >= 1.25) return 'High Volatility';
  if (multiplier >= 1.15) return 'Moderate Volatility';
  if (multiplier >= 1.05) return 'Slight Volatility';
  return 'Stable';
}

/**
 * Fetch historical accuracy data for a city/category combination
 */
export async function fetchHistoricalAccuracy(
  city: string,
  category: string
): Promise<{ avgAccuracy: number; totalPredictions: number } | null> {
  try {
    const { data, error } = await supabase
      .from('weather_accuracy_summary')
      .select('avg_accuracy, total_predictions, month')
      .eq('city', city)
      .eq('category', category)
      .order('month', { ascending: false })
      .limit(6);
    
    if (error || !data || data.length === 0) {
      return null;
    }
    
    // Weight recent months more heavily
    let totalWeight = 0;
    let weightedAccuracy = 0;
    let totalPredictions = 0;
    
    data.forEach((entry, index) => {
      // More recent = higher weight
      const weight = index === 0 ? VOLATILITY_CONFIG.recencyWeight : 
        (1 - VOLATILITY_CONFIG.recencyWeight) / Math.max(data.length - 1, 1);
      
      weightedAccuracy += (entry.avg_accuracy || 0) * weight;
      totalWeight += weight;
      totalPredictions += entry.total_predictions || 0;
    });
    
    const avgAccuracy = totalWeight > 0 ? weightedAccuracy / totalWeight : 0;
    
    return {
      avgAccuracy: Math.round(avgAccuracy * 100) / 100,
      totalPredictions,
    };
  } catch (error) {
    console.error('Error fetching historical accuracy:', error);
    return null;
  }
}

/**
 * Get volatility data for a city/category with caching
 */
export async function getVolatilityData(
  city: string,
  category: string
): Promise<VolatilityData> {
  // Check cache first
  const cached = getCachedVolatility(city, category);
  if (cached) {
    return cached;
  }
  
  // Fetch fresh data
  const historicalData = await fetchHistoricalAccuracy(city, category);
  
  let volatilityData: VolatilityData;
  
  if (!historicalData || historicalData.totalPredictions < VOLATILITY_CONFIG.minDataPoints) {
    // Not enough data - use default values
    volatilityData = {
      city,
      category,
      avgAccuracy: VOLATILITY_CONFIG.baseAccuracyThreshold,
      totalPredictions: historicalData?.totalPredictions || 0,
      volatilityMultiplier: 1.0,
      volatilityLabel: 'Stable (No Data)',
      lastUpdated: new Date(),
    };
  } else {
    const multiplier = calculateVolatilityMultiplier(historicalData.avgAccuracy);
    
    volatilityData = {
      city,
      category,
      avgAccuracy: historicalData.avgAccuracy,
      totalPredictions: historicalData.totalPredictions,
      volatilityMultiplier: multiplier,
      volatilityLabel: getVolatilityLabel(multiplier),
      lastUpdated: new Date(),
    };
  }
  
  // Cache the result
  setCachedVolatility(city, category, volatilityData);
  
  return volatilityData;
}

/**
 * Get volatility info for display purposes (sync version using cache)
 */
export function getVolatilityInfo(city: string, category: string): {
  multiplier: number;
  bonusPercentage: number;
  label: string;
  isActive: boolean;
  avgAccuracy: number;
  hasData: boolean;
} {
  const cached = getCachedVolatility(city, category);
  
  if (!cached) {
    return {
      multiplier: 1.0,
      bonusPercentage: 0,
      label: 'Loading...',
      isActive: false,
      avgAccuracy: 0,
      hasData: false,
    };
  }
  
  const bonusPercentage = Math.round((cached.volatilityMultiplier - 1) * 100);
  
  return {
    multiplier: cached.volatilityMultiplier,
    bonusPercentage,
    label: cached.volatilityLabel,
    isActive: bonusPercentage > 0,
    avgAccuracy: cached.avgAccuracy,
    hasData: cached.totalPredictions >= VOLATILITY_CONFIG.minDataPoints,
  };
}

/**
 * Clear volatility cache (useful for forcing refresh)
 */
export function clearVolatilityCache(): void {
  volatilityCache.clear();
}

/**
 * Preload volatility data for multiple cities/categories
 */
export async function preloadVolatilityData(
  cities: string[],
  categories: string[]
): Promise<void> {
  const promises: Promise<VolatilityData>[] = [];
  
  for (const city of cities) {
    for (const category of categories) {
      promises.push(getVolatilityData(city, category));
    }
  }
  
  await Promise.all(promises);
}
