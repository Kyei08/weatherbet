import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Deviation thresholds for dispute detection (per category)
const DISPUTE_THRESHOLDS: Record<string, number> = {
  temperature: 3,      // 3°C difference triggers dispute
  rain: 0,             // Binary - any difference is a dispute
  rainfall: 5,         // 5mm difference
  wind: 10,            // 10 km/h difference
  humidity: 15,        // 15% difference
  pressure: 10,        // 10 hPa difference
  cloud_coverage: 20,  // 20% difference
  snow: 0,             // Binary - any difference is a dispute
};

// City coordinates for WeatherAPI
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

interface WeatherSourceData {
  temperature: number;
  humidity: number;
  wind_speed: number;  // in km/h
  pressure: number;
  cloud_coverage: number;
  is_raining: boolean;
  rain_amount: number;
  is_snowing: boolean;
  condition: string;
  raw_data: any;
}

interface VerificationResult {
  city: string;
  category: string;
  primary_value: string;
  secondary_value: string;
  deviation_percentage: number;
  is_disputed: boolean;
  resolution_method?: string;
  final_value?: string;
  confidence_score: number;
}

// Fetch weather from OpenWeatherMap (primary source)
async function fetchOpenWeatherMap(city: string, apiKey: string): Promise<WeatherSourceData | null> {
  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`
    );
    
    if (!response.ok) {
      console.error(`OpenWeatherMap error for ${city}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    return {
      temperature: data.main?.temp ?? 0,
      humidity: data.main?.humidity ?? 0,
      wind_speed: (data.wind?.speed ?? 0) * 3.6, // Convert m/s to km/h
      pressure: data.main?.pressure ?? 0,
      cloud_coverage: data.clouds?.all ?? 0,
      is_raining: data.weather?.some((w: any) => 
        w.main?.toLowerCase() === 'rain' || 
        w.description?.toLowerCase().includes('rain')
      ) || (data.rain?.['1h'] || 0) > 0,
      rain_amount: (data.rain?.['1h'] || 0) + (data.rain?.['3h'] || 0),
      is_snowing: data.weather?.some((w: any) => 
        w.main?.toLowerCase() === 'snow' || 
        w.description?.toLowerCase().includes('snow')
      ) || (data.snow?.['1h'] || 0) > 0,
      condition: data.weather?.[0]?.main ?? 'Unknown',
      raw_data: data,
    };
  } catch (error) {
    console.error(`OpenWeatherMap fetch error for ${city}:`, error);
    return null;
  }
}

