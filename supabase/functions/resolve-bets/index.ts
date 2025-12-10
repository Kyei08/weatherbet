import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WeatherData {
  main: {
    temp: number;
    humidity: number;
    pressure: number;
  };
  weather: Array<{
    main: string;
    description: string;
  }>;
  wind?: {
    speed: number;
    gust?: number;
  };
  clouds?: {
    all: number;
  };
  rain?: {
    '1h'?: number;
    '3h'?: number;
  };
  snow?: {
    '1h'?: number;
    '3h'?: number;
  };
}

// Multi-time slot configuration for each category
// Each category can have multiple measurement times for deeper betting strategy
interface TimeSlot {
  slotId: string;
  hour?: number;         // For point-in-time measurements
  startHour?: number;    // For range measurements
  endHour?: number;      // For range measurements
  tolerance: number;     // Minutes tolerance
  isRange: boolean;      // true = range/cumulative, false = point-in-time
}

interface CategoryTimingConfig {
  defaultSlotId: string;
  slots: TimeSlot[];
}

const CATEGORY_TIMING: Record<string, CategoryTimingConfig> = {
  temperature: {
    defaultSlotId: 'peak',
    slots: [
      { slotId: 'morning', hour: 9, tolerance: 30, isRange: false },
      { slotId: 'peak', hour: 14, tolerance: 30, isRange: false },
      { slotId: 'evening', hour: 20, tolerance: 30, isRange: false }
    ]
  },
  rain: {
    defaultSlotId: 'daily',
    slots: [
      { slotId: 'daily', startHour: 0, endHour: 23, tolerance: 0, isRange: true }
    ]
  },
  rainfall: {
    defaultSlotId: 'daily_total',
    slots: [
      { slotId: 'morning', startHour: 6, endHour: 12, tolerance: 0, isRange: true },
      { slotId: 'afternoon', startHour: 12, endHour: 18, tolerance: 0, isRange: true },
      { slotId: 'evening', startHour: 18, endHour: 24, tolerance: 0, isRange: true },
      { slotId: 'daily_total', startHour: 0, endHour: 23, tolerance: 0, isRange: true }
    ]
  },
  wind: {
    defaultSlotId: 'daytime',
    slots: [
      { slotId: 'morning', startHour: 6, endHour: 12, tolerance: 0, isRange: true },
      { slotId: 'daytime', startHour: 12, endHour: 18, tolerance: 0, isRange: true },
      { slotId: 'evening', startHour: 18, endHour: 24, tolerance: 0, isRange: true }
    ]
  },
  snow: {
    defaultSlotId: 'daily',
    slots: [
      { slotId: 'daily', startHour: 0, endHour: 23, tolerance: 0, isRange: true }
    ]
  },
  cloud_coverage: {
    defaultSlotId: 'midday',
    slots: [
      { slotId: 'morning', hour: 10, tolerance: 30, isRange: false },
      { slotId: 'midday', hour: 14, tolerance: 30, isRange: false },
      { slotId: 'evening', hour: 19, tolerance: 30, isRange: false }
    ]
  },
  pressure: {
    defaultSlotId: 'morning',
    slots: [
      { slotId: 'morning', hour: 9, tolerance: 30, isRange: false },
      { slotId: 'evening', hour: 21, tolerance: 30, isRange: false }
    ]
  },
  dew_point: {
    defaultSlotId: 'evening',
    slots: [
      { slotId: 'morning', hour: 6, tolerance: 30, isRange: false },
      { slotId: 'evening', hour: 18, tolerance: 30, isRange: false }
    ]
  },
  humidity: {
    defaultSlotId: 'noon',
    slots: [
      { slotId: 'noon', hour: 12, tolerance: 30, isRange: false }
    ]
  }
};

