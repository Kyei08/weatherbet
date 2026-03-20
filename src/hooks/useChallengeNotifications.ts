import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeToChallenges } from '@/lib/supabase-player-challenges';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useChallengeNotifications = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    const channel = subscribeToChallenges(user.id, async (payload: any) => {
      const { eventType, new: record } = payload;

      if (eventType === 'INSERT' && record.challenged_id === user.id) {
        // Incoming challenge
        const { data: challenger } = await supabase
          .from('users')
          .select('username')
          .eq('id', record.challenger_id)
          .single();

        toast(`⚔️ ${challenger?.username || 'Someone'} challenged you!`, {
          description: `${record.stake.toLocaleString()} pts on ${record.city} ${record.prediction_type}`,
          action: {
            label: 'View',
            onClick: () => window.location.assign('/challenges'),
          },
        });

        // Also create an in-app notification
        await supabase.from('notifications').insert({
          user_id: user.id,
          title: 'New Challenge!',
          message: `${challenger?.username || 'A player'} challenged you to a ${record.prediction_type} prediction on ${record.city} for ${record.stake.toLocaleString()} points.`,
          type: 'challenge',
          reference_id: record.id,
          reference_type: 'player_challenge',
        });
      }

      if (eventType === 'UPDATE' && record.challenger_id === user.id) {
        const { data: challenged } = await supabase
          .from('users')
          .select('username')
          .eq('id', record.challenged_id)
          .single();

        if (record.status === 'accepted') {
          toast.success(`${challenged?.username} accepted your challenge!`, {
            description: 'Game on! 🎯',
          });
        } else if (record.status === 'declined') {
          toast.info(`${challenged?.username} declined your challenge`);
        }
      }
    });

    return () => { channel.unsubscribe(); };
  }, [user?.id]);
};
