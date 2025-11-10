import { supabase } from '@/integrations/supabase/client';

interface WeatherData {
  main: {
    temp: number;
  };
  weather: Array<{
    main: string;
    description: string;
  }>;
}

export interface CashOutHistoryPoint {
  timestamp: number;
  amount: number;
  percentage: number;
  timeBonus: number;
  weatherBonus: number;
  label: string;
}

/**
 * Generate historical cash-out values for visualization
 * Simulates what the cash-out value would have been at different time points
 */
export const generateCashOutHistory = async (
  stake: number,
  odds: number,
  city: string,
  predictionType: string,
  predictionValue: string,
  createdAt: string,
  expiresAt?: string | null
): Promise<CashOutHistoryPoint[]> => {
  const potentialWin = Math.floor(stake * odds);
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const expires = expiresAt ? new Date(expiresAt).getTime() : created + (60 * 60 * 1000);
  
  // Generate 10 time points from creation to current time
  const numPoints = Math.min(10, Math.floor((now - created) / (5 * 60 * 1000)) + 2); // At least 2 points, max 10
  const points: CashOutHistoryPoint[] = [];
  
  // Fetch current weather once for consistency
  let weatherBonus = 0;
  try {
    const { data, error } = await supabase.functions.invoke('get-weather', {
      body: { city },
    });
    
    if (!error && data) {
      weatherBonus = await calculateWeatherBonus(data, predictionType, predictionValue);
    }
  } catch (error) {
    console.error('Error fetching weather for history:', error);
  }
  
  for (let i = 0; i < numPoints; i++) {
    // Calculate timestamp for this point
    const progress = i / (numPoints - 1);
    const timestamp = created + (now - created) * progress;
    
    // Calculate time-based bonus at this point
    const BASE_RATE = 0.55;
    const totalDuration = expires - created;
    const elapsed = timestamp - created;
    const progressRatio = Math.min(Math.max(elapsed / totalDuration, 0), 1);
    const timeBonus = 0.25 * Math.pow(progressRatio, 0.7);
    
    // Total percentage
    const totalPercentage = Math.min(BASE_RATE + timeBonus + weatherBonus, 0.95);
    const amount = Math.floor(potentialWin * totalPercentage);
    
    // Create label
    const date = new Date(timestamp);
    const label = i === 0 ? 'Start' : 
                  i === numPoints - 1 ? 'Now' :
                  date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    points.push({
      timestamp,
      amount,
      percentage: Math.round(totalPercentage * 100),
      timeBonus: Math.round(timeBonus * 100),
      weatherBonus: Math.round(weatherBonus * 100),
      label,
    });
  }
  
  return points;
};

/**
 * Generate historical cash-out values for parlay
 */
export const generateParlayCashOutHistory = async (
  totalStake: number,
  combinedOdds: number,
  legs: Array<{
    city: string;
    prediction_type: string;
    prediction_value: string;
  }>,
  createdAt: string,
  expiresAt?: string | null
): Promise<CashOutHistoryPoint[]> => {
  const potentialWin = Math.floor(totalStake * combinedOdds);
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const expires = expiresAt ? new Date(expiresAt).getTime() : created + (60 * 60 * 1000);
  
  const numPoints = Math.min(10, Math.floor((now - created) / (5 * 60 * 1000)) + 2);
  const points: CashOutHistoryPoint[] = [];
  
  // Fetch weather for all legs once
  const weatherBonuses = await Promise.all(
    legs.map(async (leg) => {
      try {
        const { data, error } = await supabase.functions.invoke('get-weather', {
          body: { city: leg.city },
        });
        
        if (!error && data) {
          return await calculateWeatherBonus(data, leg.prediction_type, leg.prediction_value);
        }
      } catch (error) {
        console.error(`Error fetching weather for ${leg.city}:`, error);
      }
      return 0;
    })
  );
  
  const weatherBonus = Math.min(...weatherBonuses);
  
  for (let i = 0; i < numPoints; i++) {
    const progress = i / (numPoints - 1);
    const timestamp = created + (now - created) * progress;
    
    const BASE_RATE = 0.50; // Lower for parlays
    const totalDuration = expires - created;
    const elapsed = timestamp - created;
    const progressRatio = Math.min(Math.max(elapsed / totalDuration, 0), 1);
    const timeBonus = 0.25 * Math.pow(progressRatio, 0.7);
    
    const totalPercentage = Math.min(BASE_RATE + timeBonus + weatherBonus, 0.90);
    const amount = Math.floor(potentialWin * totalPercentage);
    
    const date = new Date(timestamp);
    const label = i === 0 ? 'Start' : 
                  i === numPoints - 1 ? 'Now' :
                  date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    points.push({
      timestamp,
      amount,
      percentage: Math.round(totalPercentage * 100),
      timeBonus: Math.round(timeBonus * 100),
      weatherBonus: Math.round(weatherBonus * 100),
      label,
    });
  }
  
  return points;
};

/**
 * Calculate weather-based bonus
 */
const calculateWeatherBonus = async (
  weather: WeatherData,
  predictionType: string,
  predictionValue: string
): Promise<number> => {
  if (predictionType === 'rain') {
    const isCurrentlyRaining = weather.weather.some(w => 
      w.main.toLowerCase() === 'rain' || 
      w.description.toLowerCase().includes('rain')
    );
    const predictedRain = predictionValue.toLowerCase() === 'yes';
    
    if (isCurrentlyRaining === predictedRain) {
      return 0.20;
    } else {
      return 0;
    }
  } else if (predictionType === 'temperature') {
    const currentTemp = Math.round(weather.main.temp);
    
    if (predictionValue.includes('-')) {
      const [min, max] = predictionValue.split('-').map(t => parseInt(t));
      const isInRange = currentTemp >= min && currentTemp <= max;
      
      if (isInRange) {
        return 0.20;
      } else {
        const midpoint = (min + max) / 2;
        const range = max - min;
        const distance = Math.abs(currentTemp - midpoint);
        
        if (distance <= range) {
          return 0.10;
        }
        return 0;
      }
    } else {
      const predictedTemp = parseInt(predictionValue);
      const difference = Math.abs(currentTemp - predictedTemp);
      
      if (difference === 0) return 0.20;
      if (difference === 1) return 0.15;
      if (difference === 2) return 0.10;
      if (difference <= 4) return 0.05;
      return 0;
    }
  }
  
  return 0;
};
