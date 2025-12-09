/**
 * Multi-Time Slot Betting Configuration
 * Each weather category supports multiple measurement times for deeper betting strategy
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

export interface TimeSlotConfig {
  /** Unique slot identifier */
  slotId: string;
  /** Display label for this time slot */
  label: string;
  /** Short description of when/how it's measured */
  description: string;
  /** Hour of day for measurement (24h format) - for point-in-time measurements */
  measurementHour?: number;
  /** Start hour for range-based measurements */
  startHour?: number;
  /** End hour for range-based measurements */
  endHour?: number;
  /** Tolerance in minutes (+/-) for point-in-time */
  toleranceMinutes?: number;
  /** Is this a cumulative/range measurement vs point-in-time? */
  isRange: boolean;
  /** Base odds multiplier for this time slot (affects betting value) */
  oddsMultiplier: number;
  /** Icon for display */
  icon: string;
  /** Reasoning for this timing */
  reason: string;
}

export interface CategoryTimingConfig {
  /** Category identifier */
  category: BettingCategory;
  /** Display name for the category */
  displayName: string;
  /** All available time slots for this category */
  timeSlots: TimeSlotConfig[];
  /** Default time slot ID */
  defaultSlotId: string;
}

/**
 * Multi-time slot configurations for each betting category
 * Based on meteorological best practices and user engagement optimization
 */
