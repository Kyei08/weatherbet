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

interface CashOutCalculation {
  amount: number;
  percentage: number;
  timeBonus: number;
  weatherBonus: number;
  reasoning: string;
}

/**
 * Calculate dynamic cash-out value based on time remaining and weather conditions
 * @param stake - Original bet stake
 * @param odds - Bet odds
 * @param city - City for weather check
 * @param predictionType - 'rain' or 'temperature'
 * @param predictionValue - Predicted value
 * @param createdAt - Bet creation time
 * @param expiresAt - Bet expiration time (optional)
 * @returns Cash-out calculation with breakdown
 */
export const calculateDynamicCashOut = async (
  stake: number,
  odds: number,
  city: string,
  predictionType: string,
  predictionValue: string,
  createdAt: string,
  expiresAt?: string | null
): Promise<CashOutCalculation> => {
  const potentialWin = Math.floor(stake * odds);
  
  // Calculate time-based factor (0-1, how far through the bet period)
  const timeFactor = calculateTimeFactor(createdAt, expiresAt);
  
  // Calculate weather-based bonus (0-20% bonus)
  const weatherBonus = await calculateWeatherBonus(
    city,
    predictionType,
    predictionValue
  );
  
  // Cash-out scaling: starts below stake and scales up with time + weather
  // Early cashout should NEVER exceed stake (no free money)
  // Formula: cashout = stake * (BASE_RATE + timeFactor * TIME_SCALE + weatherBonus * WEATHER_SCALE)
  // Where the maximum possible value approaches but never exceeds potentialWin * 0.85
  const BASE_RATE = 0.40; // Start at 40% of stake (guaranteed loss if you cash out immediately)
  const TIME_SCALE = 0.35; // Time can add up to 35%
  const WEATHER_SCALE = 0.20; // Weather match can add up to 20%
  
  const rawPercentage = BASE_RATE + (timeFactor * TIME_SCALE) + (weatherBonus * WEATHER_SCALE);
  
  // Cap at 85% of potential win to maintain house edge
  const totalPercentage = Math.min(rawPercentage, 0.85);
  
  // Calculate final amount - use potentialWin as the ceiling
  const cashOutAmount = Math.floor(potentialWin * totalPercentage);
  
  // Generate reasoning
  const reasoning = generateReasoning(timeFactor * TIME_SCALE, weatherBonus * WEATHER_SCALE, totalPercentage);
  
  return {
    amount: cashOutAmount,
    percentage: Math.round(totalPercentage * 100),
    timeBonus: Math.round(timeFactor * TIME_SCALE * 100),
    weatherBonus: Math.round(weatherBonus * WEATHER_SCALE * 100),
    reasoning,
  };
};

/**
 * Calculate time factor (0 to 1) — how far through the bet period we are
 * Returns a value from 0 (just placed) to 1 (about to expire)
 */
const calculateTimeFactor = (createdAt: string, expiresAt?: string | null): number => {
  if (!expiresAt) {
    const betAge = Date.now() - new Date(createdAt).getTime();
    const hoursPassed = betAge / (60 * 60 * 1000);
    return Math.min(hoursPassed, 1.0);
  }
  
  const now = Date.now();
  const created = new Date(createdAt).getTime();
  const expires = new Date(expiresAt).getTime();
  
  const totalDuration = expires - created;
  const elapsed = now - created;
  return Math.min(Math.max(elapsed / totalDuration, 0), 1);
};

/**
 * Calculate weather-based bonus (0-20%)
 * Higher bonus if current weather suggests bet is likely to win
 */
const calculateWeatherBonus = async (
  city: string,
  predictionType: string,
  predictionValue: string
): Promise<number> => {
  try {
    // Fetch current weather
    const { data, error } = await supabase.functions.invoke('get-weather', {
      body: { city },
    });
    
    if (error || !data) {
      console.error('Weather fetch error:', error);
      return 0; // No bonus if can't fetch weather
    }
    
    const weather: WeatherData = data;
    
    if (predictionType === 'rain') {
      const isCurrentlyRaining = weather.weather.some(w => 
        w.main.toLowerCase() === 'rain' || 
        w.description.toLowerCase().includes('rain')
      );
      const predictedRain = predictionValue.toLowerCase() === 'yes';
      
      // If current weather matches prediction, higher bonus
      if (isCurrentlyRaining === predictedRain) {
        return 0.20; // 20% bonus if weather matches
      } else {
        return 0; // No bonus if weather doesn't match
      }
    } else if (predictionType === 'temperature') {
      const currentTemp = Math.round(weather.main.temp);
      
      // Handle temperature ranges
      if (predictionValue.includes('-')) {
        const [min, max] = predictionValue.split('-').map(t => parseInt(t));
        const isInRange = currentTemp >= min && currentTemp <= max;
        
        if (isInRange) {
          return 0.20; // 20% bonus if in range
        } else {
          // Partial bonus based on proximity
          const midpoint = (min + max) / 2;
          const range = max - min;
          const distance = Math.abs(currentTemp - midpoint);
          
          if (distance <= range) {
            return 0.10; // 10% bonus if close
          }
          return 0;
        }
      } else {
        // Exact temperature prediction
        const predictedTemp = parseInt(predictionValue);
        const difference = Math.abs(currentTemp - predictedTemp);
        
        if (difference === 0) return 0.20; // Exact match
        if (difference === 1) return 0.15; // 1 degree off
        if (difference === 2) return 0.10; // 2 degrees off
        if (difference <= 4) return 0.05; // 3-4 degrees off
        return 0; // Too far off
      }
    }
    
    return 0;
  } catch (error) {
    console.error('Error calculating weather bonus:', error);
    return 0;
  }
};

