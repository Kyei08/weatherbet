/**
 * Prediction Difficulty Rating System
 * Combines volatility, time decay, and forecast uncertainty to rate difficulty
 */

import { getVolatilityInfo, VOLATILITY_CONFIG } from './volatility-odds';
import { getTimeDecayInfo, BETTING_CONFIG } from './betting-config';

// ============================================
// DIFFICULTY CONFIGURATION
// ============================================

export const DIFFICULTY_CONFIG = {
  // Weights for each factor (must sum to 1.0)
  weights: {
    volatility: 0.35,      // Historical accuracy impact
    timeDecay: 0.30,       // Days ahead impact
    forecastUncertainty: 0.35, // Current forecast uncertainty
  },
  
  // Thresholds for difficulty levels
  thresholds: {
    easy: 0.35,      // Score below this = Easy
    medium: 0.60,    // Score below this = Medium
    hard: 0.80,      // Score below this = Hard
    // Above hard threshold = Expert
  },
} as const;

// ============================================
// TYPES
// ============================================

export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard' | 'Expert';

export interface DifficultyRating {
  level: DifficultyLevel;
  score: number; // 0-1 scale
  color: string;
  icon: string;
  description: string;
  factors: {
    volatility: { score: number; label: string };
    timeDecay: { score: number; label: string };
    forecastUncertainty: { score: number; label: string };
  };
  oddsBonus: number; // Combined odds bonus percentage
}

interface WeatherForecast {
  date: string;
  temp_min: number;
  temp_max: number;
  temp_day: number;
  rain_probability: number;
  condition: string;
}

// ============================================
// DIFFICULTY CALCULATION
// ============================================

/**
 * Calculate forecast uncertainty based on weather data
 * Higher uncertainty when forecasts are in "middle" ranges
 */
function calculateForecastUncertainty(
  predictionType: string,
  predictionValue: string,
  forecast: WeatherForecast[],
  daysAhead: number
): number {
  const targetForecast = forecast[Math.min(daysAhead - 1, forecast.length - 1)];
  if (!targetForecast) return 0.5; // Default medium uncertainty

  // Base uncertainty increases with days ahead
  const baseUncertainty = Math.min(daysAhead / 7, 1) * 0.3;

  if (predictionType === 'rain') {
    const rainProb = targetForecast.rain_probability;
    // Most uncertain when probability is around 50%
    const distanceFrom50 = Math.abs(rainProb - 50);
    const uncertaintyFromProb = 1 - (distanceFrom50 / 50);
    return Math.min(baseUncertainty + uncertaintyFromProb * 0.7, 1);
  }

  if (predictionType === 'temperature') {
    const [min, max] = predictionValue.split('-').map(Number);
    const forecastTemp = targetForecast.temp_day;
    const rangeWidth = max - min;
    
    // Narrower ranges = higher uncertainty
    const rangeUncertainty = rangeWidth <= 5 ? 0.8 : rangeWidth <= 10 ? 0.5 : 0.3;
    
    // Distance from forecast center = lower uncertainty
    const rangeMid = (min + max) / 2;
    const distanceFromMid = Math.abs(forecastTemp - rangeMid);
    const distanceUncertainty = distanceFromMid <= 3 ? 0.2 : 
      distanceFromMid <= 7 ? 0.4 : 0.6;
    
    return Math.min(baseUncertainty + (rangeUncertainty * 0.5 + distanceUncertainty * 0.5) * 0.7, 1);
  }

  if (predictionType === 'snow') {
    // Snow is generally hard to predict
    return Math.min(baseUncertainty + 0.6, 1);
  }

  // For other categories, use moderate uncertainty based on days ahead
  return Math.min(baseUncertainty + 0.4, 1);
}

/**
 * Calculate difficulty score from volatility
 * Higher volatility = higher difficulty
 */
function getVolatilityScore(city: string, category: string): number {
  if (!VOLATILITY_CONFIG.enabled) return 0;
  
  const volatilityInfo = getVolatilityInfo(city, category);
  if (!volatilityInfo.hasData) return 0.3; // Default moderate when no data
  
  // Convert bonus percentage to difficulty score (0-40% bonus = 0-1 score)
  return Math.min(volatilityInfo.bonusPercentage / 40, 1);
}

/**
 * Calculate difficulty score from time decay
 * Betting earlier = harder (but better odds)
 */
function getTimeDecayScore(daysAhead: number): number {
  if (!BETTING_CONFIG.timeDecay.enabled) return 0;
  
  const timeDecayInfo = getTimeDecayInfo(daysAhead);
  // Convert bonus percentage to difficulty score (0-30% bonus = 0-1 score)
  return Math.min(timeDecayInfo.bonusPercentage / 30, 1);
}

