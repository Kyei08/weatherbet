import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, X, Search } from 'lucide-react';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filterCity: string;
  onFilterCityChange: (value: string) => void;
  filterPrediction: string;
  onFilterPredictionChange: (value: string) => void;
  filterCurrency: string;
  onFilterCurrencyChange: (value: string) => void;
  uniqueCities: string[];
  uniquePredictions: string[];
  uniqueCurrencies: string[];
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export const FilterBar = ({
  searchQuery,
  onSearchChange,
  filterCity,
  onFilterCityChange,
  filterPrediction,
  onFilterPredictionChange,
  filterCurrency,
  onFilterCurrencyChange,
  uniqueCities,
  uniquePredictions,
  uniqueCurrencies,
  hasActiveFilters,
  onClearFilters,
}: FilterBarProps) => (
  <div className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-lg border bg-muted/30">
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        placeholder="Search ID or prediction…"
        value={searchQuery}
        onChange={e => onSearchChange(e.target.value)}
        className="pl-8 h-8 w-[200px] text-xs"
      />
    </div>
    <Filter className="h-4 w-4 text-muted-foreground" />
    <Select value={filterCity} onValueChange={onFilterCityChange}>
      <SelectTrigger className="w-[150px] h-8 text-xs">
        <SelectValue placeholder="All Cities" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Cities</SelectItem>
        {uniqueCities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
      </SelectContent>
    </Select>
    <Select value={filterPrediction} onValueChange={onFilterPredictionChange}>
      <SelectTrigger className="w-[160px] h-8 text-xs">
        <SelectValue placeholder="All Predictions" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Predictions</SelectItem>
        {uniquePredictions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
      </SelectContent>
    </Select>
    <Select value={filterCurrency} onValueChange={onFilterCurrencyChange}>
      <SelectTrigger className="w-[130px] h-8 text-xs">
        <SelectValue placeholder="All Modes" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Modes</SelectItem>
        {uniqueCurrencies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
      </SelectContent>
    </Select>
    {hasActiveFilters && (
      <Button variant="ghost" size="sm" onClick={onClearFilters} className="h-8 gap-1 text-xs">
        <X className="h-3 w-3" />
        Clear
      </Button>
    )}
  </div>
);
