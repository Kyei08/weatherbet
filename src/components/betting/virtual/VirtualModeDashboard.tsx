import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getUser, getRecentBets } from '@/lib/supabase-auth-storage';
import { User, Bet } from '@/types/supabase-betting';
import { Coins, TrendingUp, Activity, Trophy, ShoppingCart, Layers, History, MapPin, Shield, Gamepad2 } from 'lucide-react';
import { ModeBadge } from '../ModeBadge';
import { useNavigate } from 'react-router-dom';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import BettingSlip from '../BettingSlip';
import ParlayBettingSlip from '../ParlayBettingSlip';
import { CombinedBettingSlip } from '../CombinedBettingSlip';
import MyBets from '../MyBets';
import Leaderboard from '../Leaderboard';
import ActiveBetsWeather from '../ActiveBetsWeather';
import { DailyChallenges } from '../DailyChallenges';
import { Achievements } from '../Achievements';
import { LevelDisplay } from '../LevelDisplay';
import { Perks } from '../Perks';
import { Shop } from '../Shop';
import { BonusTracker } from '../BonusTracker';
import Analytics from '../Analytics';
import { TransactionHistory } from '../TransactionHistory';
import { formatCurrency } from '@/lib/currency';
import { useModeTheme } from '@/hooks/useModeTheme';
import { LiveOddsFeed } from '../LiveOddsFeed';
import { WeatherAccuracy } from '../WeatherAccuracy';

