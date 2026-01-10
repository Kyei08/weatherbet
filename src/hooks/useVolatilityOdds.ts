import { useState, useEffect, useCallback } from 'react';
import { 
  getVolatilityData, 
  VolatilityData, 
  VOLATILITY_CONFIG 
} from '@/lib/volatility-odds';

interface UseVolatilityOddsParams {
  city: string;
  category: string;
  enabled?: boolean;
}

interface UseVolatilityOddsResult {
  volatilityData: VolatilityData | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch and track volatility-based odds for a city/category
 */
export function useVolatilityOdds({
  city,
  category,
  enabled = true,
}: UseVolatilityOddsParams): UseVolatilityOddsResult {
  const [volatilityData, setVolatilityData] = useState<VolatilityData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVolatility = useCallback(async () => {
    if (!enabled || !city || !category || !VOLATILITY_CONFIG.enabled) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await getVolatilityData(city, category);
      setVolatilityData(data);
    } catch (err) {
      console.error('Error fetching volatility data:', err);
      setError('Failed to fetch volatility data');
    } finally {
      setIsLoading(false);
    }
  }, [city, category, enabled]);

  useEffect(() => {
    fetchVolatility();
  }, [fetchVolatility]);

  return {
    volatilityData,
    isLoading,
    error,
    refresh: fetchVolatility,
  };
}

/**
 * Hook to fetch volatility data for multiple categories at once
 */
export function useMultiCategoryVolatility({
  city,
  categories,
  enabled = true,
}: {
  city: string;
  categories: string[];
  enabled?: boolean;
}): {
  volatilityMap: Map<string, VolatilityData>;
  isLoading: boolean;
  refresh: () => Promise<void>;
} {
  const [volatilityMap, setVolatilityMap] = useState<Map<string, VolatilityData>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!enabled || !city || categories.length === 0 || !VOLATILITY_CONFIG.enabled) {
      return;
    }

    setIsLoading(true);

    try {
      const results = await Promise.all(
        categories.map(category => getVolatilityData(city, category))
      );

      const newMap = new Map<string, VolatilityData>();
      results.forEach(result => {
        newMap.set(result.category, result);
      });

      setVolatilityMap(newMap);
    } catch (err) {
      console.error('Error fetching volatility data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [city, categories, enabled]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    volatilityMap,
    isLoading,
    refresh: fetchAll,
  };
}
