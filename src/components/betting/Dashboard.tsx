import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getUser, getRecentBets } from '@/lib/supabase-auth-storage';
import { User, Bet } from '@/types/supabase-betting';
import { Coins, TrendingUp, Activity, Trophy } from 'lucide-react';
import BettingSlip from './BettingSlip';
import MyBets from './MyBets';
import Leaderboard from './Leaderboard';

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [activeView, setActiveView] = useState<'dashboard' | 'betting' | 'mybets' | 'leaderboard'>('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userData, betsData] = await Promise.all([
          getUser(),
          getRecentBets()
        ]);
        setUser(userData);
        setBets(betsData);
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
        getRecentBets()
      ]);
      setUser(userData);
      setBets(betsData);
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

  if (activeView === 'mybets') {
    return <MyBets onBack={() => setActiveView('dashboard')} onRefresh={refreshData} />;
  }

  if (activeView === 'leaderboard') {
    return <Leaderboard onBack={() => setActiveView('dashboard')} />;
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground mb-2">🌦️ Weather Betting</h1>
          <p className="text-muted-foreground">Predict the weather, win points!</p>
        </div>

        {/* User Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Balance</CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{user.points.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Demo Points</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{winRate}%</div>
              <p className="text-xs text-muted-foreground">Success Rate</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Bets</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingBets.length}</div>
              <p className="text-xs text-muted-foreground">Pending Results</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button 
            size="lg" 
            className="h-20 text-lg"
            onClick={() => setActiveView('betting')}
          >
            🎯 Place New Bet
          </Button>
          <Button 
            variant="outline" 
            size="lg" 
            className="h-20 text-lg"
            onClick={() => setActiveView('mybets')}
          >
            📊 My Bets ({bets.length})
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center">
          <Button 
            variant="outline" 
            size="lg" 
            className="h-16 text-lg"
            onClick={() => setActiveView('leaderboard')}
          >
            <Trophy className="mr-2 h-5 w-5" />
            🏆 Leaderboard
          </Button>
        </div>

        {/* Recent Activity */}
        {bets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Bets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {bets.slice(0, 3).map((bet) => (
                  <div key={bet.id} className="flex justify-between items-center p-2 border rounded">
                    <div>
                      <span className="font-medium">{bet.city}</span>
                      <span className="text-muted-foreground ml-2">
                        {bet.prediction_type === 'rain' ? `Rain: ${bet.prediction_value}` : `Temp: ${bet.prediction_value}°C`}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{bet.stake} pts</div>
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

export default Dashboard;