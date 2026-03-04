import { useState, useMemo, useCallback } from 'react';
import type { SortField, SortDir } from '@/components/admin/settlement/types';

interface UseFilteredSortOptions {
  uniqueCities: string[];
  uniquePredictions: string[];
  uniqueCurrencies: string[];
}

export const useFilteredSort = () => {
  const [filterCity, setFilterCity] = useState('all');
  const [filterPrediction, setFilterPrediction] = useState('all');
  const [filterCurrency, setFilterCurrency] = useState('all');
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [searchQuery, setSearchQuery] = useState('');

  const hasActiveFilters = filterCity !== 'all' || filterPrediction !== 'all' || filterCurrency !== 'all' || searchQuery.trim() !== '';

  const clearFilters = useCallback(() => {
    setFilterCity('all');
    setFilterPrediction('all');
    setFilterCurrency('all');
    setSearchQuery('');
  }, []);

  const toggleSort = useCallback((field: SortField) => {
    setSortField(prev => {
      if (prev === field) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return prev;
      }
      setSortDir('asc');
      return field;
    });
  }, []);

  const matchesSearch = useCallback((item: Record<string, any>) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return item.id.toLowerCase().includes(q) || (item.prediction_value?.toLowerCase().includes(q) ?? false);
  }, [searchQuery]);

  const sortItems = useCallback(<T extends Record<string, any>>(items: T[], cityKey: string, oddsKey: string, stakeKey: string, timeKey: string): T[] => {
    return [...items].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'city': cmp = (a[cityKey] || '').localeCompare(b[cityKey] || ''); break;
        case 'odds': cmp = Number(a[oddsKey]) - Number(b[oddsKey]); break;
        case 'stake': cmp = Number(a[stakeKey]) - Number(b[stakeKey]); break;
        case 'time': {
          const aTime = a[timeKey] ? new Date(a[timeKey]).getTime() : Infinity;
          const bTime = b[timeKey] ? new Date(b[timeKey]).getTime() : Infinity;
          cmp = aTime - bTime;
          break;
        }
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }, [sortField, sortDir]);

  const filterAndSort = useCallback(<T extends Record<string, any>>(
    items: T[],
    opts: { cityKey?: string; oddsKey: string; stakeKey: string; timeKey: string; applyCityFilter?: boolean; applyPredictionFilter?: boolean }
  ): T[] => {
    let filtered = items.filter(matchesSearch);
    if (opts.applyCityFilter && filterCity !== 'all') filtered = filtered.filter(b => b[opts.cityKey || 'city'] === filterCity);
    if (opts.applyPredictionFilter && filterPrediction !== 'all') filtered = filtered.filter(b => b.prediction_type === filterPrediction);
    if (filterCurrency !== 'all') filtered = filtered.filter(b => b.currency_type === filterCurrency);
    return sortItems(filtered, opts.cityKey || 'city', opts.oddsKey, opts.stakeKey, opts.timeKey);
  }, [matchesSearch, filterCity, filterPrediction, filterCurrency, sortItems]);

  return {
    filterCity, setFilterCity,
    filterPrediction, setFilterPrediction,
    filterCurrency, setFilterCurrency,
    sortField, sortDir,
    searchQuery, setSearchQuery,
    hasActiveFilters,
    clearFilters,
    toggleSort,
    filterAndSort,
  };
};