// City coordinates for timezone calculations
const CITY_COORDS: Record<string, { lat: number; lon: number; tzOffset: number }> = {
  'New York': { lat: 40.7128, lon: -74.0060, tzOffset: -5 },
  'Tokyo': { lat: 35.6762, lon: 139.6503, tzOffset: 9 },
  'London': { lat: 51.5074, lon: -0.1278, tzOffset: 0 },
  'Paris': { lat: 48.8566, lon: 2.3522, tzOffset: 1 },
  'Sydney': { lat: -33.8688, lon: 151.2093, tzOffset: 10 },
  'Cape Town': { lat: -33.9249, lon: 18.4241, tzOffset: 2 },
  'Sao Paulo': { lat: -23.5505, lon: -46.6333, tzOffset: -3 },
  'Mumbai': { lat: 19.0760, lon: 72.8777, tzOffset: 5.5 },
  'Cairo': { lat: 30.0444, lon: 31.2357, tzOffset: 2 },
  'Toronto': { lat: 43.6532, lon: -79.3832, tzOffset: -5 },
};

// Get local hour for a city
function getCityLocalHour(city: string): number {
  const now = new Date();
  const utcHour = now.getUTCHours() + now.getUTCMinutes() / 60;
  const cityInfo = CITY_COORDS[city];
  if (!cityInfo) return utcHour;
  
  let localHour = utcHour + cityInfo.tzOffset;
  if (localHour < 0) localHour += 24;
  if (localHour >= 24) localHour -= 24;
  return localHour;
}

// Check if it's time to resolve a bet based on category timing and slot
function isTimeToResolve(city: string, predictionType: string, slotId?: string): boolean {
  const config = CATEGORY_TIMING[predictionType];
  if (!config) return true; // Default: resolve immediately
  
  // Find the specific slot or use default
  const targetSlotId = slotId || config.defaultSlotId;
  const slot = config.slots.find(s => s.slotId === targetSlotId) || config.slots[0];
  if (!slot) return true;
  
  const localHour = getCityLocalHour(city);
  
  // For range-based measurements, check if we're past the end hour
  if (slot.isRange) {
    const endHour = slot.endHour || 23;
    return localHour >= endHour;
  }
  
  // For point-in-time measurements, check if we're past the measurement time
  const measurementHour = slot.hour || 12;
  const toleranceHours = slot.tolerance / 60;
  return localHour >= (measurementHour + toleranceHours);
}

// Helper to check if a value falls within a range like "10-20" or "10°C - 20°C"
function isInRange(actual: number, rangeStr: string): boolean {
  // Clean up the string and extract numbers
  const cleaned = rangeStr.replace(/[°C%hPakm\/hmm]/gi, '').trim();
  const parts = cleaned.split(/[-–]/);
  
  if (parts.length === 2) {
    const min = parseFloat(parts[0].trim());
    const max = parseFloat(parts[1].trim());
    if (!isNaN(min) && !isNaN(max)) {
      return actual >= min && actual <= max;
    }
  }
  
  // Single value with tolerance
  const singleValue = parseFloat(cleaned);
  if (!isNaN(singleValue)) {
    return Math.abs(actual - singleValue) <= 2;
  }
  
  return false;
}