export const CATEGORY_TIME_SLOTS: Record<BettingCategory, CategoryTimingConfig> = {
  temperature: {
    category: 'temperature',
    displayName: 'Temperature',
    defaultSlotId: 'peak',
    timeSlots: [
      {
        slotId: 'morning',
        label: '9:00 AM',
        description: 'Morning temperature at 9:00 AM local time',
        measurementHour: 9,
        toleranceMinutes: 30,
        isRange: false,
        oddsMultiplier: 1.1,
        icon: '🌅',
        reason: "Day's starting temperature - stable morning reading"
      },
      {
        slotId: 'peak',
        label: '2:00 PM Peak',
        description: 'Peak temperature at 2:00 PM local time',
        measurementHour: 14,
        toleranceMinutes: 30,
        isRange: false,
        oddsMultiplier: 1.0,
        icon: '☀️',
        reason: 'Maximum daily heat - most predictable measurement'
      },
      {
        slotId: 'evening',
        label: '8:00 PM',
        description: 'Evening temperature at 8:00 PM local time',
        measurementHour: 20,
        toleranceMinutes: 30,
        isRange: false,
        oddsMultiplier: 1.15,
        icon: '🌙',
        reason: 'Nighttime cooling - harder to predict precisely'
      }
    ]
  },
  
  rain: {
    category: 'rain',
    displayName: 'Rain Occurrence',
    defaultSlotId: 'daily',
    timeSlots: [
      {
        slotId: 'daily',
        label: 'Any Time Today',
        description: 'Rain occurrence anytime during the day (00:00-23:59)',
        startHour: 0,
        endHour: 23,
        isRange: true,
        oddsMultiplier: 1.0,
        icon: '🌧️',
        reason: 'Binary event - easiest to predict overall rain occurrence'
      }
    ]
  },
  
  rainfall: {
    category: 'rainfall',
    displayName: 'Rainfall Amount',
    defaultSlotId: 'daily_total',
    timeSlots: [
      {
        slotId: 'morning',
        label: 'Morning (6AM-12PM)',
        description: 'Rainfall accumulation 6:00 AM to 12:00 PM',
        startHour: 6,
        endHour: 12,
        isRange: true,
        oddsMultiplier: 1.3,
        icon: '⛈️',
        reason: 'Morning showers - common weather pattern'
      },
      {
        slotId: 'afternoon',
        label: 'Afternoon (12PM-6PM)',
        description: 'Rainfall accumulation 12:00 PM to 6:00 PM',
        startHour: 12,
        endHour: 18,
        isRange: true,
        oddsMultiplier: 1.25,
        icon: '🌦️',
        reason: 'Afternoon thunderstorms - peak convection time'
      },
      {
        slotId: 'evening',
        label: 'Evening (6PM-12AM)',
        description: 'Rainfall accumulation 6:00 PM to 12:00 AM',
        startHour: 18,
        endHour: 24,
        isRange: true,
        oddsMultiplier: 1.35,
        icon: '🌙',
        reason: 'Evening/night rain - less predictable window'
      },
      {
        slotId: 'daily_total',
        label: 'Daily Total',
        description: 'Total rainfall accumulation (00:00-23:59)',
        startHour: 0,
        endHour: 23,
        isRange: true,
        oddsMultiplier: 1.0,
        icon: '💧',
        reason: 'Total daily water - most reliable measurement'
      }
    ]
  },
  
  wind: {
    category: 'wind',
    displayName: 'Wind Speed',
    defaultSlotId: 'daytime',
    timeSlots: [
      {
        slotId: 'morning',
        label: 'Morning Peak (6AM-12PM)',
        description: 'Maximum gust 6:00 AM to 12:00 PM',
        startHour: 6,
        endHour: 12,
        isRange: true,
        oddsMultiplier: 1.2,
        icon: '🌅',
        reason: 'Morning wind patterns - thermal mixing begins'
      },
      {
        slotId: 'daytime',
        label: 'Daytime Peak (12PM-6PM)',
        description: 'Maximum gust 12:00 PM to 6:00 PM',
        startHour: 12,
        endHour: 18,
        isRange: true,
        oddsMultiplier: 1.0,
        icon: '☀️',
        reason: 'Peak wind hours - strongest thermal activity'
      },
      {
        slotId: 'evening',
        label: 'Evening Peak (6PM-12AM)',
        description: 'Maximum gust 6:00 PM to 12:00 AM',
        startHour: 18,
        endHour: 24,
        isRange: true,
        oddsMultiplier: 1.25,
        icon: '🌙',
        reason: 'Evening gusts - storm fronts and cooling'
      }
    ]
  },
  
  snow: {
    category: 'snow',
    displayName: 'Snow Occurrence',
    defaultSlotId: 'daily',
    timeSlots: [
      {
        slotId: 'daily',
        label: 'Any Time Today',
        description: 'Snow occurrence anytime (00:00-23:59)',
        startHour: 0,
        endHour: 23,
        isRange: true,
        oddsMultiplier: 1.0,
        icon: '❄️',
        reason: 'Binary event - rare, either happens or doesn\'t'
      }
    ]
  },
  
  cloud_coverage: {
    category: 'cloud_coverage',
    displayName: 'Cloud Coverage',
    defaultSlotId: 'midday',
    timeSlots: [
      {
        slotId: 'morning',
        label: '10:00 AM',
        description: 'Cloud coverage at 10:00 AM local time',
        measurementHour: 10,
        toleranceMinutes: 30,
        isRange: false,
        oddsMultiplier: 1.15,
        icon: '🌅',
        reason: 'Morning cloud cover - early solar heating effects'
      },
      {
        slotId: 'midday',
        label: '2:00 PM',
        description: 'Cloud coverage at 2:00 PM local time',
        measurementHour: 14,
        toleranceMinutes: 30,
        isRange: false,
        oddsMultiplier: 1.0,
        icon: '☀️',
        reason: 'Peak sun hours - most representative conditions'
      },
      {
        slotId: 'evening',
        label: '7:00 PM',
        description: 'Cloud coverage at 7:00 PM local time',
        measurementHour: 19,
        toleranceMinutes: 30,
        isRange: false,
        oddsMultiplier: 1.2,
        icon: '🌙',
        reason: 'Sunset conditions - transitional period'
      }
    ]
  },
  
  pressure: {
    category: 'pressure',
    displayName: 'Atmospheric Pressure',
    defaultSlotId: 'morning',
    timeSlots: [
      {
        slotId: 'morning',
        label: '9:00 AM',
        description: 'Atmospheric pressure at 9:00 AM local time',
        measurementHour: 9,
        toleranceMinutes: 30,
        isRange: false,
        oddsMultiplier: 1.0,
        icon: '🌅',
        reason: "Morning pressure predicts day's weather patterns"
      },
      {
        slotId: 'evening',
        label: '9:00 PM',
        description: 'Atmospheric pressure at 9:00 PM local time',
        measurementHour: 21,
        toleranceMinutes: 30,
        isRange: false,
        oddsMultiplier: 1.1,
        icon: '🌙',
        reason: "Evening pressure indicates next day's weather"
      }
    ]
  },
  
  dew_point: {
    category: 'dew_point',
    displayName: 'Dew Point',
    defaultSlotId: 'evening',
    timeSlots: [
      {
        slotId: 'morning',
        label: '6:00 AM',
        description: 'Dew point at 6:00 AM local time',
        measurementHour: 6,
        toleranceMinutes: 30,
        isRange: false,
        oddsMultiplier: 1.1,
        icon: '🌅',
        reason: 'Morning humidity/fog indicator'
      },
      {
        slotId: 'evening',
        label: '6:00 PM',
        description: 'Dew point at 6:00 PM local time',
        measurementHour: 18,
        toleranceMinutes: 30,
        isRange: false,
        oddsMultiplier: 1.0,
        icon: '🌆',
        reason: 'Evening comfort level - humidity indicator'
      }
    ]
  }
};

