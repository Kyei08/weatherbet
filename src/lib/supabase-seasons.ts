import { supabase } from '@/integrations/supabase/client';

export interface SeasonData {
  id: string;
  season_number: number;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
}

export interface SeasonResult {
  id: string;
  season_id: string;
  user_id: string;
  username: string;
  final_rank: number;
  final_points: number;
  total_bets: number;
  total_wins: number;
  recorded_at: string;
}

export const getSeasonHistory = async (groupId: string): Promise<SeasonData[]> => {
  const { data, error } = await supabase
    .from('leaderboard_seasons' as any)
    .select('id, season_number, started_at, ended_at, is_active')
    .eq('group_id', groupId)
    .order('season_number', { ascending: false })
    .limit(20);

  if (error || !data) return [];
  return data as unknown as SeasonData[];
};

export const getSeasonResults = async (seasonId: string): Promise<SeasonResult[]> => {
  const { data, error } = await supabase
    .from('season_results' as any)
    .select('*')
    .eq('season_id', seasonId)
    .order('final_rank', { ascending: true });

  if (error || !data) return [];
  return data as unknown as SeasonResult[];
};

export const getCurrentSeason = async (groupId: string): Promise<SeasonData | null> => {
  const { data, error } = await supabase
    .from('leaderboard_seasons' as any)
    .select('id, season_number, started_at, ended_at, is_active')
    .eq('group_id', groupId)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;
  return data as unknown as SeasonData;
};
