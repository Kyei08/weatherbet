import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { city, predictionDate, targetDate, category, predictedValue, actualWeather } = await req.json();

    console.log('Calculating accuracy for:', { city, category, predictedValue, actualWeather });

    let accuracyScore = 0;
    let actualValue = '';
    const metadata: any = {};

    // Calculate accuracy based on category
    if (category === 'rain') {
      const predictedRain = predictedValue === 'yes';
      const actualRain = actualWeather.rain_probability > 50;
      actualValue = actualRain ? 'yes' : 'no';
      accuracyScore = predictedRain === actualRain ? 100 : 0;
      
      metadata.predicted_rain_probability = predictedRain ? '>50%' : '<50%';
      metadata.actual_rain_probability = actualWeather.rain_probability;
    } else if (category === 'temperature') {
      const [minTemp, maxTemp] = predictedValue.split('-').map(Number);
      const actualTemp = actualWeather.temp_day;
      actualValue = `${actualTemp}`;
      
      metadata.predicted_range = { min: minTemp, max: maxTemp };
      metadata.actual_temp = actualTemp;
      
      if (actualTemp >= minTemp && actualTemp <= maxTemp) {
        // Perfect prediction - within range
        accuracyScore = 100;
      } else {
        // Calculate distance from range
        const distance = actualTemp < minTemp 
          ? minTemp - actualTemp 
          : actualTemp - maxTemp;
        
        // Decrease score by 10 points per degree off
        accuracyScore = Math.max(0, 100 - (distance * 10));
      }
    } else if (category === 'rainfall') {
      const [minRain, maxRain] = predictedValue.split('-').map(v => 
        v === '999' ? Infinity : Number(v)
      );
      const actualRain = actualWeather.rainfall || 0;
      actualValue = `${actualRain}`;
      
      metadata.predicted_range = { min: minRain, max: maxRain === Infinity ? '20+' : maxRain };
      metadata.actual_rainfall = actualRain;
      
      if (actualRain >= minRain && actualRain <= maxRain) {
        accuracyScore = 100;
      } else {
        const distance = actualRain < minRain 
          ? minRain - actualRain 
          : actualRain - maxRain;
        accuracyScore = Math.max(0, 100 - (distance * 5));
      }
    } else if (category === 'wind') {
      const [minWind, maxWind] = predictedValue.split('-').map(v => 
        v === '999' ? Infinity : Number(v)
      );
      const actualWind = actualWeather.wind_speed || 0;
      actualValue = `${actualWind}`;
      
      metadata.predicted_range = { min: minWind, max: maxWind === Infinity ? '30+' : maxWind };
      metadata.actual_wind_speed = actualWind;
      
      if (actualWind >= minWind && actualWind <= maxWind) {
        accuracyScore = 100;
      } else {
        const distance = actualWind < minWind 
          ? minWind - actualWind 
          : actualWind - maxWind;
        accuracyScore = Math.max(0, 100 - (distance * 3));
      }
    } else if (category === 'snow') {
      const predictedSnow = predictedValue === 'yes';
      const actualSnow = actualWeather.snow || false;
      actualValue = actualSnow ? 'yes' : 'no';
      accuracyScore = predictedSnow === actualSnow ? 100 : 0;
      
      metadata.predicted_snow = predictedSnow;
      metadata.actual_snow = actualSnow;
    }

    // Insert accuracy log
    const { data, error } = await supabase
      .from('weather_accuracy_log')
      .insert({
        city,
        prediction_date: predictionDate,
        target_date: targetDate,
        category,
        predicted_value: predictedValue,
        actual_value: actualValue,
        accuracy_score: accuracyScore,
        metadata
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting accuracy log:', error);
      throw error;
    }

    console.log('Accuracy calculated:', { accuracyScore, actualValue });

    return new Response(
      JSON.stringify({ 
        success: true, 
        accuracyScore, 
        actualValue,
        metadata,
        logId: data.id 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error calculating accuracy:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
