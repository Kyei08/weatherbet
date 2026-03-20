import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Swords, Check, X, Clock, Trophy, Loader2, MapPin, Thermometer, CloudRain } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getMyChallenges,
  acceptChallenge,
  declineChallenge,
  cancelChallenge,
  subscribeToChallenges,
  PlayerChallengeWithUsers,
} from '@/lib/supabase-player-challenges';
import { TEMPERATURE_RANGES, RAINFALL_RANGES } from '@/types/supabase-betting';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  accepted: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  completed: 'bg-green-500/10 text-green-600 border-green-500/20',
  declined: 'bg-destructive/10 text-destructive border-destructive/20',
  expired: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-muted text-muted-foreground border-border',
};

const ChallengesList = () => {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<PlayerChallengeWithUsers[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [acceptPrediction, setAcceptPrediction] = useState<Record<string, string>>({});

  const fetchChallenges = async () => {
    try {
      const data = await getMyChallenges();
      setChallenges(data);
    } catch (err) {
      console.error('Error fetching challenges:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChallenges();

    if (user?.id) {
      const channel = subscribeToChallenges(user.id, () => fetchChallenges());
      return () => { channel.unsubscribe(); };
    }
  }, [user?.id]);

  const handleAccept = async (challenge: PlayerChallengeWithUsers) => {
    const pred = acceptPrediction[challenge.id];
    if (!pred) {
      toast.error('Pick your prediction first');
      return;
    }
    setActionLoading(challenge.id);
    try {
      await acceptChallenge(challenge.id, pred);
      toast.success('Challenge accepted!');
      fetchChallenges();
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (id: string) => {
    setActionLoading(id);
    try {
      await declineChallenge(id);
      toast.info('Challenge declined');
      fetchChallenges();
    } catch (err: any) {
      toast.error(err.message || 'Failed to decline');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (id: string) => {
    setActionLoading(id);
    try {
      await cancelChallenge(id);
      toast.info('Challenge cancelled');
      fetchChallenges();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel');
    } finally {
      setActionLoading(null);
    }
  };

  const getRanges = (type: string) =>
    type === 'temperature' ? TEMPERATURE_RANGES : RAINFALL_RANGES;

  const getRangeLabel = (type: string, value: string) => {
    const ranges = getRanges(type);
    return ranges.find((r) => r.value === value)?.label || value;
  };

  const isIncoming = (c: PlayerChallengeWithUsers) => c.challenged_id === user?.id;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (challenges.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Swords className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No challenges yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Challenge players from the leaderboard!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {challenges.map((c, i) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: i * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <Card className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Swords className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm font-medium truncate">
                      {isIncoming(c) ? c.challenger_username : c.challenged_username}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {isIncoming(c) ? 'challenged you' : '(you challenged)'}
                    </span>
                  </div>
                  <Badge variant="outline" className={statusColors[c.status]}>
                    {c.status}
                  </Badge>
                </div>

                {/* Details */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {c.city}
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    {c.prediction_type === 'temperature' ? <Thermometer className="h-3 w-3" /> : <CloudRain className="h-3 w-3" />}
                    {c.prediction_type}
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Trophy className="h-3 w-3" />
                    {c.stake.toLocaleString()} pts
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                  </div>
                </div>

                {/* Predictions */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted/40 rounded-md p-2">
                    <p className="text-muted-foreground mb-0.5">{c.challenger_username}</p>
                    <p className="font-medium">{getRangeLabel(c.prediction_type, c.challenger_prediction)}</p>
                  </div>
                  <div className="bg-muted/40 rounded-md p-2">
                    <p className="text-muted-foreground mb-0.5">{c.challenged_username}</p>
                    <p className="font-medium">
                      {c.challenged_prediction
                        ? getRangeLabel(c.prediction_type, c.challenged_prediction)
                        : 'Waiting...'}
                    </p>
                  </div>
                </div>

                {/* Winner */}
                {c.status === 'completed' && c.winner_id && (
                  <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                    <Trophy className="h-4 w-4" />
                    Winner: {c.winner_id === c.challenger_id ? c.challenger_username : c.challenged_username}
                  </div>
                )}

                {/* Actions */}
                {c.status === 'pending' && isIncoming(c) && (
                  <div className="space-y-2 pt-1">
                    <Select
                      value={acceptPrediction[c.id] || ''}
                      onValueChange={(v) => setAcceptPrediction((prev) => ({ ...prev, [c.id]: v }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Pick your prediction" />
                      </SelectTrigger>
                      <SelectContent>
                        {getRanges(c.prediction_type)
                          .filter((r) => r.value !== c.challenger_prediction)
                          .map((r) => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => handleAccept(c)}
                        disabled={actionLoading === c.id}
                      >
                        {actionLoading === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleDecline(c.id)}
                        disabled={actionLoading === c.id}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Decline
                      </Button>
                    </div>
                  </div>
                )}

                {c.status === 'pending' && !isIncoming(c) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full text-xs"
                    onClick={() => handleCancel(c.id)}
                    disabled={actionLoading === c.id}
                  >
                    Cancel Challenge
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ChallengesList;