const VirtualModeDashboard = () => {
  const navigate = useNavigate();
  const { isAdminUser } = useAdminCheck();
  const theme = useModeTheme();
  const [user, setUser] = useState<User | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [activeView, setActiveView] = useState<'dashboard' | 'betting' | 'parlay' | 'combined' | 'mybets' | 'leaderboard' | 'shop' | 'analytics'>('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userData, betsData] = await Promise.all([
          getUser(),
          getRecentBets('virtual')
        ]);
        setUser(userData);
        // Filter only virtual bets
        setBets(betsData.filter(bet => bet.currency_type === 'virtual'));
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const refreshData = async () => {
    try {
      const [userData, betsData] = await Promise.all([
        getUser(),
        getRecentBets('virtual')
      ]);
      setUser(userData);
      setBets(betsData.filter(bet => bet.currency_type === 'virtual'));
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) return null;

  const pendingBets = bets.filter(bet => bet.result === 'pending');
  const settledBets = bets.filter(bet => bet.result !== 'pending');
  const winRate = settledBets.length > 0 ? (bets.filter(bet => bet.result === 'win').length / settledBets.length * 100).toFixed(1) : '0';

  if (activeView === 'betting') {
    return <BettingSlip onBack={() => setActiveView('dashboard')} onBetPlaced={refreshData} />;
  }

  if (activeView === 'parlay') {
    return <ParlayBettingSlip onBack={() => setActiveView('dashboard')} onBetPlaced={refreshData} />;
  }

  if (activeView === 'combined') {
    return <CombinedBettingSlip onBack={() => setActiveView('dashboard')} onBetPlaced={refreshData} />;
  }

  if (activeView === 'mybets') {
    return <MyBets onBack={() => setActiveView('dashboard')} onRefresh={refreshData} />;
  }

  if (activeView === 'leaderboard') {
    return <Leaderboard onBack={() => setActiveView('dashboard')} />;
  }

  if (activeView === 'shop') {
    return <Shop onBack={() => setActiveView('dashboard')} />;
  }

  if (activeView === 'analytics') {
    return <Analytics onBack={() => setActiveView('dashboard')} />;
  }

  return (
    <div className={`min-h-screen p-4 transition-colors duration-300 ${theme.gradient}`}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className={`text-center p-6 rounded-xl border-2 ${theme.borderColor} ${theme.cardBg} backdrop-blur-sm ${theme.glowShadow}`}>
          <div className="flex items-center justify-center gap-3 mb-2">
            <h1 className={`text-4xl font-bold ${theme.primaryText}`}>
              🎮 WeatherBet SA
            </h1>
            <ModeBadge size="lg" />
          </div>
          <p className="text-muted-foreground">
            Practice mode - Learn weather betting risk-free with virtual points!
          </p>
          <div className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-virtual-primary/10 border border-virtual-primary/30">
            <Gamepad2 className="h-4 w-4 text-virtual-primary" />
            <span className="text-sm font-semibold text-virtual-primary">Virtual Mode - Practice & Learn</span>
          </div>
        </div>

        {/* Weather Alerts */}
        {bets.length > 0 && <ActiveBetsWeather bets={bets} />}

        {/* Live Odds Feed */}
        <LiveOddsFeed />

        {/* Level Display */}
        <LevelDisplay />

        {/* User Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className={`${theme.card} border-2 ${theme.glowShadow}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">🎮 Virtual Balance</CardTitle>
              <Coins className={`h-4 w-4 ${theme.primaryText}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${theme.primaryText}`}>
                {formatCurrency(user.points, 'virtual')}
              </div>
              <p className={`text-xs ${theme.secondaryText}`}>Practice points - free to play</p>
            </CardContent>
          </Card>

          <Card className={`${theme.card} border-2 ${theme.glowShadow}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
              <TrendingUp className={`h-4 w-4 ${theme.accentText}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${theme.secondaryText}`}>{winRate}%</div>
              <p className="text-xs text-muted-foreground">Success Rate</p>
            </CardContent>
          </Card>

          <Card className={`${theme.card} border-2 ${theme.glowShadow}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Bets</CardTitle>
              <Activity className={`h-4 w-4 ${theme.accentText}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${theme.secondaryText}`}>{pendingBets.length}</div>
              <p className="text-xs text-muted-foreground">Pending Results</p>
            </CardContent>
          </Card>
        </div>

        {/* Daily Challenges */}
        <DailyChallenges />

        {/* Bonus Tracker */}
        <BonusTracker />

        {/* Transaction History */}
        <TransactionHistory />

        {/* Achievements */}
        <Achievements />

        {/* Unlockable Perks */}
        <Perks />

        {/* Weather Accuracy */}
        <WeatherAccuracy />

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button 
            size="lg" 
            className={`h-20 text-lg ${theme.buttonPrimary} border-2 ${theme.borderColor} ${theme.glowShadow} hover:scale-105 transition-all`}
            onClick={() => setActiveView('betting')}
          >
            🎯 Single Bet
          </Button>
          <Button 
            size="lg" 
            className={`h-20 text-lg ${theme.buttonSecondary} border-2 ${theme.borderColor} ${theme.glowShadow} hover:scale-105 transition-all`}
            onClick={() => setActiveView('combined')}
          >
            <Activity className="mr-2 h-5 w-5" />
            ⚡ Combined Bet
          </Button>
          <Button 
            size="lg" 
            className={`h-20 text-lg ${theme.accent} ${theme.primaryForeground} border-2 ${theme.borderColor} ${theme.glowShadow} hover:scale-105 transition-all`}
            onClick={() => setActiveView('parlay')}
          >
            <Layers className="mr-2 h-5 w-5" />
            💰 Parlay Bet
          </Button>
          <Button 
            variant="outline" 
            size="lg" 
            className={`h-20 text-lg border-2 ${theme.borderColorHeavy} ${theme.hoverBg} hover:scale-105 transition-all`}
            onClick={() => setActiveView('mybets')}
          >
            📊 My Bets ({bets.length})
          </Button>
        </div>

        {/* Virtual Mode Specific Actions */}
        <div className={`grid grid-cols-2 gap-4 ${isAdminUser ? 'md:grid-cols-6' : 'md:grid-cols-5'}`}>
          <Button 
            variant="outline" 
            size="lg" 
            className="h-16 text-lg"
            onClick={() => setActiveView('shop')}
          >
            <ShoppingCart className="mr-2 h-5 w-5" />
            🛍️ Shop
          </Button>
          <Button 
            variant="outline" 
            size="lg" 
            className="h-16 text-lg"
            onClick={() => navigate('/purchase-history')}
          >
            <History className="mr-2 h-5 w-5" />
            📜 History
          </Button>
          <Button 
            variant="outline" 
            size="lg" 
            className="h-16 text-lg"
            onClick={() => setActiveView('analytics')}
          >
            <TrendingUp className="mr-2 h-5 w-5" />
            📊 Analytics
          </Button>
          <Button 
            variant="outline" 
            size="lg" 
            className="h-16 text-lg"
            onClick={() => navigate('/city-analytics')}
          >
            <MapPin className="mr-2 h-5 w-5" />
            🏙️ Cities
          </Button>
          <Button 
            variant="outline" 
            size="lg" 
            className="h-16 text-lg"
            onClick={() => setActiveView('leaderboard')}
          >
            <Trophy className="mr-2 h-5 w-5" />
            🏆 Leaderboard
          </Button>
          {isAdminUser && (
            <Button 
              variant="default" 
              size="lg" 
              className="h-16 text-lg bg-gradient-to-r from-purple-600 to-blue-600"
              onClick={() => navigate('/admin')}
            >
              <Shield className="mr-2 h-5 w-5" />
              ⚡ Admin
            </Button>
          )}
        </div>

        {/* Recent Activity */}
        {bets.length > 0 && (
          <Card className={`${theme.card}`}>
            <CardHeader>
              <CardTitle>Recent Virtual Bets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {bets.slice(0, 3).map((bet) => (
                  <div key={bet.id} className={`flex justify-between items-center p-3 border rounded-lg ${theme.borderColor} ${theme.hoverBg}`}>
                    <div>
                      <span className="font-medium">{bet.city}</span>
                      <span className="text-muted-foreground ml-2 text-sm">
                        {bet.prediction_type === 'rain' ? `Rain: ${bet.prediction_value}` : `Temp: ${bet.prediction_value}°C`}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className={`font-medium ${theme.primaryText}`}>
                        {formatCurrency(bet.stake, 'virtual')}
                      </div>
                      <div className={`text-sm ${
                        bet.result === 'win' ? 'text-success' : 
                        bet.result === 'loss' ? 'text-destructive' : 
                        'text-muted-foreground'
                      }`}>
                        {bet.result === 'pending' ? 'Pending' : bet.result.toUpperCase()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default VirtualModeDashboard;
