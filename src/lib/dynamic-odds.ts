interface WeatherForecast {
  date: string;
  temp_min: number;
  temp_max: number;
  temp_day: number;
  rain_probability: number;
  condition: string;
}

interface DynamicOddsParams {
  predictionType: 'rain' | 'temperature';
  predictionValue: string;
  forecast: WeatherForecast[];
  daysAhead: number;
}

/**
 * Calculate dynamic odds based on weather forecast data
 * Lower probability events = higher odds
 * Higher probability events = lower odds
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

  if (predictionType === 'rain') {
    const rainProb = targetForecast.rain_probability;
    
    if (predictionValue === 'yes') {
      // Predicting rain
      // High rain probability = lower odds (more likely to win)
      // Low rain probability = higher odds (less likely to win)
      if (rainProb >= 70) return 1.3;
      if (rainProb >= 50) return 1.6;
      if (rainProb >= 30) return 2.2;
      if (rainProb >= 15) return 3.0;
      return 4.5; // Very low chance of rain
    } else {
      // Predicting no rain
      // Low rain probability = lower odds (more likely to win)
      // High rain probability = higher odds (less likely to win)
      if (rainProb <= 10) return 1.2;
      if (rainProb <= 25) return 1.5;
      if (rainProb <= 40) return 2.0;
      if (rainProb <= 60) return 2.8;
      return 4.0; // Very high chance of rain
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
