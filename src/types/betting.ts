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
  predictionType: 'rain' | 'temperature';
  predictionValue: string; // 'yes'/'no' for rain, temperature range for temp
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