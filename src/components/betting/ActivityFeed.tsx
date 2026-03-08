import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trophy, XCircle, Clock, CloudRain, Thermometer, Wind, Droplets, Gauge, Cloud, Snowflake } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface ActivityItem {
  bet_id: string;
  user_id: string;
  username: string;
  city: string;
  prediction_type: string;
  prediction_value: string;
  stake: number;
  odds: number;
  result: string;
  created_at: string;
  updated_at: string;
}

const getCategoryIcon = (type: string) => {
  switch (type) {
    case 'rain': return <CloudRain className="h-4 w-4" />;
    case 'temperature': return <Thermometer className="h-4 w-4" />;
    case 'wind': return <Wind className="h-4 w-4" />;
    case 'rainfall': return <Droplets className="h-4 w-4" />;
    case 'pressure': return <Gauge className="h-4 w-4" />;
    case 'cloud_coverage': return <Cloud className="h-4 w-4" />;
    case 'snow': return <Snowflake className="h-4 w-4" />;
    default: return <CloudRain className="h-4 w-4" />;
  }
};

const getResultDisplay = (result: string) => {
  switch (result) {
    case 'win':
      return { icon: <Trophy className="h-4 w-4" />, label: 'Won', variant: 'default' as const, className: 'bg-green-500/10 text-green-500 border-green-500/20' };
    case 'loss':
      return { icon: <XCircle className="h-4 w-4" />, label: 'Lost', variant: 'destructive' as const, className: '' };
    default:
      return { icon: <Clock className="h-4 w-4" />, label: 'Pending', variant: 'secondary' as const, className: '' };
  }
};

export function ActivityFeed() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const { data, error } = await supabase.rpc('get_following_activity', { _limit: 20 });
        if (error) throw error;
        setItems((data as ActivityItem[]) || []);
      } catch (e) {
        console.error('Error loading activity feed:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchActivity();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Clock className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No recent activity from followed players</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const resultDisplay = getResultDisplay(item.result);
        const payout = item.result === 'win' ? Math.round(item.stake * item.odds) : 0;

        return (
          <Card key={item.bet_id} className="overflow-hidden">
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="font-semibold text-sm truncate">{item.username}</span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {getCategoryIcon(item.prediction_type)}
                    <span className="capitalize">{item.prediction_type.replace('_', ' ')}</span>
                    <span>in</span>
                    <span className="font-medium text-foreground">{item.city}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-xs">
                    <span>{item.stake} pts @ {Number(item.odds).toFixed(2)}x</span>
                    {payout > 0 && (
                      <span className="text-green-500 font-medium">+{payout} pts</span>
                    )}
                  </div>
                </div>
                <Badge
                  variant={resultDisplay.variant}
                  className={`shrink-0 gap-1 ${resultDisplay.className}`}
                >
                  {resultDisplay.icon}
                  {resultDisplay.label}
                </Badge>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
