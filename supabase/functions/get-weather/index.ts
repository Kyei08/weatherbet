import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to process forecast data into daily summaries
function processForecastData(forecastList: any[]): any[] {
  const dailyData = new Map();
  
  forecastList.forEach(item => {
    const date = new Date(item.dt * 1000).toISOString().split('T')[0];
    
    if (!dailyData.has(date)) {
      dailyData.set(date, {
        date: new Date(item.dt * 1000).toISOString(),
        temps: [item.main.temp],
        humidity: item.main.humidity,
        wind_speed: item.wind.speed,
        rain_probability: (item.pop || 0) * 100,
        condition: item.weather[0].main,
        description: item.weather[0].description,
        icon: item.weather[0].icon,
      });
    } else {
      const dayData = dailyData.get(date);
      dayData.temps.push(item.main.temp);
      dayData.rain_probability = Math.max(dayData.rain_probability, (item.pop || 0) * 100);
    }
  });
  
  return Array.from(dailyData.values()).slice(0, 7).map(day => ({
    date: day.date,
    temp_min: Math.round(Math.min(...day.temps)),
    temp_max: Math.round(Math.max(...day.temps)),
    temp_day: Math.round(day.temps.reduce((a: number, b: number) => a + b, 0) / day.temps.length),
    humidity: day.humidity,
    wind_speed: Math.round(day.wind_speed * 3.6),
    rain_probability: Math.round(day.rain_probability),
    condition: day.condition,
    description: day.description,
    icon: day.icon,
  }));
}

const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  'New York': { lat: 40.7128, lon: -74.0060 },
  'Tokyo': { lat: 35.6762, lon: 139.6503 },
  'London': { lat: 51.5074, lon: -0.1278 },
  'Paris': { lat: 48.8566, lon: 2.3522 },
  'Sydney': { lat: -33.8688, lon: 151.2093 },
  'Cape Town': { lat: -33.9249, lon: 18.4241 },
  'Sao Paulo': { lat: -23.5505, lon: -46.6333 },
  'Mumbai': { lat: 19.0760, lon: 72.8777 },
  'Cairo': { lat: 30.0444, lon: 31.2357 },
  'Toronto': { lat: 43.6532, lon: -79.3832 },
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { city } = await req.json();
    
    if (!city || !CITY_COORDS[city]) {
      return new Response(
        JSON.stringify({ error: 'Invalid city' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const apiKey = Deno.env.get('OPENWEATHER_API_KEY');
    if (!apiKey) {
      console.error('OPENWEATHER_API_KEY not found');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const coords = CITY_COORDS[city];
    
    console.log(`Fetching weather for ${city}...`);
    
    // Fetch current weather (free tier API)
    const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${coords.lat}&lon=${coords.lon}&units=metric&appid=${apiKey}`;
    const currentResponse = await fetch(currentUrl);
    
    if (!currentResponse.ok) {
      console.error('OpenWeather API error:', currentResponse.status);
      const errorData = await currentResponse.text();
      console.error('Error details:', errorData);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch weather data' }),
        { 
          status: currentResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const currentData = await currentResponse.json();
    
    // Fetch 5-day forecast (free tier API)
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${coords.lat}&lon=${coords.lon}&units=metric&appid=${apiKey}`;
    const forecastResponse = await fetch(forecastUrl);
    
    if (!forecastResponse.ok) {
      console.error('OpenWeather Forecast API error:', forecastResponse.status);
      const errorData = await forecastResponse.text();
      console.error('Error details:', errorData);
    }
    
    const forecastData = forecastResponse.ok ? await forecastResponse.json() : null;
    console.log(`Weather fetched successfully for ${city}`);

    // Process forecast data - group by day and get daily highs/lows
    const dailyForecast = forecastData?.list ? processForecastData(forecastData.list) : [];

    return new Response(
      JSON.stringify({
        city,
        current: {
          temperature: Math.round(currentData.main.temp),
          feels_like: Math.round(currentData.main.feels_like),
          humidity: currentData.main.humidity,
          pressure: currentData.main.pressure,
          wind_speed: Math.round(currentData.wind.speed * 3.6), // Convert m/s to km/h
          condition: currentData.weather[0].main,
          description: currentData.weather[0].description,
          icon: currentData.weather[0].icon,
        },
        forecast: dailyForecast,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in get-weather function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
