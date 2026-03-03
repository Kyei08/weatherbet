export type SortField = 'odds' | 'stake' | 'time' | 'city';
export type SortDir = 'asc' | 'desc';

export interface ResolutionLog {
  timestamp: string;
  status: 'success' | 'error';
  message: string;
  resolved: number;
}

export interface PendingBet {
  id: string;
  city: string;
  prediction_type: string;
  prediction_value: string;
  odds: number;
  stake: number;
  currency_type: string;
  target_date: string | null;
  expires_at: string | null;
  created_at: string;
  has_insurance: boolean;
}

export interface PendingParlay {
  id: string;
  combined_odds: number;
  total_stake: number;
  currency_type: string;
  expires_at: string | null;
  created_at: string;
  has_insurance: boolean;
}

export interface PendingCombined {
  id: string;
  city: string;
  combined_odds: number;
  total_stake: number;
  currency_type: string;
  target_date: string;
  created_at: string;
  has_insurance: boolean;
}
