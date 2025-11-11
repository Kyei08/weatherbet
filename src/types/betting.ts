export interface User {
  id: string;
  username: string;
  points: number;
  createdAt: string;
}

export interface Bet {
  id: string;
  userId: string;
  city: string;
  predictionType: 'rain' | 'temperature' | 'rainfall' | 'snow' | 'wind' | 'dew_point' | 'pressure' | 'cloud_coverage';
  predictionValue: string; // 'yes'/'no' for rain/snow, ranges for others
  stake: number;
  odds: number;
  result: 'pending' | 'win' | 'loss';
  createdAt: string;
}

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

export const RAINFALL_RANGES = [
  { label: '0-5mm', value: '0-5', odds: 2.0 },
  { label: '5-10mm', value: '5-10', odds: 2.5 },
  { label: '10-20mm', value: '10-20', odds: 3.0 },
  { label: '20+mm', value: '20-999', odds: 4.0 },
] as const;

export const WIND_RANGES = [
  { label: '0-10 km/h', value: '0-10', odds: 2.0 },
  { label: '10-20 km/h', value: '10-20', odds: 2.2 },
  { label: '20-30 km/h', value: '20-30', odds: 2.5 },
  { label: '30+ km/h', value: '30-999', odds: 3.5 },
] as const;

export const DEW_POINT_RANGES = [
  { label: '0-10°C', value: '0-10', odds: 2.0 },
  { label: '10-15°C', value: '10-15', odds: 2.2 },
  { label: '15-20°C', value: '15-20', odds: 2.5 },
  { label: '20+°C', value: '20-999', odds: 3.0 },
] as const;

export const PRESSURE_RANGES = [
  { label: '980-1000 hPa', value: '980-1000', odds: 2.5 },
  { label: '1000-1020 hPa', value: '1000-1020', odds: 2.0 },
  { label: '1020-1040 hPa', value: '1020-1040', odds: 2.5 },
] as const;

export const CLOUD_COVERAGE_RANGES = [
  { label: '0-25%', value: '0-25', odds: 2.5 },
  { label: '25-50%', value: '25-50', odds: 2.2 },
  { label: '50-75%', value: '50-75', odds: 2.2 },
  { label: '75-100%', value: '75-100', odds: 2.5 },
] as const;