/**
 * Get timing configuration for a category
 */
export function getCategoryTimingConfig(category: BettingCategory): CategoryTimingConfig {
  return CATEGORY_TIME_SLOTS[category];
}

/**
 * Get a specific time slot for a category
 */
export function getTimeSlot(category: BettingCategory, slotId: string): TimeSlotConfig | undefined {
  const config = CATEGORY_TIME_SLOTS[category];
  return config?.timeSlots.find(slot => slot.slotId === slotId);
}

/**
 * Get the default time slot for a category
 */
export function getDefaultTimeSlot(category: BettingCategory): TimeSlotConfig {
  const config = CATEGORY_TIME_SLOTS[category];
  return config.timeSlots.find(slot => slot.slotId === config.defaultSlotId) || config.timeSlots[0];
}

/**
 * Get all available time slots for a category
 */
export function getCategoryTimeSlots(category: BettingCategory): TimeSlotConfig[] {
  return CATEGORY_TIME_SLOTS[category]?.timeSlots || [];
}

/**
 * Check if a category has multiple time slots
 */
export function hasMultipleTimeSlots(category: BettingCategory): boolean {
  return getCategoryTimeSlots(category).length > 1;
}

/**
 * Format time slot for display
 */
export function formatTimeSlotDisplay(slot: TimeSlotConfig): string {
  return `${slot.icon} ${slot.label}`;
}

/**
 * Get timing label for display (backward compatibility)
 */
export function getCategoryTiming(category: BettingCategory): { 
  icon: string; 
  timingLabel: string; 
  description: string; 
  reason: string;
} {
  const defaultSlot = getDefaultTimeSlot(category);
  return {
    icon: defaultSlot.icon,
    timingLabel: defaultSlot.label,
    description: defaultSlot.description,
    reason: defaultSlot.reason
  };
}

/**
 * Get measurement time display
 */
export function getMeasurementTimeDisplay(category: BettingCategory, slotId?: string): string {
  const slot = slotId ? getTimeSlot(category, slotId) : getDefaultTimeSlot(category);
  return slot?.label || 'Unknown';
}

/**
 * Get measurement description
 */
export function getMeasurementDescription(category: BettingCategory, slotId?: string): string {
  const slot = slotId ? getTimeSlot(category, slotId) : getDefaultTimeSlot(category);
  return slot?.description || '';
}

/**
 * Check if a category's slot uses cumulative/range measurement
 */
export function isCumulativeMeasurement(category: BettingCategory, slotId?: string): boolean {
  const slot = slotId ? getTimeSlot(category, slotId) : getDefaultTimeSlot(category);
  return slot?.isRange || false;
}

/**
 * Get all timing configs as an array (for display purposes)
 */
export function getAllTimingConfigs(): CategoryTimingConfig[] {
  return Object.values(CATEGORY_TIME_SLOTS);
}