// Fetch weather from WeatherAPI.com (secondary source)
async function fetchWeatherAPI(city: string, apiKey: string): Promise<WeatherSourceData | null> {
  try {
    const coords = CITY_COORDS[city];
    const query = coords ? `${coords.lat},${coords.lon}` : encodeURIComponent(city);
    
    const response = await fetch(
      `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${query}`
    );
    
    if (!response.ok) {
      console.error(`WeatherAPI error for ${city}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const current = data.current;
    
    return {
      temperature: current?.temp_c ?? 0,
      humidity: current?.humidity ?? 0,
      wind_speed: current?.wind_kph ?? 0,
      pressure: current?.pressure_mb ?? 0,
      cloud_coverage: current?.cloud ?? 0,
      is_raining: current?.precip_mm > 0 || 
        current?.condition?.text?.toLowerCase().includes('rain'),
      rain_amount: current?.precip_mm ?? 0,
      is_snowing: current?.condition?.text?.toLowerCase().includes('snow'),
      condition: current?.condition?.text ?? 'Unknown',
      raw_data: data,
    };
  } catch (error) {
    console.error(`WeatherAPI fetch error for ${city}:`, error);
    return null;
  }
}

// Calculate deviation between two numeric values
function calculateDeviation(primary: number, secondary: number): number {
  if (primary === 0 && secondary === 0) return 0;
  const avg = (primary + secondary) / 2;
  if (avg === 0) return Math.abs(primary - secondary) * 100;
  return Math.abs(primary - secondary) / Math.abs(avg) * 100;
}

// Resolve disputed weather data
function resolveDispute(
  category: string,
  primaryData: WeatherSourceData,
  secondaryData: WeatherSourceData
): { method: string; value: string } {
  // Resolution strategies based on category
  switch (category) {
    case 'temperature':
    case 'humidity':
    case 'pressure':
    case 'cloud_coverage':
    case 'wind':
      // Use average for numeric values
      const primaryVal = (primaryData as any)[category === 'wind' ? 'wind_speed' : category];
      const secondaryVal = (secondaryData as any)[category === 'wind' ? 'wind_speed' : category];
      const avgValue = (primaryVal + secondaryVal) / 2;
      return {
        method: 'average',
        value: avgValue.toFixed(1),
      };
    
    case 'rain':
    case 'snow':
      // For binary conditions, if either source reports it, consider it true
      // This is more conservative for bettors
      const primaryBool = category === 'rain' ? primaryData.is_raining : primaryData.is_snowing;
      const secondaryBool = category === 'rain' ? secondaryData.is_raining : secondaryData.is_snowing;
      return {
        method: 'conservative_or',
        value: (primaryBool || secondaryBool) ? 'yes' : 'no',
      };
    
    case 'rainfall':
      // Use the higher rainfall value (conservative)
      const maxRain = Math.max(primaryData.rain_amount, secondaryData.rain_amount);
      return {
        method: 'conservative_max',
        value: maxRain.toFixed(1),
      };
    
    default:
      // Default to primary source
      return {
        method: 'primary_source',
        value: String((primaryData as any)[category] ?? 'unknown'),
      };
  }
}

// Verify weather data for a specific category
function verifyCategory(
  city: string,
  category: string,
  primaryData: WeatherSourceData,
  secondaryData: WeatherSourceData
): VerificationResult {
  let primaryValue: string;
  let secondaryValue: string;
  let deviation: number;
  
  switch (category) {
    case 'temperature':
      primaryValue = primaryData.temperature.toFixed(1);
      secondaryValue = secondaryData.temperature.toFixed(1);
      deviation = Math.abs(primaryData.temperature - secondaryData.temperature);
      break;
    
    case 'humidity':
      primaryValue = primaryData.humidity.toFixed(0);
      secondaryValue = secondaryData.humidity.toFixed(0);
      deviation = Math.abs(primaryData.humidity - secondaryData.humidity);
      break;
    
    case 'wind':
      primaryValue = primaryData.wind_speed.toFixed(1);
      secondaryValue = secondaryData.wind_speed.toFixed(1);
      deviation = Math.abs(primaryData.wind_speed - secondaryData.wind_speed);
      break;
    
    case 'pressure':
      primaryValue = primaryData.pressure.toFixed(0);
      secondaryValue = secondaryData.pressure.toFixed(0);
      deviation = Math.abs(primaryData.pressure - secondaryData.pressure);
      break;
    
    case 'cloud_coverage':
      primaryValue = primaryData.cloud_coverage.toFixed(0);
      secondaryValue = secondaryData.cloud_coverage.toFixed(0);
      deviation = Math.abs(primaryData.cloud_coverage - secondaryData.cloud_coverage);
      break;
    
    case 'rain':
      primaryValue = primaryData.is_raining ? 'yes' : 'no';
      secondaryValue = secondaryData.is_raining ? 'yes' : 'no';
      deviation = primaryValue === secondaryValue ? 0 : 100;
      break;
    
    case 'rainfall':
      primaryValue = primaryData.rain_amount.toFixed(1);
      secondaryValue = secondaryData.rain_amount.toFixed(1);
      deviation = Math.abs(primaryData.rain_amount - secondaryData.rain_amount);
      break;
    
    case 'snow':
      primaryValue = primaryData.is_snowing ? 'yes' : 'no';
      secondaryValue = secondaryData.is_snowing ? 'yes' : 'no';
      deviation = primaryValue === secondaryValue ? 0 : 100;
      break;
    
    default:
      primaryValue = 'unknown';
      secondaryValue = 'unknown';
      deviation = 0;
  }
  
  const threshold = DISPUTE_THRESHOLDS[category] ?? 10;
  const isDisputed = deviation > threshold;
  
  // Calculate confidence score (0-100)
  const confidenceScore = Math.max(0, 100 - (deviation / threshold) * 50);
  
  const result: VerificationResult = {
    city,
    category,
    primary_value: primaryValue,
    secondary_value: secondaryValue,
    deviation_percentage: calculateDeviation(parseFloat(primaryValue) || 0, parseFloat(secondaryValue) || 0),
    is_disputed: isDisputed,
    confidence_score: Math.round(confidenceScore),
  };
  
  // If disputed, resolve it
  if (isDisputed) {
    const resolution = resolveDispute(category, primaryData, secondaryData);
    result.resolution_method = resolution.method;
    result.final_value = resolution.value;
  } else {
    result.final_value = primaryValue;
  }
  
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openWeatherApiKey = Deno.env.get('OPENWEATHER_API_KEY')!;
    const weatherApiKey = Deno.env.get('WEATHERAPI_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { city, categories } = await req.json();
    
    if (!city) {
      return new Response(
        JSON.stringify({ error: 'City is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Verifying weather for ${city}...`);
    
    // Fetch from both sources in parallel
    const [primaryData, secondaryData] = await Promise.all([
      fetchOpenWeatherMap(city, openWeatherApiKey),
      fetchWeatherAPI(city, weatherApiKey),
    ]);
    
    if (!primaryData) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch from primary weather source' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // If secondary source fails, return primary data with warning
    const secondaryAvailable = !!secondaryData;
    const effectiveSecondary = secondaryData || primaryData;
    
    // Determine which categories to verify
    const categoriesToVerify = categories || [
      'temperature', 'humidity', 'wind', 'pressure', 
      'cloud_coverage', 'rain', 'rainfall', 'snow'
    ];
    
    // Verify each category
    const verificationResults: VerificationResult[] = [];
    for (const category of categoriesToVerify) {
      const result = verifyCategory(city, category, primaryData, effectiveSecondary);
      verificationResults.push(result);
      
      // Log verification to database
      try {
        await supabase.from('weather_verification_log').insert({
          city,
          category,
          primary_value: result.primary_value,
          secondary_value: result.secondary_value,
          deviation_percentage: result.deviation_percentage,
          is_disputed: result.is_disputed,
          resolution_method: result.resolution_method,
          final_value: result.final_value,
          metadata: {
            primary_source: 'openweathermap',
            secondary_source: secondaryAvailable ? 'weatherapi' : 'unavailable',
            primary_raw: primaryData.raw_data,
            secondary_raw: secondaryAvailable ? secondaryData?.raw_data : null,
            confidence_score: result.confidence_score,
          },
        });
      } catch (logError) {
        console.error('Failed to log verification:', logError);
      }
    }
    
    // Summary
    const disputedCategories = verificationResults.filter(r => r.is_disputed);
    const avgConfidence = verificationResults.reduce((sum, r) => sum + r.confidence_score, 0) / verificationResults.length;
    
    console.log(`Verification complete for ${city}: ${disputedCategories.length} disputes, ${avgConfidence.toFixed(0)}% avg confidence`);
    
    return new Response(
      JSON.stringify({
        city,
        verified_at: new Date().toISOString(),
        sources: {
          primary: 'openweathermap',
          secondary: secondaryAvailable ? 'weatherapi' : 'unavailable',
        },
        results: verificationResults,
        summary: {
          total_categories: verificationResults.length,
          disputed_count: disputedCategories.length,
          disputed_categories: disputedCategories.map(d => d.category),
          average_confidence: Math.round(avgConfidence),
          all_sources_available: secondaryAvailable,
        },
        verified_values: Object.fromEntries(
          verificationResults.map(r => [r.category, r.final_value])
        ),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Weather verification error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
