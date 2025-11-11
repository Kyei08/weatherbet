import { Bet } from '@/types/supabase-betting';

export interface CityAnalytics {
  city: string;
  totalBets: number;
  wins: number;
  losses: number;
  winRate: number;
  netProfit: number;
  avgOdds: number;
  avgStake: number;
  rainBets: number;
  rainWins: number;
  rainWinRate: number;
  tempBets: number;
  tempWins: number;
  tempWinRate: number;
  bestPredictionType: string;
  profitByHour: { hour: number; profit: number; bets: number }[];
  profitByDay: { day: string; profit: number; bets: number }[];
  recentForm: ('W' | 'L' | 'P')[];
}

export interface WeatherCorrelation {
  city: string;
  avgWinningOdds: number;
  avgLosingOdds: number;
  highOddsWinRate: number;
  lowOddsWinRate: number;
  optimalOddsRange: { min: number; max: number };
}

export interface BettingWindow {
  city: string;
  bestHour: number;
  bestDay: string;
  worstHour: number;
  worstDay: string;
  hourlyPerformance: { hour: number; winRate: number; profit: number; bets: number }[];
  dailyPerformance: { day: string; winRate: number; profit: number; bets: number }[];
}

export const getCityAnalytics = (bets: Bet[], city: string): CityAnalytics => {
  const cityBets = bets.filter(b => b.city === city);
  const settledBets = cityBets.filter(b => b.result !== 'pending');
  const wins = cityBets.filter(b => b.result === 'win');
  const losses = cityBets.filter(b => b.result === 'loss');

  // Rain vs Temperature analysis
  const rainBets = settledBets.filter(b => b.prediction_type === 'rain');
  const rainWins = rainBets.filter(b => b.result === 'win');
  const tempBets = settledBets.filter(b => b.prediction_type === 'temperature');
  const tempWins = tempBets.filter(b => b.result === 'win');

  const rainWinRate = rainBets.length > 0 ? (rainWins.length / rainBets.length) * 100 : 0;
  const tempWinRate = tempBets.length > 0 ? (tempWins.length / tempBets.length) * 100 : 0;

  // Profit by hour
  const hourlyStats = cityBets.reduce((acc, bet) => {
    const hour = new Date(bet.created_at).getHours();
    if (!acc[hour]) {
      acc[hour] = { profit: 0, bets: 0 };
    }
    acc[hour].bets++;
    if (bet.result === 'win') {
      acc[hour].profit += Math.floor(bet.stake * Number(bet.odds)) - bet.stake;
    } else if (bet.result === 'loss') {
      acc[hour].profit -= bet.stake;
    } else if (bet.result === 'cashed_out' && bet.cashout_amount) {
      acc[hour].profit += bet.cashout_amount - bet.stake;
    }
    return acc;
  }, {} as Record<number, { profit: number; bets: number }>);

  const profitByHour = Object.entries(hourlyStats)
    .map(([hour, stats]) => ({
      hour: parseInt(hour),
      profit: stats.profit,
      bets: stats.bets,
    }))
    .sort((a, b) => a.hour - b.hour);

  // Profit by day of week
  const dailyStats = cityBets.reduce((acc, bet) => {
    const day = new Date(bet.created_at).toLocaleDateString('en-US', { weekday: 'short' });
    if (!acc[day]) {
      acc[day] = { profit: 0, bets: 0 };
    }
    acc[day].bets++;
    if (bet.result === 'win') {
      acc[day].profit += Math.floor(bet.stake * Number(bet.odds)) - bet.stake;
    } else if (bet.result === 'loss') {
      acc[day].profit -= bet.stake;
    } else if (bet.result === 'cashed_out' && bet.cashout_amount) {
      acc[day].profit += bet.cashout_amount - bet.stake;
    }
    return acc;
  }, {} as Record<string, { profit: number; bets: number }>);

  const dayOrder = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const profitByDay = dayOrder
    .filter(day => dailyStats[day])
    .map(day => ({
      day,
      profit: dailyStats[day].profit,
      bets: dailyStats[day].bets,
    }));

  // Recent form (last 10 settled bets)
  const recentForm = settledBets
    .slice(-10)
    .map(bet => {
      if (bet.result === 'win') return 'W';
      if (bet.result === 'loss') return 'L';
      return 'P';
    }) as ('W' | 'L' | 'P')[];

  const netProfit = wins.reduce((sum, b) => sum + Math.floor(b.stake * Number(b.odds)) - b.stake, 0)
    - losses.reduce((sum, b) => sum + b.stake, 0);

  return {
    city,
    totalBets: cityBets.length,
    wins: wins.length,
    losses: losses.length,
    winRate: settledBets.length > 0 ? (wins.length / settledBets.length) * 100 : 0,
    netProfit,
    avgOdds: cityBets.length > 0 ? cityBets.reduce((sum, b) => sum + Number(b.odds), 0) / cityBets.length : 0,
    avgStake: cityBets.length > 0 ? cityBets.reduce((sum, b) => sum + b.stake, 0) / cityBets.length : 0,
    rainBets: rainBets.length,
    rainWins: rainWins.length,
    rainWinRate,
    tempBets: tempBets.length,
    tempWins: tempWins.length,
    tempWinRate,
    bestPredictionType: rainWinRate > tempWinRate ? 'Rain' : 'Temperature',
    profitByHour,
    profitByDay,
    recentForm,
  };
};

