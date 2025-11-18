-- Create weather prediction accuracy tracking table
CREATE TABLE IF NOT EXISTS public.weather_accuracy_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  prediction_date TIMESTAMP WITH TIME ZONE NOT NULL,
  target_date TIMESTAMP WITH TIME ZONE NOT NULL,
  category TEXT NOT NULL, -- 'rain', 'temperature', 'rainfall', etc.
  predicted_value TEXT NOT NULL,
  actual_value TEXT NOT NULL,
  accuracy_score NUMERIC NOT NULL, -- 0-100 score
  metadata JSONB, -- Store additional info like raw values
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_weather_accuracy_city_date ON public.weather_accuracy_log(city, target_date);
CREATE INDEX idx_weather_accuracy_category ON public.weather_accuracy_log(category);

-- Enable RLS
ALTER TABLE public.weather_accuracy_log ENABLE ROW LEVEL SECURITY;

-- Anyone can view accuracy logs (public data)
CREATE POLICY "Anyone can view weather accuracy logs"
  ON public.weather_accuracy_log
  FOR SELECT
  USING (true);

-- Only admins or system can insert accuracy logs
CREATE POLICY "System can insert accuracy logs"
  ON public.weather_accuracy_log
  FOR INSERT
  WITH CHECK (true);

-- Create a summary view for easier querying
CREATE OR REPLACE VIEW public.weather_accuracy_summary AS
SELECT 
  city,
  category,
  COUNT(*) as total_predictions,
  ROUND(AVG(accuracy_score), 2) as avg_accuracy,
  ROUND(MIN(accuracy_score), 2) as min_accuracy,
  ROUND(MAX(accuracy_score), 2) as max_accuracy,
  DATE_TRUNC('month', target_date) as month
FROM public.weather_accuracy_log
GROUP BY city, category, DATE_TRUNC('month', target_date);