// Evaluate a prediction against actual weather using smart timing logic
function evaluatePrediction(predictionType: string, predictionValue: string, weather: WeatherData): boolean {
  const type = predictionType.toLowerCase();
  const value = predictionValue.toLowerCase();

  switch (type) {
    case 'rain': {
      // Binary: Did it rain anytime today?
      const isRaining = weather.weather.some(w => 
        w.main.toLowerCase() === 'rain' || 
        w.description.toLowerCase().includes('rain')
      );
      const rainAmount = (weather.rain?.['1h'] || 0) + (weather.rain?.['3h'] || 0);
      return (value === 'yes') === (isRaining || rainAmount > 0);
    }
    
    case 'rainfall': {
      // Daily total rainfall accumulation
      const rainAmount = (weather.rain?.['1h'] || 0) + (weather.rain?.['3h'] || 0);
      return isInRange(rainAmount, predictionValue);
    }
    
    case 'temperature': {
      // Temperature at 2:00 PM (peak daily temp)
      const actualTemp = Math.round(weather.main.temp);
      console.log(`Temperature check: actual=${actualTemp}°C, prediction=${predictionValue}`);
      return isInRange(actualTemp, predictionValue);
    }
    
    case 'wind':
    case 'wind_speed': {
      // Maximum wind gust speed
      const windSpeed = weather.wind?.speed || 0;
      const windGust = weather.wind?.gust || windSpeed;
      const maxWindKmh = Math.max(windSpeed, windGust) * 3.6;
      console.log(`Wind check: max gust=${maxWindKmh.toFixed(1)} km/h, prediction=${predictionValue}`);
      return isInRange(maxWindKmh, predictionValue);
    }
    
    case 'snow': {
      // Binary: Did it snow anytime today?
      const isSnowing = weather.weather.some(w => 
        w.main.toLowerCase() === 'snow' || 
        w.description.toLowerCase().includes('snow')
      );
      const snowAmount = (weather.snow?.['1h'] || 0) + (weather.snow?.['3h'] || 0);
      return (value === 'yes') === (isSnowing || snowAmount > 0);
    }
    
    case 'humidity': {
      const humidity = weather.main.humidity;
      return isInRange(humidity, predictionValue);
    }
    
    case 'pressure': {
      // Pressure at 9:00 AM
      const pressure = weather.main.pressure;
      console.log(`Pressure check: actual=${pressure} hPa, prediction=${predictionValue}`);
      return isInRange(pressure, predictionValue);
    }
    
    case 'cloud_coverage':
    case 'clouds': {
      // Cloud coverage at solar noon
      const clouds = weather.clouds?.all || 0;
      console.log(`Cloud coverage check: actual=${clouds}%, prediction=${predictionValue}`);
      return isInRange(clouds, predictionValue);
    }
    
    case 'dew_point': {
      // Dew point at 6:00 PM
      const temp = weather.main.temp;
      const humidity = weather.main.humidity;
      const dewPoint = temp - ((100 - humidity) / 5);
      console.log(`Dew point check: actual=${dewPoint.toFixed(1)}°C, prediction=${predictionValue}`);
      return isInRange(dewPoint, predictionValue);
    }
    
    default:
      console.log(`Unknown prediction type: ${type}`);
      return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openWeatherApiKey = Deno.env.get('OPENWEATHER_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    console.log('Starting bet resolution process...');

    const now = new Date().toISOString();

    // Helper function to create notification
    async function createNotification(
      userId: string,
      title: string,
      message: string,
      type: string,
      referenceId?: string,
      referenceType?: string
    ) {
      try {
        await supabase.from('notifications').insert({
          user_id: userId,
          title,
          message,
          type,
          reference_id: referenceId,
          reference_type: referenceType
        });
        console.log(`Notification created for user ${userId}: ${title}`);
      } catch (error) {
        console.error('Failed to create notification:', error);
      }
    }

    // ============================================
    // 1. RESOLVE SINGLE BETS
    // ============================================
    // Get bets where target_date OR expires_at has passed
    const { data: pendingBets, error: betsError } = await supabase
      .from('bets')
      .select('*')
      .eq('result', 'pending')
      .is('cashed_out_at', null)
      .or(`target_date.lt.${now},expires_at.lt.${now}`);

    if (betsError) {
      console.error('Error fetching pending bets:', betsError);
      throw betsError;
    }

    console.log(`Found ${pendingBets?.length || 0} pending bets to resolve`);

    let resolvedBets = 0;
    const weatherCache: Record<string, WeatherData> = {};

    // Helper to get weather with caching
    async function getWeather(city: string): Promise<WeatherData | null> {
      if (weatherCache[city]) {
        return weatherCache[city];
      }
      
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${openWeatherApiKey}&units=metric`
      );
      
      if (!response.ok) {
        console.error(`Failed to fetch weather for ${city}: ${response.status}`);
        return null;
      }
      
      const data = await response.json();
      weatherCache[city] = data;
      return data;
    }

    // Process single bets
    for (const bet of pendingBets || []) {
      try {
        // Check if it's the right time to resolve based on category timing
        // Use the stored time_slot_id from the bet for accurate resolution timing
        if (!isTimeToResolve(bet.city, bet.prediction_type, bet.time_slot_id)) {
          const slotInfo = bet.time_slot_id ? ` (slot: ${bet.time_slot_id})` : ' (default slot)';
          console.log(`Bet ${bet.id} (${bet.prediction_type}${slotInfo}) - Not yet time to resolve for ${bet.city}`);
          continue;
        }
        
        const slotInfo = bet.time_slot_id ? ` at ${bet.time_slot_id} slot` : '';
        console.log(`Processing bet ${bet.id} for ${bet.city} (${bet.prediction_type}${slotInfo})`);
        
        const weather = await getWeather(bet.city);
        if (!weather) continue;

        const isWin = evaluatePrediction(bet.prediction_type, bet.prediction_value, weather);
        const result = isWin ? 'win' : 'loss';

        // Log accuracy
        try {
          let actualValue = '';
          let accuracyScore = 0;
          
          if (bet.prediction_type === 'temperature') {
            actualValue = `${Math.round(weather.main.temp)}°C`;
            accuracyScore = isWin ? 100 : Math.max(0, 100 - Math.abs(weather.main.temp - parseFloat(bet.prediction_value)) * 10);
          } else if (bet.prediction_type === 'rain' || bet.prediction_type === 'rainfall') {
            const isRaining = weather.weather.some(w => w.main.toLowerCase() === 'rain');
            actualValue = isRaining ? 'yes' : 'no';
            accuracyScore = isWin ? 100 : 0;
          } else {
            actualValue = 'N/A';
            accuracyScore = isWin ? 100 : 0;
          }

          await supabase.from('weather_accuracy_log').insert({
            city: bet.city,
            prediction_date: bet.created_at,
            target_date: now,
            category: bet.prediction_type,
            predicted_value: bet.prediction_value,
            actual_value: actualValue,
            accuracy_score: accuracyScore,
            metadata: { 
              bet_id: bet.id, 
              time_slot_id: bet.time_slot_id,
              weather 
            }
          });
        } catch (accError) {
          console.error(`Accuracy logging failed for bet ${bet.id}:`, accError);
        }

        // Calculate payout
        let pointsChange = 0;
        if (isWin) {
          pointsChange = Math.round(bet.stake * bet.odds);
        } else if (bet.has_insurance && bet.insurance_payout_percentage) {
          pointsChange = Math.floor(bet.stake * bet.insurance_payout_percentage);
          console.log(`Bet ${bet.id} insured - returning ${pointsChange}`);
        }

        console.log(`Bet ${bet.id}: ${result} (${pointsChange} ${bet.currency_type})`);

        // Update bet result
        await supabase.from('bets').update({ result }).eq('id', bet.id);

        // Update user balance
        if (pointsChange > 0) {
          await supabase.rpc('update_user_points_safe', {
            user_uuid: bet.user_id,
            points_change: pointsChange,
            transaction_type: result === 'win' ? 'bet_win' : 'insurance_payout',
            reference_id: bet.id,
            reference_type: 'bet',
            currency_type: bet.currency_type || 'virtual'
          });
        }

        // Create notification for user
        const currencyLabel = bet.currency_type === 'real' ? 'R' : '';
        const currencySuffix = bet.currency_type === 'virtual' ? ' points' : '';
        
        if (isWin) {
          await createNotification(
            bet.user_id,
            '🎉 Bet Won!',
            `Your ${bet.prediction_type} bet for ${bet.city} won! You earned ${currencyLabel}${pointsChange}${currencySuffix}.`,
            'bet_won',
            bet.id,
            'bet'
          );
        } else {
          const insuranceMsg = bet.has_insurance 
            ? ` Insurance returned ${currencyLabel}${pointsChange}${currencySuffix}.`
            : '';
          await createNotification(
            bet.user_id,
            '❌ Bet Lost',
            `Your ${bet.prediction_type} bet for ${bet.city} didn't win.${insuranceMsg}`,
            'bet_lost',
            bet.id,
            'bet'
          );
        }

        resolvedBets++;
      } catch (error) {
        console.error(`Error processing bet ${bet.id}:`, error);
      }
    }

    console.log(`Resolved ${resolvedBets} single bets`);

    // ============================================
    // 2. RESOLVE PARLAYS
    // ============================================
    const { data: pendingParlays, error: parlaysError } = await supabase
      .from('parlays')
      .select(`*, parlay_legs (*)`)
      .eq('result', 'pending')
      .is('cashed_out_at', null)
      .lt('expires_at', now);

    if (parlaysError) {
      console.error('Error fetching pending parlays:', parlaysError);
    }

    console.log(`Found ${pendingParlays?.length || 0} pending parlays to resolve`);

    let resolvedParlays = 0;

    for (const parlay of pendingParlays || []) {
      try {
        console.log(`Processing parlay ${parlay.id} with ${parlay.parlay_legs?.length || 0} legs`);
        
        let allLegsWin = true;

        for (const leg of parlay.parlay_legs || []) {
          const weather = await getWeather(leg.city);
          if (!weather) {
            allLegsWin = false;
            break;
          }

          const legWins = evaluatePrediction(leg.prediction_type, leg.prediction_value, weather);
          
          // Update leg result
          await supabase.from('parlay_legs').update({ 
            result: legWins ? 'win' : 'loss' 
          }).eq('id', leg.id);

          console.log(`Parlay leg ${leg.id} (${leg.city} - ${leg.prediction_type}): ${legWins ? 'WIN' : 'LOSS'}`);

          if (!legWins) {
            allLegsWin = false;
            break;
          }
        }

        const parlayResult = allLegsWin ? 'win' : 'loss';

        let pointsChange = 0;
        if (allLegsWin) {
          pointsChange = Math.round(parlay.total_stake * parlay.combined_odds);
        } else if (parlay.has_insurance && parlay.insurance_payout_percentage) {
          pointsChange = Math.floor(parlay.total_stake * parlay.insurance_payout_percentage);
          console.log(`Parlay ${parlay.id} insured - returning ${pointsChange}`);
        }

        console.log(`Parlay ${parlay.id}: ${parlayResult} (${pointsChange} ${parlay.currency_type})`);

        await supabase.from('parlays').update({ result: parlayResult }).eq('id', parlay.id);

        if (pointsChange > 0) {
          await supabase.rpc('update_user_points_safe', {
            user_uuid: parlay.user_id,
            points_change: pointsChange,
            transaction_type: parlayResult === 'win' ? 'bet_win' : 'insurance_payout',
            reference_id: parlay.id,
            reference_type: 'parlay',
            currency_type: parlay.currency_type || 'virtual'
          });
        }

        // Create notification for parlay
        const currencyLabel = parlay.currency_type === 'real' ? 'R' : '';
        const currencySuffix = parlay.currency_type === 'virtual' ? ' points' : '';
        const legCount = parlay.parlay_legs?.length || 0;
        
        if (allLegsWin) {
          await createNotification(
            parlay.user_id,
            '🎉 Parlay Won!',
            `Your ${legCount}-leg parlay won! You earned ${currencyLabel}${pointsChange}${currencySuffix}.`,
            'bet_won',
            parlay.id,
            'parlay'
          );
        } else {
          const insuranceMsg = parlay.has_insurance 
            ? ` Insurance returned ${currencyLabel}${pointsChange}${currencySuffix}.`
            : '';
          await createNotification(
            parlay.user_id,
            '❌ Parlay Lost',
            `Your ${legCount}-leg parlay didn't win.${insuranceMsg}`,
            'bet_lost',
            parlay.id,
            'parlay'
          );
        }

        resolvedParlays++;
      } catch (error) {
        console.error(`Error processing parlay ${parlay.id}:`, error);
      }
    }

    console.log(`Resolved ${resolvedParlays} parlays`);

    // ============================================
    // 3. RESOLVE COMBINED BETS
    // ============================================
    const { data: pendingCombinedBets, error: combinedError } = await supabase
      .from('combined_bets')
      .select(`*, combined_bet_categories (*)`)
      .eq('result', 'pending')
      .is('cashed_out_at', null)
      .lt('target_date', now);

    if (combinedError) {
      console.error('Error fetching pending combined bets:', combinedError);
    }

    console.log(`Found ${pendingCombinedBets?.length || 0} pending combined bets to resolve`);

    let resolvedCombinedBets = 0;

    for (const combinedBet of pendingCombinedBets || []) {
      try {
        console.log(`Processing combined bet ${combinedBet.id} for ${combinedBet.city} with ${combinedBet.combined_bet_categories?.length || 0} categories`);
        
        const weather = await getWeather(combinedBet.city);
        if (!weather) continue;

        let allCategoriesWin = true;

        for (const category of combinedBet.combined_bet_categories || []) {
          const categoryWins = evaluatePrediction(category.prediction_type, category.prediction_value, weather);
          
          // Update category result
          await supabase.from('combined_bet_categories').update({ 
            result: categoryWins ? 'win' : 'loss' 
          }).eq('id', category.id);

          console.log(`Category ${category.id} (${category.prediction_type}): ${categoryWins ? 'WIN' : 'LOSS'}`);

          if (!categoryWins) {
            allCategoriesWin = false;
            // Don't break - update all category results for UI display
          }
        }

        const combinedResult = allCategoriesWin ? 'win' : 'loss';

        let pointsChange = 0;
        if (allCategoriesWin) {
          pointsChange = Math.round(combinedBet.total_stake * combinedBet.combined_odds);
        } else if (combinedBet.has_insurance && combinedBet.insurance_payout_percentage) {
          pointsChange = Math.floor(combinedBet.total_stake * combinedBet.insurance_payout_percentage);
          console.log(`Combined bet ${combinedBet.id} insured - returning ${pointsChange}`);
        }

        console.log(`Combined bet ${combinedBet.id}: ${combinedResult} (${pointsChange} ${combinedBet.currency_type})`);

        await supabase.from('combined_bets').update({ result: combinedResult }).eq('id', combinedBet.id);

        if (pointsChange > 0) {
          await supabase.rpc('update_user_points_safe', {
            user_uuid: combinedBet.user_id,
            points_change: pointsChange,
            transaction_type: combinedResult === 'win' ? 'bet_win' : 'insurance_payout',
            reference_id: combinedBet.id,
            reference_type: 'combined_bet',
            currency_type: combinedBet.currency_type || 'virtual'
          });
        }

        // Create notification for combined bet
        const currencyLabel = combinedBet.currency_type === 'real' ? 'R' : '';
        const currencySuffix = combinedBet.currency_type === 'virtual' ? ' points' : '';
        const categoryCount = combinedBet.combined_bet_categories?.length || 0;
        
        if (allCategoriesWin) {
          await createNotification(
            combinedBet.user_id,
            '🎉 Combined Bet Won!',
            `Your ${categoryCount}-category bet on ${combinedBet.city} won! You earned ${currencyLabel}${pointsChange}${currencySuffix}.`,
            'bet_won',
            combinedBet.id,
            'combined_bet'
          );
        } else {
          const insuranceMsg = combinedBet.has_insurance 
            ? ` Insurance returned ${currencyLabel}${pointsChange}${currencySuffix}.`
            : '';
          await createNotification(
            combinedBet.user_id,
            '❌ Combined Bet Lost',
            `Your ${categoryCount}-category bet on ${combinedBet.city} didn't win.${insuranceMsg}`,
            'bet_lost',
            combinedBet.id,
            'combined_bet'
          );
        }

        resolvedCombinedBets++;
      } catch (error) {
        console.error(`Error processing combined bet ${combinedBet.id}:`, error);
      }
    }

    console.log(`Resolved ${resolvedCombinedBets} combined bets`);

    return new Response(JSON.stringify({ 
      message: `Resolved ${resolvedBets} bets, ${resolvedParlays} parlays, and ${resolvedCombinedBets} combined bets`,
      resolvedBets,
      resolvedParlays,
      resolvedCombinedBets
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in resolve-bets function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      resolved: 0 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
