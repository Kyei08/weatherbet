import { Database } from '@/integrations/supabase/types';

export type User = Database['public']['Tables']['users']['Row'];
export type Bet = Database['public']['Tables']['bets']['Row'];

export const CITIES = [
  'New York',
  'Tokyo', 
  'London',
  'Paris',
  'Sydney',
  'Cape Town',
  'Sao Paulo',
  'Mumbai',
  'Cairo',
  'Toronto'
] as const;

export type City = typeof CITIES[number];

export const TEMPERATURE_RANGES = [
  { label: '20-25°C', value: '20-25', odds: 2.5 },
  { label: '25-30°C', value: '25-30', odds: 2.0 },  
  { label: '30-35°C', value: '30-35', odds: 3.0 },
] as const;