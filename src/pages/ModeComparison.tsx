import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, TrendingUp, TrendingDown, Trophy, Zap, DollarSign, Coins, Target, Percent } from 'lucide-react';
import { getBets } from '@/lib/supabase-auth-storage';
import { Bet } from '@/types/supabase-betting';
import { calculateBettingStats, BettingStats } from '@/lib/betting-analytics';
import { formatCurrency } from '@/lib/currency';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const ModeComparison = () => {
  const navigate = useNavigate();
  const [virtualBets, setVirtualBets] = useState<Bet[]>([]);
  const [realBets, setRealBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllBets();
  }, []);

  const loadAllBets = async () => {
    try {
      setLoading(true);
      const [virtualData, realData] = await Promise.all([
        getBets(undefined, 'virtual'),
        getBets(undefined, 'real')
      ]);
      setVirtualBets(virtualData);
      setRealBets(realData);
    } catch (error) {
      console.error('Error loading bets:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const virtualStats = calculateBettingStats(virtualBets);
  const realStats = calculateBettingStats(realBets);

  const StatCard = ({ 
    icon: Icon, 
    label, 
    virtualValue, 
    realValue, 
    isPercentage = false,
    isCurrency = false 
  }: { 
    icon: any; 
    label: string; 
    virtualValue: number | string; 
    realValue: number | string;
    isPercentage?: boolean;
    isCurrency?: boolean;
  }) => (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Icon className="h-4 w-4" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Coins className="h-3 w-3" />
            <span>Virtual</span>
          </div>
          <p className="text-2xl font-bold">
            {isCurrency 
              ? formatCurrency(Number(virtualValue), 'virtual')
              : isPercentage 
                ? `${Number(virtualValue).toFixed(1)}%`
                : virtualValue}
          </p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <DollarSign className="h-3 w-3" />
            <span>Real Money</span>
          </div>
          <p className="text-2xl font-bold">
            {isCurrency 
              ? formatCurrency(Number(realValue), 'real')
              : isPercentage 
                ? `${Number(realValue).toFixed(1)}%`
                : realValue}
          </p>
        </div>
      </CardContent>
    </Card>
  );

  const PerformanceComparison = ({ virtualStats, realStats }: { virtualStats: BettingStats; realStats: BettingStats }) => {
    const virtualPerformance = virtualStats.roi;
    const realPerformance = realStats.roi;
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Performance Comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Coins className="h-4 w-4" />
                Virtual ROI
              </span>
              <span className={`font-semibold ${virtualPerformance >= 0 ? 'text-success' : 'text-destructive'}`}>
                {virtualPerformance.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full ${virtualPerformance >= 0 ? 'bg-success' : 'bg-destructive'}`}
                style={{ width: `${Math.min(Math.abs(virtualPerformance), 100)}%` }}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Real Money ROI
              </span>
              <span className={`font-semibold ${realPerformance >= 0 ? 'text-success' : 'text-destructive'}`}>
                {realPerformance.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full ${realPerformance >= 0 ? 'bg-success' : 'bg-destructive'}`}
                style={{ width: `${Math.min(Math.abs(realPerformance), 100)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
            Mode Comparison
          </h1>
          <p className="text-muted-foreground">
            Compare your performance across Virtual Points and Real Money betting
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
          <StatCard
            icon={Target}
            label="Total Bets"
            virtualValue={virtualStats.totalBets}
            realValue={realStats.totalBets}
          />
          
          <StatCard
            icon={Trophy}
            label="Total Wins"
            virtualValue={virtualStats.totalWins}
            realValue={realStats.totalWins}
          />
          
          <StatCard
            icon={Percent}
            label="Win Rate"
            virtualValue={virtualStats.winRate}
            realValue={realStats.winRate}
            isPercentage
          />
          
          <StatCard
            icon={Zap}
            label="Total Staked"
            virtualValue={virtualStats.totalStaked}
            realValue={realStats.totalStaked}
            isCurrency
          />
          
          <StatCard
            icon={TrendingUp}
            label="Total Winnings"
            virtualValue={virtualStats.totalWinnings}
            realValue={realStats.totalWinnings}
            isCurrency
          />
          
          <StatCard
            icon={virtualStats.netProfit >= 0 ? TrendingUp : TrendingDown}
            label="Net Profit"
            virtualValue={virtualStats.netProfit}
            realValue={realStats.netProfit}
            isCurrency
          />
        </div>

        <PerformanceComparison virtualStats={virtualStats} realStats={realStats} />

        <div className="grid gap-6 md:grid-cols-2 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-primary" />
                Virtual Mode Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pending Bets</span>
                  <span className="font-semibold">{virtualStats.pendingBets}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Average Stake</span>
                  <span className="font-semibold">{formatCurrency(virtualStats.averageStake, 'virtual')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Average Odds</span>
                  <span className="font-semibold">{virtualStats.averageOdds.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current Streak</span>
                  <span className="font-semibold">{virtualStats.currentStreak}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Longest Streak</span>
                  <span className="font-semibold">{virtualStats.longestStreak}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Best City</span>
                  <span className="font-semibold">{virtualStats.bestCity}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-success" />
                Real Money Mode Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pending Bets</span>
                  <span className="font-semibold">{realStats.pendingBets}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Average Stake</span>
                  <span className="font-semibold">{formatCurrency(realStats.averageStake, 'real')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Average Odds</span>
                  <span className="font-semibold">{realStats.averageOdds.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current Streak</span>
                  <span className="font-semibold">{realStats.currentStreak}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Longest Streak</span>
                  <span className="font-semibold">{realStats.longestStreak}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Best City</span>
                  <span className="font-semibold">{realStats.bestCity}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ModeComparison;
