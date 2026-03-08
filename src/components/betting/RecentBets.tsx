import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bet } from '@/types/supabase-betting';

interface RecentBetsProps {
  bets: Bet[];
}

export function RecentBets({ bets }: RecentBetsProps) {
  if (bets.length === 0) return null;

  return (
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
  );
}
