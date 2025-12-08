/**
 * Smart Timing-Based Betting Configuration
 * Each weather category is measured at its optimal time for accurate predictions
 */

export type BettingCategory = 
  | 'temperature'
  | 'rain'
  | 'rainfall'
  | 'wind'
  | 'snow'
  | 'cloud_coverage'
  | 'pressure'
  | 'dew_point';

export interface TimingConfig {
  /** Category identifier */
  category: BettingCategory;
  /** Display name for the timing */
  timingLabel: string;
  /** Short description of when/how it's measured */
  description: string;
  /** Hour of day for measurement (24h format) */
  measurementHour: number;
  /** Tolerance in minutes (+/-) */
  toleranceMinutes: number;
  /** Is this a cumulative measurement (daily total) vs point-in-time? */
  isCumulative: boolean;
  /** Icon for display */
  icon: string;
  /** Reasoning for this timing */
  reason: string;
}

/**
 * Optimal measurement times for each betting category
 * Based on meteorological best practices
 */
export const CATEGORY_TIMING: Record<BettingCategory, TimingConfig> = {
  temperature: {
    category: 'temperature',
    timingLabel: '2:00 PM Peak',
    description: 'Temperature at 2:00 PM local time',
    measurementHour: 14, // 2:00 PM
    toleranceMinutes: 30,
    isCumulative: false,
    icon: '🌡️',
    reason: 'Peak daily temperature - most stable and predictable'
  },
  
  rain: {
    category: 'rain',
    timingLabel: 'Any Time Today',
    description: 'Rain occurrence anytime during the day',
    measurementHour: 23, // Check at end of day
    toleranceMinutes: 0,
    isCumulative: true,
    icon: '🌧️',
    reason: 'Binary event - either rains or doesn\'t during the day'
  },
  
  rainfall: {
    category: 'rainfall',
    timingLabel: 'Daily Total',
    description: 'Total rainfall accumulation (00:00-23:59)',
    measurementHour: 23, // End of day total
    toleranceMinutes: 0,
    isCumulative: true,
    icon: '💧',
    reason: 'Total water matters most for predictions'
  },
  
  wind: {
    category: 'wind',
    timingLabel: 'Max Gust',
    description: 'Maximum wind gust (6:00 AM - 8:00 PM)',
    measurementHour: 20, // Check at 8 PM for max gust
    toleranceMinutes: 0,
    isCumulative: true, // Looking for maximum
    icon: '💨',
    reason: 'Peak wind matters most for storms and safety'
  },
  
  snow: {
    category: 'snow',
    timingLabel: 'Any Time Today',
    description: 'Snow occurrence anytime (00:00-23:59)',
    measurementHour: 23,
    toleranceMinutes: 0,
    isCumulative: true,
    icon: '❄️',
    reason: 'Binary event - rare, either happens or doesn\'t'
  },
  
  cloud_coverage: {
    category: 'cloud_coverage',
    timingLabel: 'Solar Noon',
    description: 'Cloud coverage at 12:00 PM',
    measurementHour: 12, // Solar noon
    toleranceMinutes: 30,
    isCumulative: false,
    icon: '☁️',
    reason: 'Midday represents typical daily conditions'
  },
  
  pressure: {
    category: 'pressure',
    timingLabel: '9:00 AM Reading',
    description: 'Atmospheric pressure at 9:00 AM',
    measurementHour: 9, // 9:00 AM
    toleranceMinutes: 30,
    isCumulative: false,
    icon: '📊',
    reason: 'Morning pressure predicts day\'s weather patterns'
  },
  
  dew_point: {
    category: 'dew_point',
    timingLabel: '6:00 PM Reading',
    description: 'Dew point at 6:00 PM',
    measurementHour: 18, // 6:00 PM
    toleranceMinutes: 30,
    isCumulative: false,
    icon: '💦',
    reason: 'Evening dew point indicates humidity and comfort'
  }
};

/**
 * Get timing configuration for a category
 */
export function getCategoryTiming(category: BettingCategory): TimingConfig {
  return CATEGORY_TIMING[category] || CATEGORY_TIMING.temperature;
}

/**
 * Get a display string for the measurement time
 */
export function getMeasurementTimeDisplay(category: BettingCategory): string {
  const timing = getCategoryTiming(category);
  return timing.timingLabel;
}

/**
 * Get full description for a category's timing
 */
export function getMeasurementDescription(category: BettingCategory): string {
  const timing = getCategoryTiming(category);
  return timing.description;
}

/**
 * Format hour as display time (e.g., "2:00 PM")
 */
export function formatMeasurementTime(hour: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:00 ${ampm}`;
}

/**
 * Check if a category uses cumulative (daily) measurement
 */
export function isCumulativeMeasurement(category: BettingCategory): boolean {
  const timing = getCategoryTiming(category);
  return timing.isCumulative;
}

/**
 * Get all timing configs as an array
 */
export function getAllTimingConfigs(): TimingConfig[] {
  return Object.values(CATEGORY_TIMING);
}
