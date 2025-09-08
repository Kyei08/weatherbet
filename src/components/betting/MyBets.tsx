import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { getBets, updateBetResult, getUser, updateUserPoints } from '@/lib/supabase-auth-storage';
import { Bet } from '@/types/supabase-betting';
import { useToast } from '@/hooks/use-toast';

interface MyBetsProps {
  onBack: () => void;
  onRefresh: () => void;
}

const MyBets = ({ onBack, onRefresh }: MyBetsProps) => {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchBets = async () => {
      try {
        const data = await getBets();
        setBets(data);
      } catch (error) {
        console.error('Error fetching bets:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchBets();
  }, []);

  const refreshBets = async () => {
    try {
      const data = await getBets();
      setBets(data);
      onRefresh();
    } catch (error) {
      console.error('Error refreshing bets:', error);
    }
  };

  const handleManualSettle = async (bet: Bet, result: 'win' | 'loss') => {
    try {
      await updateBetResult(bet.id, result);
      
      if (result === 'win') {
        const user = await getUser();
        const winnings = Math.floor(bet.stake * Number(bet.odds));
        await updateUserPoints(user.points + winnings);
        
        toast({
          title: "Bet Won! 🎉",
          description: `You won ${winnings} points!`,
        });
      } else {
        toast({
          title: "Bet Lost 😞",
          description: `Better luck next time!`,
        });
      }
      
      await refreshBets();
    } catch (error) {
      console.error('Error settling bet:', error);
      toast({
        title: "Error",
        description: "Failed to settle bet. Please try again.",
        variant: "destructive",
      });
    }
  };

  const pendingBets = bets.filter(bet => bet.result === 'pending');
  const settledBets = bets.filter(bet => bet.result !== 'pending');

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getBadgeVariant = (result: string) => {
    switch (result) {
      case 'win': return 'default';
      case 'loss': return 'destructive';
      default: return 'secondary';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading bets...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold">My Bets</h1>
          </div>
          <Button variant="outline" size="sm" onClick={refreshBets}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Pending Bets */}
        {pendingBets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Pending Bets ({pendingBets.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingBets.map((bet) => (
                  <div key={bet.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg">{bet.city}</h3>
                        <p className="text-muted-foreground">
                          {bet.prediction_type === 'rain' 
                            ? `Rain: ${bet.prediction_value}` 
                            : `Temperature: ${bet.prediction_value}°C`
                          }
                        </p>
                        <p className="text-sm text-muted-foreground">{formatDate(bet.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={getBadgeVariant(bet.result)}>
                          {bet.result.toUpperCase()}
                        </Badge>
                        <p className="text-sm mt-1">Stake: {bet.stake} pts</p>
                        <p className="text-sm">Odds: {bet.odds}x</p>
                      </div>
                    </div>
                    
                    {/* Manual Settlement Buttons */}
                    <div className="flex gap-2 pt-2 border-t">
                      <p className="text-sm text-muted-foreground mr-auto">Manual Settlement:</p>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleManualSettle(bet, 'win')}
                        className="text-green-600 border-green-200 hover:bg-green-50"
                      >
                        Mark as Win
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleManualSettle(bet, 'loss')}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        Mark as Loss
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Settled Bets */}
        {settledBets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Bet History ({settledBets.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {settledBets.map((bet) => (
                  <div key={bet.id} className="flex justify-between items-center p-3 border rounded">
                    <div>
                      <h3 className="font-medium">{bet.city}</h3>
                      <p className="text-sm text-muted-foreground">
                        {bet.prediction_type === 'rain' 
                          ? `Rain: ${bet.prediction_value}` 
                          : `Temperature: ${bet.prediction_value}°C`
                        }
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(bet.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant={getBadgeVariant(bet.result)}>
                        {bet.result.toUpperCase()}
                      </Badge>
                      <p className="text-sm mt-1">
                        {bet.result === 'win' 
                          ? `+${Math.floor(bet.stake * Number(bet.odds))} pts`
                          : `-${bet.stake} pts`
                        }
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* No Bets */}
        {bets.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground text-lg">No bets placed yet</p>
              <Button className="mt-4" onClick={onBack}>
                Place Your First Bet
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MyBets;