/**
 * Get difficulty level from score
 */
function getDifficultyLevel(score: number): DifficultyLevel {
  if (score < DIFFICULTY_CONFIG.thresholds.easy) return 'Easy';
  if (score < DIFFICULTY_CONFIG.thresholds.medium) return 'Medium';
  if (score < DIFFICULTY_CONFIG.thresholds.hard) return 'Hard';
  return 'Expert';
}

/**
 * Get difficulty styling based on level
 */
function getDifficultyStyle(level: DifficultyLevel): { color: string; icon: string } {
  switch (level) {
    case 'Easy':
      return { color: 'text-green-500', icon: '🟢' };
    case 'Medium':
      return { color: 'text-yellow-500', icon: '🟡' };
    case 'Hard':
      return { color: 'text-orange-500', icon: '🟠' };
    case 'Expert':
      return { color: 'text-red-500', icon: '🔴' };
  }
}

/**
 * Get difficulty description
 */
function getDifficultyDescription(level: DifficultyLevel, oddsBonus: number): string {
  switch (level) {
    case 'Easy':
      return 'High confidence prediction with stable weather patterns.';
    case 'Medium':
      return `Moderate challenge with ${oddsBonus > 0 ? `+${oddsBonus}% odds bonus` : 'standard odds'}.`;
    case 'Hard':
      return `Challenging prediction with ${oddsBonus > 0 ? `+${oddsBonus}% odds bonus for the risk` : 'elevated risk'}.`;
    case 'Expert':
      return `Expert-level difficulty with ${oddsBonus > 0 ? `+${oddsBonus}% odds bonus` : 'maximum risk'} - high reward potential!`;
  }
}

/**
 * Calculate comprehensive difficulty rating
 */
export function calculateDifficultyRating(
  city: string,
  predictionType: string,
  predictionValue: string,
  forecast: WeatherForecast[],
  daysAhead: number
): DifficultyRating {
  const { weights } = DIFFICULTY_CONFIG;

  // Calculate individual factor scores
  const volatilityScore = getVolatilityScore(city, predictionType);
  const timeDecayScore = getTimeDecayScore(daysAhead);
  const forecastUncertaintyScore = calculateForecastUncertainty(
    predictionType,
    predictionValue,
    forecast,
    daysAhead
  );

  // Calculate weighted total score
  const totalScore = 
    volatilityScore * weights.volatility +
    timeDecayScore * weights.timeDecay +
    forecastUncertaintyScore * weights.forecastUncertainty;

  // Get difficulty level
  const level = getDifficultyLevel(totalScore);
  const style = getDifficultyStyle(level);

  // Calculate combined odds bonus
  const volatilityInfo = getVolatilityInfo(city, predictionType);
  const timeDecayInfo = getTimeDecayInfo(daysAhead);
  const oddsBonus = volatilityInfo.bonusPercentage + timeDecayInfo.bonusPercentage;

  // Factor labels
  const getVolatilityLabel = (score: number) => 
    score < 0.2 ? 'Stable' : score < 0.5 ? 'Moderate' : score < 0.8 ? 'Volatile' : 'Very Volatile';
  const getTimeLabel = (score: number) =>
    score < 0.2 ? 'Near term' : score < 0.5 ? 'Mid range' : score < 0.8 ? 'Extended' : 'Long range';
  const getForecastLabel = (score: number) =>
    score < 0.3 ? 'Clear' : score < 0.5 ? 'Mixed' : score < 0.7 ? 'Uncertain' : 'Highly Uncertain';

  return {
    level,
    score: Math.round(totalScore * 100) / 100,
    color: style.color,
    icon: style.icon,
    description: getDifficultyDescription(level, oddsBonus),
    factors: {
      volatility: { score: volatilityScore, label: getVolatilityLabel(volatilityScore) },
      timeDecay: { score: timeDecayScore, label: getTimeLabel(timeDecayScore) },
      forecastUncertainty: { score: forecastUncertaintyScore, label: getForecastLabel(forecastUncertaintyScore) },
    },
    oddsBonus,
  };
}

/**
 * Get simple difficulty indicator (for compact displays)
 */
export function getSimpleDifficulty(
  city: string,
  predictionType: string,
  predictionValue: string,
  forecast: WeatherForecast[],
  daysAhead: number
): { level: DifficultyLevel; icon: string; color: string } {
  const rating = calculateDifficultyRating(city, predictionType, predictionValue, forecast, daysAhead);
  return {
    level: rating.level,
    icon: rating.icon,
    color: rating.color,
  };
}
