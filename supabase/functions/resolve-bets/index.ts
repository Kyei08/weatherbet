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

// Partial win configuration - how close a prediction needs to be for partial win
const PARTIAL_WIN_CONFIG = {
  enabled: true,
  payoutPercentage: 50, // 50% of full win
  tolerances: {
    temperature: 3,      // Within 3°C of range edge
    rainfall: 2,         // Within 2mm of range edge
    wind: 5,             // Within 5 km/h of range edge
    dew_point: 3,        // Within 3°C of range edge
    pressure: 10,        // Within 10 hPa of range edge
    cloud_coverage: 10,  // Within 10% of range edge
    humidity: 10,        // Within 10% of range edge
  } as Record<string, number>,
};

// Check if prediction is close enough for partial win
function isPartialWin(predictionType: string, actual: number, rangeStr: string): boolean {
  if (!PARTIAL_WIN_CONFIG.enabled) return false;
  
  const tolerance = PARTIAL_WIN_CONFIG.tolerances[predictionType] || 0;
  if (tolerance === 0) return false;
  
  // Clean up the string and extract numbers
  const cleaned = rangeStr.replace(/[°C%hPakm\/hmm]/gi, '').trim();
  const parts = cleaned.split(/[-–]/);
  
  if (parts.length === 2) {
    const min = parseFloat(parts[0].trim());
    const max = parseFloat(parts[1].trim());
    if (!isNaN(min) && !isNaN(max)) {
      // Check if actual is within tolerance of either edge
      const distanceToMin = Math.abs(actual - min);
      const distanceToMax = Math.abs(actual - max);
      
      // If outside range but within tolerance of either edge
      if (actual < min && distanceToMin <= tolerance) return true;
      if (actual > max && distanceToMax <= tolerance) return true;
    }
  }
  
  return false;
}

