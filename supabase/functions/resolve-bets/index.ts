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

    // Get all pending bets that are at least 1 hour old
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: pendingBets, error: betsError } = await supabase
      .from('bets')
      .select('*')
      .eq('result', 'pending')
      .lt('created_at', oneHourAgo);

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
        const pointsChange = isWin ? Math.round(bet.stake * bet.odds) : -bet.stake;

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

    return new Response(JSON.stringify({ 
      message: `Resolved ${resolvedCount} bets`,
      resolved: resolvedCount 
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