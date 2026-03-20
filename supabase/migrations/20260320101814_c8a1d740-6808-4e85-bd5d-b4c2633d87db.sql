-- Head-to-head player challenges table
CREATE TABLE public.player_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid NOT NULL,
  challenged_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  stake integer NOT NULL DEFAULT 0,
  city text NOT NULL,
  prediction_type text NOT NULL DEFAULT 'temperature',
  challenger_prediction text NOT NULL,
  challenged_prediction text,
  target_date timestamp with time zone NOT NULL,
  winner_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours'),
  resolved_at timestamp with time zone,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'declined', 'completed', 'expired', 'cancelled')),
  CONSTRAINT different_players CHECK (challenger_id != challenged_id)
);

-- Enable RLS
ALTER TABLE public.player_challenges ENABLE ROW LEVEL SECURITY;

-- Players can view challenges they're part of
CREATE POLICY "Users can view their own challenges"
  ON public.player_challenges FOR SELECT
  TO authenticated
  USING (auth.uid() = challenger_id OR auth.uid() = challenged_id);

-- Players can create challenges
CREATE POLICY "Users can create challenges"
  ON public.player_challenges FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = challenger_id);

-- Players can update challenges they're part of (accept/decline)
CREATE POLICY "Users can update their challenges"
  ON public.player_challenges FOR UPDATE
  TO authenticated
  USING (auth.uid() = challenger_id OR auth.uid() = challenged_id);

-- Admins can view all
CREATE POLICY "Admins can view all challenges"
  ON public.player_challenges FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.player_challenges;