// Evaluate a prediction against actual weather using smart timing logic
// Returns: 'win' | 'partial' | 'loss'
function evaluatePrediction(predictionType: string, predictionValue: string, weather: WeatherData): 'win' | 'partial' | 'loss' {
  const type = predictionType.toLowerCase();
  const value = predictionValue.toLowerCase();

  switch (type) {
    case 'rain': {
      // Binary: Did it rain anytime today? (no partial wins for binary)
      const isRaining = weather.weather.some(w => 
        w.main.toLowerCase() === 'rain' || 
        w.description.toLowerCase().includes('rain')
      );
      const rainAmount = (weather.rain?.['1h'] || 0) + (weather.rain?.['3h'] || 0);
      return (value === 'yes') === (isRaining || rainAmount > 0) ? 'win' : 'loss';
    }
    
    case 'rainfall': {
      // Daily total rainfall accumulation
      const rainAmount = (weather.rain?.['1h'] || 0) + (weather.rain?.['3h'] || 0);
      if (isInRange(rainAmount, predictionValue)) return 'win';
      if (isPartialWin('rainfall', rainAmount, predictionValue)) return 'partial';
      return 'loss';
    }
    
    case 'temperature': {
      // Temperature at 2:00 PM (peak daily temp)
      const actualTemp = Math.round(weather.main.temp);
      console.log(`Temperature check: actual=${actualTemp}°C, prediction=${predictionValue}`);
      if (isInRange(actualTemp, predictionValue)) return 'win';
      if (isPartialWin('temperature', actualTemp, predictionValue)) return 'partial';
      return 'loss';
    }
    
    case 'wind':
    case 'wind_speed': {
      // Maximum wind gust speed
      const windSpeed = weather.wind?.speed || 0;
      const windGust = weather.wind?.gust || windSpeed;
      const maxWindKmh = Math.max(windSpeed, windGust) * 3.6;
      console.log(`Wind check: max gust=${maxWindKmh.toFixed(1)} km/h, prediction=${predictionValue}`);
      if (isInRange(maxWindKmh, predictionValue)) return 'win';
      if (isPartialWin('wind', maxWindKmh, predictionValue)) return 'partial';
      return 'loss';
    }
    
    case 'snow': {
      // Binary: Did it snow anytime today? (no partial wins for binary)
      const isSnowing = weather.weather.some(w => 
        w.main.toLowerCase() === 'snow' || 
        w.description.toLowerCase().includes('snow')
      );
      const snowAmount = (weather.snow?.['1h'] || 0) + (weather.snow?.['3h'] || 0);
      return (value === 'yes') === (isSnowing || snowAmount > 0) ? 'win' : 'loss';
    }
    
    case 'humidity': {
      const humidity = weather.main.humidity;
      if (isInRange(humidity, predictionValue)) return 'win';
      if (isPartialWin('humidity', humidity, predictionValue)) return 'partial';
      return 'loss';
    }
    
    case 'pressure': {
      // Pressure at 9:00 AM
      const pressure = weather.main.pressure;
      console.log(`Pressure check: actual=${pressure} hPa, prediction=${predictionValue}`);
      if (isInRange(pressure, predictionValue)) return 'win';
      if (isPartialWin('pressure', pressure, predictionValue)) return 'partial';
      return 'loss';
    }
    
    case 'cloud_coverage':
    case 'clouds': {
      // Cloud coverage at solar noon
      const clouds = weather.clouds?.all || 0;
      console.log(`Cloud coverage check: actual=${clouds}%, prediction=${predictionValue}`);
      if (isInRange(clouds, predictionValue)) return 'win';
      if (isPartialWin('cloud_coverage', clouds, predictionValue)) return 'partial';
      return 'loss';
    }
    
    case 'dew_point': {
      // Dew point at 6:00 PM
      const temp = weather.main.temp;
      const humidity = weather.main.humidity;
      const dewPoint = temp - ((100 - humidity) / 5);
      console.log(`Dew point check: actual=${dewPoint.toFixed(1)}°C, prediction=${predictionValue}`);
      if (isInRange(dewPoint, predictionValue)) return 'win';
      if (isPartialWin('dew_point', dewPoint, predictionValue)) return 'partial';
      return 'loss';
    }
    
    default:
      console.log(`Unknown prediction type: ${type}`);
      return 'loss';
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
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });

    console.log('Starting bet resolution process...');

    // Broadcast that resolution has started
    const channel = supabase.channel('bet-resolution-status');
    await channel.subscribe();
    
    // Helper to broadcast progress
    async function broadcastProgress(current: number, total: number, phase: string) {
      await channel.send({
        type: 'broadcast',
        event: 'resolution_status',
        payload: { 
          status: 'resolving', 
          message: `${phase}: ${current}/${total}`,
          current,
          total,
          phase
        }
      });
    }

    await channel.send({
      type: 'broadcast',
      event: 'resolution_status',
      payload: { status: 'resolving', message: 'Starting resolution...', phase: 'init' }
    });

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

    const totalBets = pendingBets?.length || 0;
    console.log(`Found ${totalBets} pending bets to resolve`);
    
    // Broadcast initial counts
    await channel.send({
      type: 'broadcast',
      event: 'resolution_status',
      payload: { 
        status: 'resolving', 
        message: `Found ${totalBets} single bets to check...`,
        phase: 'counting',
        totalBets
      }
    });

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

        const predictionResult = evaluatePrediction(bet.prediction_type, bet.prediction_value, weather);
        const result = predictionResult; // 'win' | 'partial' | 'loss'

        // Log accuracy
        try {
          let actualValue = '';
          let accuracyScore = 0;
          
          if (bet.prediction_type === 'temperature') {
            actualValue = `${Math.round(weather.main.temp)}°C`;
            accuracyScore = result === 'win' ? 100 : result === 'partial' ? 75 : Math.max(0, 100 - Math.abs(weather.main.temp - parseFloat(bet.prediction_value)) * 10);
          } else if (bet.prediction_type === 'rain' || bet.prediction_type === 'rainfall') {
            const isRaining = weather.weather.some(w => w.main.toLowerCase() === 'rain');
            actualValue = isRaining ? 'yes' : 'no';
            accuracyScore = result === 'win' ? 100 : result === 'partial' ? 75 : 0;
          } else {
            actualValue = 'N/A';
            accuracyScore = result === 'win' ? 100 : result === 'partial' ? 75 : 0;
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
              result_type: result,
              weather 
            }
          });
        } catch (accError) {
          console.error(`Accuracy logging failed for bet ${bet.id}:`, accError);
        }

        // Calculate payout based on result type
        let pointsChange = 0;
        let transactionType = 'bet_loss';
        
        if (result === 'win') {
          pointsChange = Math.round(bet.stake * bet.odds);
          transactionType = 'bet_win';
        } else if (result === 'partial') {
          // Partial win: 50% of full payout
          pointsChange = Math.round(bet.stake * bet.odds * (PARTIAL_WIN_CONFIG.payoutPercentage / 100));
          transactionType = 'bet_partial_win';
          console.log(`Bet ${bet.id} partial win - awarding ${pointsChange} (${PARTIAL_WIN_CONFIG.payoutPercentage}% of full payout)`);
        } else if (bet.has_insurance && bet.insurance_payout_percentage) {
          pointsChange = Math.floor(bet.stake * bet.insurance_payout_percentage);
          transactionType = 'insurance_payout';
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
            transaction_type: transactionType,
            reference_id: bet.id,
            reference_type: 'bet',
            currency_type: bet.currency_type || 'virtual'
          });
        }

        // Create notification for user
        const currencyLabel = bet.currency_type === 'real' ? 'R' : '';
        const currencySuffix = bet.currency_type === 'virtual' ? ' points' : '';
        
        if (result === 'win') {
          await createNotification(
            bet.user_id,
            '🎉 Bet Won!',
            `Your ${bet.prediction_type} bet for ${bet.city} won! You earned ${currencyLabel}${pointsChange}${currencySuffix}.`,
            'bet_won',
            bet.id,
            'bet'
          );
        } else if (result === 'partial') {
          await createNotification(
            bet.user_id,
            '🎯 Partial Win!',
            `Your ${bet.prediction_type} bet for ${bet.city} was close! You earned ${currencyLabel}${pointsChange}${currencySuffix} (${PARTIAL_WIN_CONFIG.payoutPercentage}% payout).`,
            'bet_partial',
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
        
        // Broadcast progress for single bets
        await broadcastProgress(resolvedBets, totalBets, 'Single bets');
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

    const totalParlays = pendingParlays?.length || 0;
    console.log(`Found ${totalParlays} pending parlays to resolve`);

    let resolvedParlays = 0;

    for (const parlay of pendingParlays || []) {
      try {
        console.log(`Processing parlay ${parlay.id} with ${parlay.parlay_legs?.length || 0} legs`);
        
        let hasLoss = false;
        let hasPartial = false;

        for (const leg of parlay.parlay_legs || []) {
          const weather = await getWeather(leg.city);
          if (!weather) {
            hasLoss = true;
            break;
          }

          const legResult = evaluatePrediction(leg.prediction_type, leg.prediction_value, weather);
          
          // Update leg result
          await supabase.from('parlay_legs').update({ 
            result: legResult 
          }).eq('id', leg.id);

          console.log(`Parlay leg ${leg.id} (${leg.city} - ${leg.prediction_type}): ${legResult.toUpperCase()}`);

          if (legResult === 'loss') {
            hasLoss = true;
            break;
          } else if (legResult === 'partial') {
            hasPartial = true;
          }
        }

        // Parlays: all must win, but partial legs = partial parlay payout
        let parlayResult: 'win' | 'partial' | 'loss';
        if (hasLoss) {
          parlayResult = 'loss';
        } else if (hasPartial) {
          parlayResult = 'partial';
        } else {
          parlayResult = 'win';
        }

        let pointsChange = 0;
        let transactionType = 'bet_loss';
        
        if (parlayResult === 'win') {
          pointsChange = Math.round(parlay.total_stake * parlay.combined_odds);
          transactionType = 'bet_win';
        } else if (parlayResult === 'partial') {
          // Partial parlay: 50% of full payout
          pointsChange = Math.round(parlay.total_stake * parlay.combined_odds * (PARTIAL_WIN_CONFIG.payoutPercentage / 100));
          transactionType = 'bet_partial_win';
          console.log(`Parlay ${parlay.id} partial win - awarding ${pointsChange}`);
        } else if (parlay.has_insurance && parlay.insurance_payout_percentage) {
          pointsChange = Math.floor(parlay.total_stake * parlay.insurance_payout_percentage);
          transactionType = 'insurance_payout';
          console.log(`Parlay ${parlay.id} insured - returning ${pointsChange}`);
        }

        console.log(`Parlay ${parlay.id}: ${parlayResult} (${pointsChange} ${parlay.currency_type})`);

        await supabase.from('parlays').update({ result: parlayResult }).eq('id', parlay.id);

        if (pointsChange > 0) {
          await supabase.rpc('update_user_points_safe', {
            user_uuid: parlay.user_id,
            points_change: pointsChange,
            transaction_type: transactionType,
            reference_id: parlay.id,
            reference_type: 'parlay',
            currency_type: parlay.currency_type || 'virtual'
          });
        }

        // Create notification for parlay
        const currencyLabel = parlay.currency_type === 'real' ? 'R' : '';
        const currencySuffix = parlay.currency_type === 'virtual' ? ' points' : '';
        const legCount = parlay.parlay_legs?.length || 0;
        
        if (parlayResult === 'win') {
          await createNotification(
            parlay.user_id,
            '🎉 Parlay Won!',
            `Your ${legCount}-leg parlay won! You earned ${currencyLabel}${pointsChange}${currencySuffix}.`,
            'bet_won',
            parlay.id,
            'parlay'
          );
        } else if (parlayResult === 'partial') {
          await createNotification(
            parlay.user_id,
            '🎯 Parlay Partial Win!',
            `Your ${legCount}-leg parlay was close! You earned ${currencyLabel}${pointsChange}${currencySuffix} (${PARTIAL_WIN_CONFIG.payoutPercentage}% payout).`,
            'bet_partial',
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
        
        // Broadcast progress for parlays
        await broadcastProgress(resolvedParlays, totalParlays, 'Parlays');
      } catch (error) {
        console.error(`Error processing parlay ${parlay.id}:`, error);
      }
    }

    console.log(`Resolved ${resolvedParlays} parlays`);

    // ============================================
    // 3. RESOLVE COMBINED BETS (including multi-time combos)
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

    const totalCombinedBets = pendingCombinedBets?.length || 0;
    console.log(`Found ${totalCombinedBets} pending combined bets to resolve`);

    let resolvedCombinedBets = 0;

    // Helper to parse prediction type that may include time slot (e.g., "temperature_morning" -> { category: "temperature", slotId: "morning" })
    function parsePredictionType(predictionType: string): { category: string; slotId?: string } {
      // Check if this is a multi-time combo format: category_slotId
      const knownCategories = ['temperature', 'rain', 'rainfall', 'wind', 'snow', 'cloud_coverage', 'pressure', 'dew_point', 'humidity'];
      
      for (const category of knownCategories) {
        if (predictionType === category) {
          return { category };
        }
        if (predictionType.startsWith(category + '_')) {
          const slotId = predictionType.substring(category.length + 1);
          // Validate slotId exists in our config
          const config = CATEGORY_TIMING[category];
          if (config && config.slots.some(s => s.slotId === slotId)) {
            return { category, slotId };
          }
        }
      }
      
      // Fallback: treat the whole thing as the category
      return { category: predictionType };
    }

    for (const combinedBet of pendingCombinedBets || []) {
      try {
        console.log(`Processing combined bet ${combinedBet.id} for ${combinedBet.city} with ${combinedBet.combined_bet_categories?.length || 0} categories`);
        
        const weather = await getWeather(combinedBet.city);
        if (!weather) continue;

        let hasLoss = false;
        let hasPartial = false;
        let allCategoriesResolvable = true;
        let resolvedCategoryCount = 0;

        for (const category of combinedBet.combined_bet_categories || []) {
          // Parse prediction type to extract category and time slot
          const { category: baseCategory, slotId } = parsePredictionType(category.prediction_type);
          
          // Check if it's time to resolve this specific category/slot
          if (!isTimeToResolve(combinedBet.city, baseCategory, slotId)) {
            const slotInfo = slotId ? ` (slot: ${slotId})` : '';
            console.log(`Combined bet category ${category.id} (${baseCategory}${slotInfo}) - Not yet time to resolve for ${combinedBet.city}`);
            allCategoriesResolvable = false;
            continue;
          }

          // Skip already resolved categories
          if (category.result !== 'pending') {
            console.log(`Category ${category.id} already resolved: ${category.result}`);
            if (category.result === 'loss') {
              hasLoss = true;
            } else if (category.result === 'partial') {
              hasPartial = true;
            }
            resolvedCategoryCount++;
            continue;
          }

          // Evaluate this category using the base category (not the full prediction_type with slot)
          const categoryResult = evaluatePrediction(baseCategory, category.prediction_value, weather);
          
          // Update category result
          await supabase.from('combined_bet_categories').update({ 
            result: categoryResult 
          }).eq('id', category.id);

          const slotInfo = slotId ? ` at ${slotId}` : '';
          console.log(`Category ${category.id} (${baseCategory}${slotInfo}): ${categoryResult.toUpperCase()}`);

          resolvedCategoryCount++;

          if (categoryResult === 'loss') {
            hasLoss = true;
          } else if (categoryResult === 'partial') {
            hasPartial = true;
          }
        }

        // Only resolve the full combined bet if ALL categories have been resolved
        const totalCategories = combinedBet.combined_bet_categories?.length || 0;
        if (resolvedCategoryCount < totalCategories) {
          console.log(`Combined bet ${combinedBet.id}: Only ${resolvedCategoryCount}/${totalCategories} categories resolved, waiting for remaining`);
          continue;
        }

        // Combined bets: all must win, but partial categories = partial payout
        let combinedResult: 'win' | 'partial' | 'loss';
        if (hasLoss) {
          combinedResult = 'loss';
        } else if (hasPartial) {
          combinedResult = 'partial';
        } else {
          combinedResult = 'win';
        }

        let pointsChange = 0;
        let transactionType = 'bet_loss';
        
        if (combinedResult === 'win') {
          pointsChange = Math.round(combinedBet.total_stake * combinedBet.combined_odds);
          transactionType = 'bet_win';
        } else if (combinedResult === 'partial') {
          // Partial combined bet: 50% of full payout
          pointsChange = Math.round(combinedBet.total_stake * combinedBet.combined_odds * (PARTIAL_WIN_CONFIG.payoutPercentage / 100));
          transactionType = 'bet_partial_win';
          console.log(`Combined bet ${combinedBet.id} partial win - awarding ${pointsChange}`);
        } else if (combinedBet.has_insurance && combinedBet.insurance_payout_percentage) {
          pointsChange = Math.floor(combinedBet.total_stake * combinedBet.insurance_payout_percentage);
          transactionType = 'insurance_payout';
          console.log(`Combined bet ${combinedBet.id} insured - returning ${pointsChange}`);
        }

        console.log(`Combined bet ${combinedBet.id}: ${combinedResult} (${pointsChange} ${combinedBet.currency_type})`);

        await supabase.from('combined_bets').update({ result: combinedResult }).eq('id', combinedBet.id);

        if (pointsChange > 0) {
          await supabase.rpc('update_user_points_safe', {
            user_uuid: combinedBet.user_id,
            points_change: pointsChange,
            transaction_type: transactionType,
            reference_id: combinedBet.id,
            reference_type: 'combined_bet',
            currency_type: combinedBet.currency_type || 'virtual'
          });
        }

        // Create notification for combined bet
        const currencyLabel = combinedBet.currency_type === 'real' ? 'R' : '';
        const currencySuffix = combinedBet.currency_type === 'virtual' ? ' points' : '';
        const categoryCount = combinedBet.combined_bet_categories?.length || 0;
        
        // Detect if this is a multi-time combo (same category at different times)
        const isMultiTimeCombo = combinedBet.combined_bet_categories?.every((c: any) => {
          const { category } = parsePredictionType(c.prediction_type);
          const { category: firstCategory } = parsePredictionType(combinedBet.combined_bet_categories[0].prediction_type);
          return category === firstCategory;
        }) && categoryCount > 1;

        const betTypeLabel = isMultiTimeCombo ? 'multi-time combo' : `${categoryCount}-category bet`;
        
        if (combinedResult === 'win') {
          await createNotification(
            combinedBet.user_id,
            '🎉 Combined Bet Won!',
            `Your ${betTypeLabel} on ${combinedBet.city} won! You earned ${currencyLabel}${pointsChange}${currencySuffix}.`,
            'bet_won',
            combinedBet.id,
            'combined_bet'
          );
        } else if (combinedResult === 'partial') {
          await createNotification(
            combinedBet.user_id,
            '🎯 Combined Bet Partial Win!',
            `Your ${betTypeLabel} on ${combinedBet.city} was close! You earned ${currencyLabel}${pointsChange}${currencySuffix} (${PARTIAL_WIN_CONFIG.payoutPercentage}% payout).`,
            'bet_partial',
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
            `Your ${betTypeLabel} on ${combinedBet.city} didn't win.${insuranceMsg}`,
            'bet_lost',
            combinedBet.id,
            'combined_bet'
          );
        }

        resolvedCombinedBets++;
        
        // Broadcast progress for combined bets
        await broadcastProgress(resolvedCombinedBets, totalCombinedBets, 'Combined bets');
      } catch (error) {
        console.error(`Error processing combined bet ${combinedBet.id}:`, error);
      }
    }

    console.log(`Resolved ${resolvedCombinedBets} combined bets`);

    // Broadcast that resolution is complete
    await channel.send({
      type: 'broadcast',
      event: 'resolution_status',
      payload: { 
        status: 'complete', 
        message: `Resolved ${resolvedBets} bets, ${resolvedParlays} parlays, ${resolvedCombinedBets} combined bets`,
        resolvedBets,
        resolvedParlays,
        resolvedCombinedBets
      }
    });
    await supabase.removeChannel(channel);

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
