import { Bet } from '@/types/supabase-betting';

export interface BettingStats {
  totalBets: number;
  totalWins: number;
  totalLosses: number;
  pendingBets: number;
  winRate: number;
  totalStaked: number;
  totalWinnings: number;
  netProfit: number;
  roi: number;
  averageStake: number;
  averageOdds: number;
  bestCity: string;
  worstCity: string;
  currentStreak: number;
  longestStreak: number;
  rainWinRate: number;
  tempWinRate: number;
  totalCashOuts: number;
  avgBetsPerDay: number;
  mostActiveBettingHour: number;
}

export interface CityPerformance {
  city: string;
  bets: number;
  wins: number;
  losses: number;
  winRate: number;
  netProfit: number;
}

export interface ProfitLossPoint {
  date: string;
  profit: number;
  cumulativeProfit: number;
}

export interface PredictionTypeStats {
  type: string;
  bets: number;
  wins: number;
  winRate: number;
}

export const calculateBettingStats = (bets: Bet[]): BettingStats => {
  const settledBets = bets.filter(b => b.result !== 'pending');
  const wins = bets.filter(b => b.result === 'win');
  const losses = bets.filter(b => b.result === 'loss');
  const cashOuts = bets.filter(b => b.result === 'cashed_out');

  const totalStaked = bets.reduce((sum, b) => sum + b.stake, 0);
  const totalWinnings = wins.reduce((sum, b) => sum + Math.floor(b.stake * b.odds), 0);
  const netProfit = wins.reduce((sum, b) => sum + Math.floor(b.stake * b.odds) - b.stake, 0) 
                    - losses.reduce((sum, b) => sum + b.stake, 0)
                    + cashOuts.reduce((sum, b) => sum + (b.cashout_amount || 0) - b.stake, 0);

  // Calculate city performance
  const cityStats = bets.reduce((acc, bet) => {
    if (!acc[bet.city]) {
      acc[bet.city] = { wins: 0, total: 0, profit: 0 };
    }
    acc[bet.city].total++;
    if (bet.result === 'win') {
      acc[bet.city].wins++;
      acc[bet.city].profit += Math.floor(bet.stake * bet.odds) - bet.stake;
    } else if (bet.result === 'loss') {
      acc[bet.city].profit -= bet.stake;
    }
    return acc;
  }, {} as Record<string, { wins: number; total: number; profit: number }>);

  const bestCity = Object.entries(cityStats)
    .sort((a, b) => b[1].profit - a[1].profit)[0]?.[0] || 'N/A';
  const worstCity = Object.entries(cityStats)
    .sort((a, b) => a[1].profit - b[1].profit)[0]?.[0] || 'N/A';

  // Calculate streaks
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  
  const sortedBets = [...settledBets].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  sortedBets.forEach((bet, i) => {
    if (bet.result === 'win') {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
      if (i === 0) currentStreak = tempStreak;
    } else {
      tempStreak = 0;
    }
  });

  // Prediction type win rates
  const rainBets = settledBets.filter(b => b.prediction_type === 'rain');
  const tempBets = settledBets.filter(b => b.prediction_type === 'temperature');
  const rainWinRate = rainBets.length > 0 
    ? (rainBets.filter(b => b.result === 'win').length / rainBets.length) * 100 
    : 0;
  const tempWinRate = tempBets.length > 0 
    ? (tempBets.filter(b => b.result === 'win').length / tempBets.length) * 100 
    : 0;

  // Calculate ROI
  const roi = totalStaked > 0 ? (netProfit / totalStaked) * 100 : 0;

  // Calculate betting frequency
  const bettingDays = new Set(bets.map(b => new Date(b.created_at).toDateString())).size;
  const avgBetsPerDay = bettingDays > 0 ? bets.length / bettingDays : 0;

  // Calculate most active betting hour
  const hourCounts = bets.reduce((acc, bet) => {
    const hour = new Date(bet.created_at).getHours();
    acc[hour] = (acc[hour] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
  const mostActiveBettingHour = Object.entries(hourCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ? parseInt(Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0][0]) : 0;

  return {
    totalBets: bets.length,
    totalWins: wins.length,
    totalLosses: losses.length,
    pendingBets: bets.filter(b => b.result === 'pending').length,
    winRate: settledBets.length > 0 ? (wins.length / settledBets.length) * 100 : 0,
    totalStaked,
    totalWinnings,
    netProfit,
    roi,
    averageStake: bets.length > 0 ? totalStaked / bets.length : 0,
    averageOdds: bets.length > 0 ? bets.reduce((sum, b) => sum + Number(b.odds), 0) / bets.length : 0,
    bestCity,
    worstCity,
    currentStreak,
    longestStreak,
    rainWinRate,
    tempWinRate,
    totalCashOuts: cashOuts.length,
    avgBetsPerDay,
    mostActiveBettingHour,
  };
};

export const getCityPerformance = (bets: Bet[]): CityPerformance[] => {
  const cityMap = bets.reduce((acc, bet) => {
    if (!acc[bet.city]) {
      acc[bet.city] = { wins: 0, losses: 0, total: 0, profit: 0 };
    }
    acc[bet.city].total++;
    
    if (bet.result === 'win') {
      acc[bet.city].wins++;
      acc[bet.city].profit += Math.floor(bet.stake * Number(bet.odds)) - bet.stake;
    } else if (bet.result === 'loss') {
      acc[bet.city].losses++;
      acc[bet.city].profit -= bet.stake;
    }
    return acc;
  }, {} as Record<string, { wins: number; losses: number; total: number; profit: number }>);

  return Object.entries(cityMap)
    .map(([city, stats]) => ({
      city,
      bets: stats.total,
      wins: stats.wins,
      losses: stats.losses,
      winRate: stats.total > 0 ? (stats.wins / stats.total) * 100 : 0,
      netProfit: stats.profit,
    }))
    .sort((a, b) => b.bets - a.bets);
};

export const getProfitLossOverTime = (bets: Bet[]): ProfitLossPoint[] => {
  const settledBets = bets
    .filter(b => b.result !== 'pending')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  let cumulativeProfit = 0;
  const points: ProfitLossPoint[] = [];

  settledBets.forEach(bet => {
    let profit = 0;
    if (bet.result === 'win') {
      profit = Math.floor(bet.stake * Number(bet.odds)) - bet.stake;
    } else if (bet.result === 'loss') {
      profit = -bet.stake;
    } else if (bet.result === 'cashed_out' && bet.cashout_amount) {
      profit = bet.cashout_amount - bet.stake;
    }
    
    cumulativeProfit += profit;
    
    points.push({
      date: new Date(bet.created_at).toISOString().split('T')[0],
      profit,
      cumulativeProfit,
    });
  });

  return points;
};

export const getPredictionTypeStats = (bets: Bet[]): PredictionTypeStats[] => {
  const settledBets = bets.filter(b => b.result !== 'pending');
  
  const rainBets = settledBets.filter(b => b.prediction_type === 'rain');
  const tempBets = settledBets.filter(b => b.prediction_type === 'temperature');

  return [
    {
      type: 'Rain',
      bets: rainBets.length,
      wins: rainBets.filter(b => b.result === 'win').length,
      winRate: rainBets.length > 0 ? (rainBets.filter(b => b.result === 'win').length / rainBets.length) * 100 : 0,
    },
    {
      type: 'Temperature',
      bets: tempBets.length,
      wins: tempBets.filter(b => b.result === 'win').length,
      winRate: tempBets.length > 0 ? (tempBets.filter(b => b.result === 'win').length / tempBets.length) * 100 : 0,
    },
  ];
};

export interface BettingPattern {
  date: string;
  betsPlaced: number;
  avgStake: number;
  totalStaked: number;
}

export const getBettingPatterns = (bets: Bet[]): BettingPattern[] => {
  const dailyStats = bets.reduce((acc, bet) => {
    const date = new Date(bet.created_at).toISOString().split('T')[0];
    if (!acc[date]) {
      acc[date] = { bets: [], totalStake: 0 };
    }
    acc[date].bets.push(bet);
    acc[date].totalStake += bet.stake;
    return acc;
  }, {} as Record<string, { bets: Bet[]; totalStake: number }>);

  return Object.entries(dailyStats)
    .map(([date, stats]) => ({
      date,
      betsPlaced: stats.bets.length,
      avgStake: stats.totalStake / stats.bets.length,
      totalStaked: stats.totalStake,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

export interface ROIPoint {
  date: string;
  roi: number;
  invested: number;
  returned: number;
}

export const getROIOverTime = (bets: Bet[]): ROIPoint[] => {
  const settledBets = bets
    .filter(b => b.result !== 'pending')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  let totalInvested = 0;
  let totalReturned = 0;
  const points: ROIPoint[] = [];

  settledBets.forEach(bet => {
    totalInvested += bet.stake;
    
    if (bet.result === 'win') {
      totalReturned += Math.floor(bet.stake * Number(bet.odds));
    } else if (bet.result === 'cashed_out' && bet.cashout_amount) {
      totalReturned += bet.cashout_amount;
    }
    
    const roi = totalInvested > 0 ? ((totalReturned - totalInvested) / totalInvested) * 100 : 0;
    
    points.push({
      date: new Date(bet.created_at).toISOString().split('T')[0],
      roi,
      invested: totalInvested,
      returned: totalReturned,
    });
  });

  return points;
};
