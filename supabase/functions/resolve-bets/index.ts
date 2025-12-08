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
  };
  clouds?: {
    all: number;
  };
  rain?: {
    '1h'?: number;
  };
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

// Evaluate a prediction against actual weather
function evaluatePrediction(predictionType: string, predictionValue: string, weather: WeatherData): boolean {
  const type = predictionType.toLowerCase();
  const value = predictionValue.toLowerCase();

  switch (type) {
    case 'rain':
    case 'rainfall': {
      const isRaining = weather.weather.some(w => 
        w.main.toLowerCase() === 'rain' || 
        w.description.toLowerCase().includes('rain')
      );
      const rainAmount = weather.rain?.['1h'] || 0;
      
      // Handle yes/no predictions
      if (value === 'yes' || value === 'no') {
        return (value === 'yes') === isRaining;
      }
      // Handle range predictions like "0-5mm"
      return isInRange(rainAmount, predictionValue);
    }
    
    case 'temperature': {
      const actualTemp = Math.round(weather.main.temp);
      return isInRange(actualTemp, predictionValue);
    }
    
    case 'wind':
    case 'wind_speed': {
      const windSpeed = weather.wind?.speed || 0;
      // Convert m/s to km/h for comparison
      const windKmh = windSpeed * 3.6;
      return isInRange(windKmh, predictionValue);
    }
    
    case 'humidity': {
      const humidity = weather.main.humidity;
      return isInRange(humidity, predictionValue);
    }
    
    case 'pressure': {
      const pressure = weather.main.pressure;
      return isInRange(pressure, predictionValue);
    }
    
    case 'cloud_coverage':
    case 'clouds': {
      const clouds = weather.clouds?.all || 0;
      return isInRange(clouds, predictionValue);
    }
    
    case 'dew_point': {
      // Approximate dew point from temp and humidity
      const temp = weather.main.temp;
      const humidity = weather.main.humidity;
      const dewPoint = temp - ((100 - humidity) / 5);
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
        console.log(`Processing bet ${bet.id} for ${bet.city}`);
        
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
            metadata: { bet_id: bet.id, weather }
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
