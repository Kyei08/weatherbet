-- Create table for weather verification logs
CREATE TABLE public.weather_verification_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city TEXT NOT NULL,
  verification_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  primary_source TEXT NOT NULL DEFAULT 'openweathermap',
  secondary_source TEXT NOT NULL DEFAULT 'weatherapi',
  category TEXT NOT NULL,
  primary_value TEXT NOT NULL,
  secondary_value TEXT NOT NULL,
  deviation_percentage NUMERIC(5, 2),
  is_disputed BOOLEAN NOT NULL DEFAULT false,
  resolution_method TEXT,
  final_value TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for quick lookup by city and time
CREATE INDEX idx_weather_verification_city_time ON public.weather_verification_log(city, verification_time DESC);

-- Create index for disputed verifications
CREATE INDEX idx_weather_verification_disputed ON public.weather_verification_log(is_disputed) WHERE is_disputed = true;

-- Enable RLS
ALTER TABLE public.weather_verification_log ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read verification logs (transparency)
CREATE POLICY "Anyone can view weather verification logs" 
ON public.weather_verification_log 
FOR SELECT 
USING (true);

-- Only service role can insert/update (edge functions)
CREATE POLICY "Service role can manage verification logs" 
ON public.weather_verification_log 
FOR ALL 
USING (true);

-- Create view for verification summary by city
CREATE OR REPLACE VIEW public.weather_verification_summary AS
SELECT 
  city,
  COUNT(*) as total_verifications,
  SUM(CASE WHEN is_disputed THEN 1 ELSE 0 END) as disputed_count,
  AVG(ABS(deviation_percentage)) as avg_deviation,
  MAX(verification_time) as last_verification
FROM public.weather_verification_log
GROUP BY city;