export const getWeatherCorrelation = (bets: Bet[], city: string): WeatherCorrelation => {
  const cityBets = bets.filter(b => b.city === city && b.result !== 'pending');
  const wins = cityBets.filter(b => b.result === 'win');
  const losses = cityBets.filter(b => b.result === 'loss');

  const avgWinningOdds = wins.length > 0
    ? wins.reduce((sum, b) => sum + Number(b.odds), 0) / wins.length
    : 0;

  const avgLosingOdds = losses.length > 0
    ? losses.reduce((sum, b) => sum + Number(b.odds), 0) / losses.length
    : 0;

  // High odds (>2.5) vs Low odds (<=2.5) performance
  const highOddsBets = cityBets.filter(b => Number(b.odds) > 2.5);
  const lowOddsBets = cityBets.filter(b => Number(b.odds) <= 2.5);

  const highOddsWinRate = highOddsBets.length > 0
    ? (highOddsBets.filter(b => b.result === 'win').length / highOddsBets.length) * 100
    : 0;

  const lowOddsWinRate = lowOddsBets.length > 0
    ? (lowOddsBets.filter(b => b.result === 'win').length / lowOddsBets.length) * 100
    : 0;

  // Find optimal odds range (most profitable)
  const oddsRanges = [
    { min: 1.0, max: 1.5 },
    { min: 1.5, max: 2.0 },
    { min: 2.0, max: 2.5 },
    { min: 2.5, max: 3.5 },
    { min: 3.5, max: 10.0 },
  ];

  let bestRange = oddsRanges[0];
  let bestProfit = -Infinity;

  oddsRanges.forEach(range => {
    const rangeBets = cityBets.filter(b => Number(b.odds) >= range.min && Number(b.odds) < range.max);
    const profit = rangeBets.reduce((sum, bet) => {
      if (bet.result === 'win') {
        return sum + Math.floor(bet.stake * Number(bet.odds)) - bet.stake;
      } else if (bet.result === 'loss') {
        return sum - bet.stake;
      }
      return sum;
    }, 0);

    if (profit > bestProfit && rangeBets.length >= 3) {
      bestProfit = profit;
      bestRange = range;
    }
  });

  return {
    city,
    avgWinningOdds,
    avgLosingOdds,
    highOddsWinRate,
    lowOddsWinRate,
    optimalOddsRange: bestRange,
  };
};

