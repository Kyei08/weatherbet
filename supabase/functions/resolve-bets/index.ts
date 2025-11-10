import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Bet {
  id: string;
  user_id: string;
  city: string;
  prediction_type: string;
  prediction_value: string;
  stake: number;
  odds: number;
  created_at: string;
}

interface Parlay {
  id: string;
  user_id: string;
  total_stake: number;
  combined_odds: number;
  created_at: string;
}

interface ParlayLeg {
  id: string;
  parlay_id: string;
  city: string;
  prediction_type: string;
  prediction_value: string;
  odds: number;
}

interface WeatherData {
  main: {
    temp: number;
  };
  weather: Array<{
    main: string;
    description: string;
  }>;
  rain?: {
    '1h'?: number;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openWeatherApiKey = Deno.env.get('OPENWEATHER_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    console.log('Starting bet resolution process...');

    // Get all pending bets that are at least 1 hour old (excluding cashed out)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: pendingBets, error: betsError } = await supabase
      .from('bets')
      .select('*')
      .eq('result', 'pending')
      .lt('created_at', oneHourAgo)
      .is('cashed_out_at', null);

    if (betsError) {
      console.error('Error fetching pending bets:', betsError);
      throw betsError;
    }

    console.log(`Found ${pendingBets?.length || 0} pending bets to resolve`);

    if (!pendingBets || pendingBets.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No pending bets to resolve',
        resolved: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let resolvedCount = 0;

    // Process each bet
    for (const bet of pendingBets as Bet[]) {
      try {
        console.log(`Processing bet ${bet.id} for ${bet.city}`);
        
        // Fetch current weather data
        const weatherResponse = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=${bet.city}&appid=${openWeatherApiKey}&units=metric`
        );

        if (!weatherResponse.ok) {
          console.error(`Failed to fetch weather for ${bet.city}: ${weatherResponse.status}`);
          continue;
        }

        const weatherData: WeatherData = await weatherResponse.json();
        let isWin = false;

        // Determine if the prediction was correct
        if (bet.prediction_type === 'rain') {
          const isRaining = weatherData.weather.some(w => 
            w.main.toLowerCase() === 'rain' || 
            w.description.toLowerCase().includes('rain')
          );
          const predictedRain = bet.prediction_value.toLowerCase() === 'yes';
          isWin = isRaining === predictedRain;
        } else if (bet.prediction_type === 'temperature') {
          const actualTemp = Math.round(weatherData.main.temp);
          const predictedTemp = parseInt(bet.prediction_value);
          // Allow 2 degree tolerance
          isWin = Math.abs(actualTemp - predictedTemp) <= 2;
        }

        const result = isWin ? 'win' : 'loss';
        
        // Calculate points change considering insurance
        let pointsChange: number;
        if (isWin) {
          // Win: give back stake + winnings
          pointsChange = Math.round(bet.stake * bet.odds);
        } else {
          // Loss: check if insured
          const betData = bet as any;
          if (betData.has_insurance && betData.insurance_payout_percentage) {
            // Insured loss: return insurance payout
            const insurancePayout = Math.floor(bet.stake * betData.insurance_payout_percentage);
            pointsChange = insurancePayout;
            console.log(`Bet ${bet.id} has insurance - returning ${insurancePayout} points`);
          } else {
            // Uninsured loss: lose stake (already deducted, no change)
            pointsChange = 0;
          }
        }

        console.log(`Bet ${bet.id}: ${result} (${pointsChange} points)`);

        // Update bet result
        const { error: updateBetError } = await supabase
          .from('bets')
          .update({ result })
          .eq('id', bet.id);

        if (updateBetError) {
          console.error(`Error updating bet ${bet.id}:`, updateBetError);
          continue;
        }

        // Update user points
        const { error: updatePointsError } = await supabase.rpc(
          'update_user_points',
          { 
            user_uuid: bet.user_id, 
            points_change: pointsChange 
          }
        );

        // If the RPC doesn't exist, update points directly
        if (updatePointsError?.code === '42883') {
          const { data: user } = await supabase
            .from('users')
            .select('points')
            .eq('id', bet.user_id)
            .single();

          if (user) {
            const newPoints = Math.max(0, user.points + pointsChange);
            await supabase
              .from('users')
              .update({ points: newPoints })
              .eq('id', bet.user_id);
          }
        } else if (updatePointsError) {
          console.error(`Error updating points for user ${bet.user_id}:`, updatePointsError);
          continue;
        }

        resolvedCount++;
      } catch (error) {
        console.error(`Error processing bet ${bet.id}:`, error);
      }
    }

    console.log(`Successfully resolved ${resolvedCount} bets`);

    // Now process parlays (excluding cashed out)
    const { data: pendingParlays, error: parlaysError } = await supabase
      .from('parlays')
      .select(`
        *,
        parlay_legs (*)
      `)
      .eq('result', 'pending')
      .lt('created_at', oneHourAgo)
      .is('cashed_out_at', null);

    if (parlaysError) {
      console.error('Error fetching pending parlays:', parlaysError);
    }

    console.log(`Found ${pendingParlays?.length || 0} pending parlays to resolve`);

    let resolvedParlays = 0;

    if (pendingParlays && pendingParlays.length > 0) {
      for (const parlay of pendingParlays as any[]) {
        try {
          console.log(`Processing parlay ${parlay.id} with ${parlay.parlay_legs.length} legs`);
          
          let allLegsWin = true;

          // Check each leg
          for (const leg of parlay.parlay_legs) {
            const weatherResponse = await fetch(
              `https://api.openweathermap.org/data/2.5/weather?q=${leg.city}&appid=${openWeatherApiKey}&units=metric`
            );

            if (!weatherResponse.ok) {
              console.error(`Failed to fetch weather for ${leg.city}: ${weatherResponse.status}`);
              allLegsWin = false;
              break;
            }

            const weatherData: WeatherData = await weatherResponse.json();
            let legWins = false;

            // Determine if this leg won
            if (leg.prediction_type === 'rain') {
              const isRaining = weatherData.weather.some(w => 
                w.main.toLowerCase() === 'rain' || 
                w.description.toLowerCase().includes('rain')
              );
              const predictedRain = leg.prediction_value.toLowerCase() === 'yes';
              legWins = isRaining === predictedRain;
            } else if (leg.prediction_type === 'temperature') {
              const actualTemp = Math.round(weatherData.main.temp);
              // Parse temperature range
              const tempRange = leg.prediction_value;
              if (tempRange.includes('-')) {
                const [min, max] = tempRange.split('-').map(t => parseInt(t));
                legWins = actualTemp >= min && actualTemp <= max;
              } else {
                const predictedTemp = parseInt(leg.prediction_value);
                legWins = Math.abs(actualTemp - predictedTemp) <= 2;
              }
            }

            console.log(`Leg ${leg.id} (${leg.city}): ${legWins ? 'WIN' : 'LOSS'}`);

            if (!legWins) {
              allLegsWin = false;
              break;
            }
          }

          const parlayResult = allLegsWin ? 'win' : 'loss';
          
          // Calculate points change considering insurance
          let pointsChange: number;
          if (allLegsWin) {
            // Win: give back stake + winnings
            pointsChange = Math.round(parlay.total_stake * parlay.combined_odds);
          } else {
            // Loss: check if insured
            if (parlay.has_insurance && parlay.insurance_payout_percentage) {
              // Insured loss: return insurance payout
              const insurancePayout = Math.floor(parlay.total_stake * parlay.insurance_payout_percentage);
              pointsChange = insurancePayout;
              console.log(`Parlay ${parlay.id} has insurance - returning ${insurancePayout} points`);
            } else {
              // Uninsured loss: lose stake (already deducted, no change)
              pointsChange = 0;
            }
          }

          console.log(`Parlay ${parlay.id}: ${parlayResult} (${pointsChange} points)`);

          // Update parlay result
          const { error: updateParlayError } = await supabase
            .from('parlays')
            .update({ result: parlayResult })
            .eq('id', parlay.id);

          if (updateParlayError) {
            console.error(`Error updating parlay ${parlay.id}:`, updateParlayError);
            continue;
          }

          // Update user points
          const { error: updatePointsError } = await supabase.rpc(
            'update_user_points',
            { 
              user_uuid: parlay.user_id, 
              points_change: pointsChange 
            }
          );

          if (updatePointsError?.code === '42883') {
            const { data: user } = await supabase
              .from('users')
              .select('points')
              .eq('id', parlay.user_id)
              .single();

            if (user) {
              const newPoints = Math.max(0, user.points + pointsChange);
              await supabase
                .from('users')
                .update({ points: newPoints })
                .eq('id', parlay.user_id);
            }
          } else if (updatePointsError) {
            console.error(`Error updating points for user ${parlay.user_id}:`, updatePointsError);
            continue;
          }

          resolvedParlays++;
        } catch (error) {
          console.error(`Error processing parlay ${parlay.id}:`, error);
        }
      }
    }

    console.log(`Successfully resolved ${resolvedParlays} parlays`);

    return new Response(JSON.stringify({ 
      message: `Resolved ${resolvedCount} bets and ${resolvedParlays} parlays`,
      resolved: resolvedCount,
      resolvedParlays 
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