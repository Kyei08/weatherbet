interface WeatherForecast {
  date: string;
  temp_min: number;
  temp_max: number;
  temp_day: number;
  rain_probability: number;
  condition: string;
}

interface DynamicOddsParams {
  predictionType: 'rain' | 'temperature' | 'rainfall' | 'snow' | 'wind' | 'dew_point' | 'pressure' | 'cloud_coverage';
  predictionValue: string;
  forecast: WeatherForecast[];
  daysAhead: number;
}

// House edge configuration (10% = 0.90 multiplier for fair payouts)
const HOUSE_EDGE = 0.90;

/**
 * Calculate dynamic odds based on actual weather probabilities with house edge
 * Formula: odds = (100 / probability) * house_edge
 * This ensures fair, transparent odds that reflect real weather data
 */
export const calculateDynamicOdds = ({
  predictionType,
  predictionValue,
  forecast,
  daysAhead,
}: DynamicOddsParams): number => {
  // Get the forecast for the target date
  const targetForecast = forecast[Math.min(daysAhead - 1, forecast.length - 1)];
  if (!targetForecast) return 2.0; // Default if no forecast available

  // Handle new categories with static odds for now
  if (['rainfall', 'snow', 'wind', 'dew_point', 'pressure', 'cloud_coverage'].includes(predictionType)) {
    return calculateCategoryOdds(predictionType as any, predictionValue);
  }

  if (predictionType === 'rain') {
    const rainProb = targetForecast.rain_probability;
    
    if (predictionValue === 'yes') {
      // Predicting rain - use actual rain probability
      // Ensure probability is at least 1% to avoid extreme odds
      const probability = Math.max(rainProb, 1);
      const odds = (100 / probability) * HOUSE_EDGE;
      // Cap maximum odds at 50x for safety
      return Math.min(Math.max(odds, 1.01), 50);
    } else {
      // Predicting no rain - use inverse probability
      const noRainProb = 100 - rainProb;
      const probability = Math.max(noRainProb, 1);
      const odds = (100 / probability) * HOUSE_EDGE;
      // Cap maximum odds at 50x for safety
      return Math.min(Math.max(odds, 1.01), 50);
    }
  }

  if (predictionType === 'temperature') {
    // Parse temperature range (e.g., "20-25")
    const [min, max] = predictionValue.split('-').map(Number);
    const forecastTemp = targetForecast.temp_day;
    
    // Calculate distance from forecast to range
    let distance = 0;
    if (forecastTemp < min) {
      distance = min - forecastTemp;
    } else if (forecastTemp > max) {
      distance = forecastTemp - max;
    }
    // If within range, distance = 0

    // Base odds on range width
    const rangeWidth = max - min;
    let baseOdds = 1.5;
    if (rangeWidth <= 5) baseOdds = 3.5;
    else if (rangeWidth <= 10) baseOdds = 2.2;
    else if (rangeWidth <= 15) baseOdds = 1.8;

    // Adjust odds based on distance from forecast
    if (distance === 0) {
      // Forecast is within the predicted range - very likely to win
      return Math.max(1.2, baseOdds * 0.4);
    } else if (distance <= 3) {
      // Close to the range
      return baseOdds * 0.7;
    } else if (distance <= 7) {
      // Moderate distance
      return baseOdds * 1.0;
    } else if (distance <= 12) {
      // Far from range
      return baseOdds * 1.4;
    } else {
      // Very far - unlikely to win
      return baseOdds * 2.0;
    }
  }

  return 2.0; // Default fallback
};

/**
 * Format odds with visual indicator for live updates
 */
export const formatLiveOdds = (odds: number): string => {
  return `${odds.toFixed(2)}x`;
};

/**
 * Get the actual probability percentage for display
 */
export const getProbabilityPercentage = (
  predictionType: 'rain' | 'temperature' | 'rainfall' | 'snow' | 'wind' | 'dew_point' | 'pressure' | 'cloud_coverage',
  predictionValue: string,
  forecast: WeatherForecast[],
  daysAhead: number
): number => {
  const targetForecast = forecast[Math.min(daysAhead - 1, forecast.length - 1)];
  if (!targetForecast) return 50;

  if (predictionType === 'rain') {
    return predictionValue === 'yes' 
      ? targetForecast.rain_probability 
      : 100 - targetForecast.rain_probability;
  }

  // For temperature, estimate based on forecast temperature
  const [min, max] = predictionValue.split('-').map(Number);
  const forecastTemp = targetForecast.temp_day;
  
  if (forecastTemp >= min && forecastTemp <= max) {
    return 70; // High probability if forecast is in range
  }
  
  const distance = forecastTemp < min ? min - forecastTemp : forecastTemp - max;
  if (distance <= 3) return 50;
  if (distance <= 7) return 30;
  return 15;
};

/**
 * Calculate odds for new weather categories
 */
export const calculateCategoryOdds = (
  predictionType: 'rainfall' | 'snow' | 'wind' | 'dew_point' | 'pressure' | 'cloud_coverage',
  predictionValue: string
): number => {
  // For now, use static odds based on the category
  // These can be made dynamic when we integrate more detailed weather data
  
  if (predictionType === 'snow') {
    // Snow yes/no
    return predictionValue === 'yes' ? 3.5 : 1.5;
  }
  
  // For range-based predictions, use the odds from the ranges
  if (predictionType === 'rainfall') {
    const rainfallOdds: { [key: string]: number } = {
      '0-5': 2.0,
      '5-10': 2.5,
      '10-20': 3.0,
      '20-999': 4.0,
    };
    return rainfallOdds[predictionValue] || 2.0;
  }
  
  if (predictionType === 'wind') {
    const windOdds: { [key: string]: number } = {
      '0-10': 2.0,
      '10-20': 2.2,
      '20-30': 2.5,
      '30-999': 3.5,
    };
    return windOdds[predictionValue] || 2.0;
  }
  
  if (predictionType === 'dew_point') {
    const dewPointOdds: { [key: string]: number } = {
      '0-10': 2.0,
      '10-15': 2.2,
      '15-20': 2.5,
      '20-999': 3.0,
    };
    return dewPointOdds[predictionValue] || 2.0;
  }
  
  if (predictionType === 'pressure') {
    const pressureOdds: { [key: string]: number } = {
      '980-1000': 2.5,
      '1000-1020': 2.0,
      '1020-1040': 2.5,
    };
    return pressureOdds[predictionValue] || 2.0;
  }
  
  if (predictionType === 'cloud_coverage') {
    const cloudOdds: { [key: string]: number } = {
      '0-25': 2.5,
      '25-50': 2.2,
      '50-75': 2.2,
      '75-100': 2.5,
    };
    return cloudOdds[predictionValue] || 2.0;
  }
  
  return 2.0;
};

/**
 * Get odds change indicator based on comparison
 */
export const getOddsChangeIndicator = (currentOdds: number, baseOdds: number): {
  icon: '📈' | '📉' | '—';
  text: string;
  color: string;
} => {
  const diff = currentOdds - baseOdds;
  if (Math.abs(diff) < 0.1) {
    return { icon: '—', text: 'Stable', color: 'text-muted-foreground' };
  }
  if (diff > 0) {
    return { icon: '📈', text: 'Rising', color: 'text-success' };
  }
  return { icon: '📉', text: 'Falling', color: 'text-destructive' };
};