export const getBettingWindows = (bets: Bet[], city: string): BettingWindow => {
  const cityBets = bets.filter(b => b.city === city);

  // Hourly performance
  const hourlyStats = cityBets.reduce((acc, bet) => {
    const hour = new Date(bet.created_at).getHours();
    if (!acc[hour]) {
      acc[hour] = { wins: 0, total: 0, profit: 0 };
    }
    acc[hour].total++;
    if (bet.result === 'win') {
      acc[hour].wins++;
      acc[hour].profit += Math.floor(bet.stake * Number(bet.odds)) - bet.stake;
    } else if (bet.result === 'loss') {
      acc[hour].profit -= bet.stake;
    } else if (bet.result === 'cashed_out' && bet.cashout_amount) {
      acc[hour].profit += bet.cashout_amount - bet.stake;
    }
    return acc;
  }, {} as Record<number, { wins: number; total: number; profit: number }>);

  const hourlyPerformance = Object.entries(hourlyStats)
    .map(([hour, stats]) => ({
      hour: parseInt(hour),
      winRate: stats.total > 0 ? (stats.wins / stats.total) * 100 : 0,
      profit: stats.profit,
      bets: stats.total,
    }))
    .sort((a, b) => a.hour - b.hour);

  const bestHourData = hourlyPerformance.reduce((best, current) => 
    current.profit > best.profit && current.bets >= 2 ? current : best
  , hourlyPerformance[0] || { hour: 0, profit: -Infinity });

  const worstHourData = hourlyPerformance.reduce((worst, current) => 
    current.profit < worst.profit && current.bets >= 2 ? current : worst
  , hourlyPerformance[0] || { hour: 0, profit: Infinity });

  // Daily performance
  const dailyStats = cityBets.reduce((acc, bet) => {
    const day = new Date(bet.created_at).toLocaleDateString('en-US', { weekday: 'short' });
    if (!acc[day]) {
      acc[day] = { wins: 0, total: 0, profit: 0 };
    }
    acc[day].total++;
    if (bet.result === 'win') {
      acc[day].wins++;
      acc[day].profit += Math.floor(bet.stake * Number(bet.odds)) - bet.stake;
    } else if (bet.result === 'loss') {
      acc[day].profit -= bet.stake;
    } else if (bet.result === 'cashed_out' && bet.cashout_amount) {
      acc[day].profit += bet.cashout_amount - bet.stake;
    }
    return acc;
  }, {} as Record<string, { wins: number; total: number; profit: number }>);

  const dayOrder = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dailyPerformance = dayOrder
    .filter(day => dailyStats[day])
    .map(day => ({
      day,
      winRate: dailyStats[day].total > 0 ? (dailyStats[day].wins / dailyStats[day].total) * 100 : 0,
      profit: dailyStats[day].profit,
      bets: dailyStats[day].total,
    }));

  const bestDayData = dailyPerformance.reduce((best, current) => 
    current.profit > best.profit && current.bets >= 2 ? current : best
  , dailyPerformance[0] || { day: 'N/A', profit: -Infinity });

  const worstDayData = dailyPerformance.reduce((worst, current) => 
    current.profit < worst.profit && current.bets >= 2 ? current : worst
  , dailyPerformance[0] || { day: 'N/A', profit: Infinity });

  return {
    city,
    bestHour: bestHourData?.hour || 0,
    bestDay: bestDayData?.day || 'N/A',
    worstHour: worstHourData?.hour || 0,
    worstDay: worstDayData?.day || 'N/A',
    hourlyPerformance,
    dailyPerformance,
  };
};

export const getAllCitiesComparison = (bets: Bet[]) => {
  const cities = [...new Set(bets.map(b => b.city))];
  return cities.map(city => ({
    city,
    analytics: getCityAnalytics(bets, city),
    correlation: getWeatherCorrelation(bets, city),
    windows: getBettingWindows(bets, city),
  }));
};
