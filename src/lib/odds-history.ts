import { calculateDynamicOdds } from './dynamic-odds';

export interface OddsHistoryPoint {
  timestamp: string;
  label: string;
  odds: number;
  probability: number;
}

interface WeatherForecast {
  date: string;
  temp_min: number;
  temp_max: number;
  temp_day: number;
  rain_probability: number;
  condition: string;
  humidity: number;
  wind_speed: number;
  description: string;
  icon: string;
}

/**
 * Generates historical odds data showing how odds changed over time
 * based on simulated weather forecast updates
 */
export const generateOddsHistory = async (
  city: string,
  predictionType: 'rain' | 'temperature',
  predictionValue: string,
  createdAt: string,
  expiresAt?: string | null
): Promise<OddsHistoryPoint[]> => {
  try {
    // Fetch current weather forecast
    const response = await fetch(
      'https://imyzcwgskjngwvcadrjn.supabase.co/functions/v1/get-weather',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city }),
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch weather data');
      return [];
    }

    const weatherData = await response.json();
    const forecast = weatherData.forecast as WeatherForecast[];

    if (!forecast || forecast.length === 0) {
      return [];
    }

    const betCreated = new Date(createdAt);
    const betExpires = expiresAt ? new Date(expiresAt) : new Date(betCreated.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();

    // Generate 10 historical points from bet creation to now
    const historyPoints: OddsHistoryPoint[] = [];
    const numPoints = 10;

    for (let i = 0; i < numPoints; i++) {
      const timeProgress = i / (numPoints - 1);
      const timestamp = new Date(
        betCreated.getTime() + (now.getTime() - betCreated.getTime()) * timeProgress
      );

      // Calculate days ahead from this historical point
      const daysAhead = Math.max(
        0,
        Math.floor((betExpires.getTime() - timestamp.getTime()) / (24 * 60 * 60 * 1000))
      );

      // Simulate forecast evolution - forecasts become more accurate over time
      const forecastAccuracy = 1 - timeProgress * 0.3; // Forecasts get more stable
      const simulatedForecast = forecast.map(day => ({
        ...day,
        rain_probability: Math.max(
          0,
          Math.min(100, day.rain_probability + (Math.random() - 0.5) * 20 * forecastAccuracy)
        ),
        temp_day: day.temp_day + (Math.random() - 0.5) * 3 * forecastAccuracy,
        temp_min: day.temp_min + (Math.random() - 0.5) * 3 * forecastAccuracy,
        temp_max: day.temp_max + (Math.random() - 0.5) * 3 * forecastAccuracy,
      }));

      // Calculate odds for this historical point
      const odds = calculateDynamicOdds({
        predictionType,
        predictionValue,
        forecast: simulatedForecast,
        daysAhead,
      });

      // Calculate probability (inverse of odds with house edge removed)
      const probability = (100 / odds) * 1.1; // Remove 10% house edge for display

      historyPoints.push({
        timestamp: timestamp.toISOString(),
        label: i === 0 ? 'Start' : i === numPoints - 1 ? 'Now' : `${Math.floor(timeProgress * 100)}%`,
        odds: Number(odds.toFixed(2)),
        probability: Number(probability.toFixed(1)),
      });
    }

    return historyPoints;
  } catch (error) {
    console.error('Error generating odds history:', error);
    return [];
  }
};

/**
 * Generates historical odds for parlay bets
 */
export const generateParlayOddsHistory = async (
  parlayLegs: Array<{
    city: string;
    prediction_type: string;
    prediction_value: string;
  }>,
  combinedOdds: number,
  createdAt: string,
  expiresAt?: string | null
): Promise<OddsHistoryPoint[]> => {
  try {
    // For parlays, we'll generate a simplified history based on the combined odds
    const betCreated = new Date(createdAt);
    const now = new Date();

    const historyPoints: OddsHistoryPoint[] = [];
    const numPoints = 10;

    for (let i = 0; i < numPoints; i++) {
      const timeProgress = i / (numPoints - 1);
      const timestamp = new Date(
        betCreated.getTime() + (now.getTime() - betCreated.getTime()) * timeProgress
      );

      // Simulate odds fluctuation - parlays are more volatile
      const volatility = (Math.random() - 0.5) * 0.4 * (1 - timeProgress);
      const odds = combinedOdds * (1 + volatility);
      const probability = (100 / odds) * 1.1;

      historyPoints.push({
        timestamp: timestamp.toISOString(),
        label: i === 0 ? 'Start' : i === numPoints - 1 ? 'Now' : `${Math.floor(timeProgress * 100)}%`,
        odds: Number(odds.toFixed(2)),
        probability: Number(probability.toFixed(1)),
      });
    }

    return historyPoints;
  } catch (error) {
    console.error('Error generating parlay odds history:', error);
    return [];
  }
};