/**
 * Generate human-readable reasoning for the cash-out offer
 */
const generateReasoning = (
  timeBonus: number,
  weatherBonus: number,
  totalPercentage: number
): string => {
  const reasons: string[] = [];
  
  if (timeBonus >= 0.20) {
    reasons.push('Bet is close to expiration');
  } else if (timeBonus >= 0.10) {
    reasons.push('Bet is progressing');
  }
  
  if (weatherBonus >= 0.15) {
    reasons.push('Current weather strongly favors your prediction');
  } else if (weatherBonus >= 0.05) {
    reasons.push('Current weather somewhat favors your prediction');
  } else if (weatherBonus === 0 && timeBonus > 0) {
    reasons.push('Weather conditions uncertain');
  }
  
  if (totalPercentage >= 0.85) {
    return '🔥 Excellent cash-out value! ' + reasons.join('. ');
  } else if (totalPercentage >= 0.75) {
    return '💰 Good cash-out value. ' + reasons.join('. ');
  } else if (totalPercentage >= 0.65) {
    return '⚖️ Fair cash-out value. ' + reasons.join('. ');
  } else {
    return '⏰ Early cash-out. ' + reasons.join('. ');
  }
};

/**
 * Calculate dynamic cash-out for parlay
 * Uses the worst-performing leg as the basis
 */
export const calculateDynamicParlayCashOut = async (
  totalStake: number,
  combinedOdds: number,
  legs: Array<{
    city: string;
    prediction_type: string;
    prediction_value: string;
  }>,
  createdAt: string,
  expiresAt?: string | null
): Promise<CashOutCalculation> => {
  const potentialWin = Math.floor(totalStake * combinedOdds);
  
  // Calculate time factor (0 to 1)
  const timeFactor = calculateTimeFactor(createdAt, expiresAt);
  
  // Calculate weather bonus for each leg, use the minimum (weakest leg)
  const weatherBonuses = await Promise.all(
    legs.map(leg => 
      calculateWeatherBonus(leg.city, leg.prediction_type, leg.prediction_value)
    )
  );
  
  // Use minimum weather bonus (weakest link in the chain)
  const weatherBonus = Math.min(...weatherBonuses);
  
  // Parlay cashout: lower base, same scaling logic
  const BASE_RATE = 0.30; // 30% base for parlays (riskier)
  const TIME_SCALE = 0.35;
  const WEATHER_SCALE = 0.15;
  
  const rawPercentage = BASE_RATE + (timeFactor * TIME_SCALE) + (weatherBonus * WEATHER_SCALE);
  const totalPercentage = Math.min(rawPercentage, 0.80); // Max 80% for parlays
  
  const cashOutAmount = Math.floor(potentialWin * totalPercentage);
  
  const timeValue = timeFactor * TIME_SCALE;
  const weatherValue = weatherBonus * WEATHER_SCALE;
  const reasoning = generateParlayReasoning(timeValue, weatherValue, weatherBonuses, totalPercentage);
  
  return {
    amount: cashOutAmount,
    percentage: Math.round(totalPercentage * 100),
    timeBonus: Math.round(timeValue * 100),
    weatherBonus: Math.round(weatherValue * 100),
    reasoning,
  };
};

/**
 * Generate reasoning for parlay cash-out
 */
const generateParlayReasoning = (
  timeBonus: number,
  weatherBonus: number,
  allWeatherBonuses: number[],
  totalPercentage: number
): string => {
  const reasons: string[] = [];
  
  if (timeBonus >= 0.20) {
    reasons.push('Parlay is close to expiration');
  } else if (timeBonus >= 0.10) {
    reasons.push('Parlay is progressing');
  }
  
  const allLegsGood = allWeatherBonuses.every(b => b >= 0.15);
  const someLegsGood = allWeatherBonuses.some(b => b >= 0.15);
  
  if (allLegsGood) {
    reasons.push('All legs looking strong');
  } else if (someLegsGood) {
    reasons.push('Some legs looking favorable');
  } else {
    reasons.push('Weather conditions mixed');
  }
  
  if (totalPercentage >= 0.80) {
    return '🔥 Excellent parlay cash-out! ' + reasons.join('. ');
  } else if (totalPercentage >= 0.70) {
    return '💰 Strong parlay value. ' + reasons.join('. ');
  } else if (totalPercentage >= 0.60) {
    return '⚖️ Fair parlay value. ' + reasons.join('. ');
  } else {
    return '⏰ Early parlay cash-out. ' + reasons.join('. ');
  }
};
