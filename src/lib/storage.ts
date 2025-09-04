import { Bet, User } from '@/types/betting';

const STORAGE_KEYS = {
  USER: 'weather-betting-user',
  BETS: 'weather-betting-bets',
};

// Generate a unique user ID
const generateUserId = (): string => {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// User management
export const getUser = (): User => {
  const stored = localStorage.getItem(STORAGE_KEYS.USER);
  if (stored) {
    return JSON.parse(stored);
  }
  
  // Create new user with default points
  const newUser: User = {
    id: generateUserId(),
    username: `Player${Math.floor(Math.random() * 10000)}`,
    points: 1000,
    createdAt: new Date().toISOString(),
  };
  
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
  return newUser;
};

export const updateUserPoints = (points: number): void => {
  const user = getUser();
  user.points = points;
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
};

export const updateUsername = (username: string): void => {
  const user = getUser();
  user.username = username;
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
};

// Bet management
export const getBets = (): Bet[] => {
  const stored = localStorage.getItem(STORAGE_KEYS.BETS);
  return stored ? JSON.parse(stored) : [];
};

export const addBet = (bet: Omit<Bet, 'id' | 'createdAt'>): Bet => {
  const newBet: Bet = {
    ...bet,
    id: `bet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
  };
  
  const bets = getBets();
  bets.push(newBet);
  localStorage.setItem(STORAGE_KEYS.BETS, JSON.stringify(bets));
  
  return newBet;
};

export const updateBetResult = (betId: string, result: 'win' | 'loss'): void => {
  const bets = getBets();
  const betIndex = bets.findIndex(bet => bet.id === betId);
  
  if (betIndex !== -1) {
    bets[betIndex].result = result;
    localStorage.setItem(STORAGE_KEYS.BETS, JSON.stringify(bets));
  }
};

export const clearAllData = (): void => {
  localStorage.removeItem(STORAGE_KEYS.USER);
  localStorage.removeItem(STORAGE_KEYS.BETS);
};