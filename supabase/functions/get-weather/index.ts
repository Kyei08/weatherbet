import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WeatherResponse {
  current: {
    temp: number;
    feels_like: number;
    humidity: number;
    pressure: number;
    wind_speed: number;
    weather: Array<{
      main: string;
      description: string;
      icon: string;
    }>;
  };
  daily: Array<{
    dt: number;
    temp: {
      min: number;
      max: number;
      day: number;
    };
    humidity: number;
    wind_speed: number;
    pop: number; // Probability of precipitation
    weather: Array<{
      main: string;
      description: string;
      icon: string;
    }>;
  }>;
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
    const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${coords.lat}&lon=${coords.lon}&exclude=minutely,hourly,alerts&units=metric&appid=${apiKey}`;
    
    console.log(`Fetching weather for ${city}...`);
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('OpenWeather API error:', response.status);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch weather data' }),
        { 
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const data: WeatherResponse = await response.json();
    console.log(`Weather fetched successfully for ${city}`);

    return new Response(
      JSON.stringify({
        city,
        current: {
          temperature: Math.round(data.current.temp),
          feels_like: Math.round(data.current.feels_like),
          humidity: data.current.humidity,
          pressure: data.current.pressure,
          wind_speed: Math.round(data.current.wind_speed * 3.6), // Convert m/s to km/h
          condition: data.current.weather[0].main,
          description: data.current.weather[0].description,
          icon: data.current.weather[0].icon,
        },
        forecast: data.daily.slice(0, 7).map(day => ({
          date: new Date(day.dt * 1000).toISOString(),
          temp_min: Math.round(day.temp.min),
          temp_max: Math.round(day.temp.max),
          temp_day: Math.round(day.temp.day),
          humidity: day.humidity,
          wind_speed: Math.round(day.wind_speed * 3.6),
          rain_probability: Math.round(day.pop * 100),
          condition: day.weather[0].main,
          description: day.weather[0].description,
          icon: day.weather[0].icon,
        })),
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
