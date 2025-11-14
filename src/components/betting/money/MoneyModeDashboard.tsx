import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getUser, getRecentBets } from '@/lib/supabase-auth-storage';
import { User, Bet } from '@/types/supabase-betting';
import { Coins, TrendingUp, Activity, Banknote, DollarSign, CreditCard, History, MapPin, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import BettingSlip from '../BettingSlip';
import ParlayBettingSlip from '../ParlayBettingSlip';
import { CombinedBettingSlip } from '../CombinedBettingSlip';
import MyBets from '../MyBets';
import ActiveBetsWeather from '../ActiveBetsWeather';
import Analytics from '../Analytics';
import { formatCurrency } from '@/lib/currency';
import { useModeTheme } from '@/hooks/useModeTheme';

const MoneyModeDashboard = () => {
  const navigate = useNavigate();
  const { isAdminUser } = useAdminCheck();
  const theme = useModeTheme();
  const [user, setUser] = useState<User | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [activeView, setActiveView] = useState<'dashboard' | 'betting' | 'parlay' | 'combined' | 'mybets' | 'analytics'>('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userData, betsData] = await Promise.all([
          getUser(),
          getRecentBets('real')
        ]);
        setUser(userData);
        // Filter only real money bets
        setBets(betsData.filter(bet => bet.currency_type === 'real'));
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
        getRecentBets('real')
      ]);
      setUser(userData);
      setBets(betsData.filter(bet => bet.currency_type === 'real'));
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

  if (activeView === 'analytics') {
    return <Analytics onBack={() => setActiveView('dashboard')} />;
  }

  return (
    <div className={`min-h-screen p-4 transition-colors duration-300 ${theme.gradient}`}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className={`text-center p-6 rounded-xl border-2 ${theme.borderColor} ${theme.cardBg} backdrop-blur-sm ${theme.glowShadow}`}>
          <h1 className={`text-4xl font-bold mb-2 ${theme.primaryText}`}>
            💰 WeatherBet SA - Money Mode
          </h1>
          <p className="text-muted-foreground">
            Real money betting - Win real prizes with weather predictions!
          </p>
          <div className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-real-primary/10 border border-real-primary/30">
            <Banknote className="h-4 w-4 text-real-primary" />
            <span className="text-sm font-semibold text-real-primary">Real Money Mode</span>
          </div>
        </div>

        {/* Weather Alerts */}
        {bets.length > 0 && <ActiveBetsWeather bets={bets} />}

        {/* User Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className={`${theme.card} border-2 ${theme.glowShadow}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">💰 Real Balance</CardTitle>
              <DollarSign className={`h-4 w-4 ${theme.primaryText}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${theme.primaryText}`}>
                {formatCurrency(user.balance_cents || 0, 'real')}
              </div>
              <p className={`text-xs ${theme.secondaryText}`}>South African Rands</p>
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

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Button 
            size="lg" 
            className={`h-20 text-lg ${theme.buttonPrimary} border-2 ${theme.borderColor} ${theme.glowShadow} hover:scale-105 transition-all`}
            onClick={() => setActiveView('betting')}
          >
            🎯 Place Single Bet
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
            <Coins className="mr-2 h-5 w-5" />
            💰 Parlay Bet
          </Button>
        </div>

        {/* Money Mode Specific Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button 
            variant="outline" 
            size="lg" 
            className={`h-16 text-lg border-2 ${theme.borderColorHeavy} ${theme.hoverBg}`}
            onClick={() => setActiveView('mybets')}
          >
            📊 My Bets ({bets.length})
          </Button>
          <Button 
            variant="outline" 
            size="lg" 
            className={`h-16 text-lg border-2 ${theme.borderColorHeavy} ${theme.hoverBg}`}
            onClick={() => navigate('/transactions')}
          >
            <CreditCard className="mr-2 h-5 w-5" />
            💳 Banking
          </Button>
          <Button 
            variant="outline" 
            size="lg" 
            className={`h-16 text-lg border-2 ${theme.borderColorHeavy} ${theme.hoverBg}`}
            onClick={() => setActiveView('analytics')}
          >
            <TrendingUp className="mr-2 h-5 w-5" />
            📊 Analytics
          </Button>
          <Button 
            variant="outline" 
            size="lg" 
            className={`h-16 text-lg border-2 ${theme.borderColorHeavy} ${theme.hoverBg}`}
            onClick={() => navigate('/city-analytics')}
          >
            <MapPin className="mr-2 h-5 w-5" />
            🏙️ Cities
          </Button>
        </div>

        {isAdminUser && (
          <Button 
            variant="default" 
            size="lg" 
            className="w-full h-16 text-lg bg-gradient-to-r from-purple-600 to-blue-600"
            onClick={() => navigate('/admin')}
          >
            <Shield className="mr-2 h-5 w-5" />
            ⚡ Admin Panel
          </Button>
        )}

        {/* Recent Activity */}
        {bets.length > 0 && (
          <Card className={`${theme.card}`}>
            <CardHeader>
              <CardTitle>Recent Real Money Bets</CardTitle>
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
                        {formatCurrency(bet.stake, 'real')}
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

export default MoneyModeDashboard;
