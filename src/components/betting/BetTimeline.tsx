import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, MapPin, Timer, TrendingUp, Zap, ChevronRight } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { BettingCategory, getTimeSlot, getDefaultTimeSlot } from '@/lib/betting-timing';
import { formatCurrency } from '@/lib/currency';

interface Bet {
  id: string;
  city: string;
  prediction_type: string;
  prediction_value: string;
  stake: number;
  odds: number;
  result: string;
  created_at: string;
  target_date?: string;
  time_slot_id?: string;
  currency_type?: string;
}

interface ParlayLeg {
  id: string;
  city: string;
  prediction_type: string;
  prediction_value: string;
  odds: number;
}

interface ParlayWithLegs {
  id: string;
  total_stake: number;
  combined_odds: number;
  result: string;
  created_at: string;
  expires_at?: string;
  parlay_legs: ParlayLeg[];
  currency_type?: string;
}

interface CombinedBetCategory {
  id: string;
  prediction_type: string;
  prediction_value: string;
  odds: number;
  result: string;
}

interface CombinedBet {
  id: string;
  city: string;
  total_stake: number;
  combined_odds: number;
  result: string;
  created_at: string;
  target_date?: string;
  combined_bet_categories: CombinedBetCategory[];
  currency_type?: string;
}

interface TimelineItem {
  id: string;
  type: 'single' | 'parlay' | 'combined';
  measurementTime: Date;
  city: string;
  predictionType: string;
  predictionValue: string;
  stake: number;
  odds: number;
  potentialWin: number;
  timeSlotLabel: string;
  timeSlotIcon: string;
  currencyType: string;
  // Additional info for display
  legCount?: number;
  categoryCount?: number;
}

interface BetTimelineProps {
  bets: Bet[];
  parlays: ParlayWithLegs[];
  combinedBets: CombinedBet[];
  mode: 'virtual' | 'real';
}

function getNextMeasurementTime(
  category: BettingCategory,
  slotId?: string,
  targetDate?: string
): Date {
  const slot = slotId ? getTimeSlot(category, slotId) : getDefaultTimeSlot(category);
  if (!slot) {
    return new Date();
  }

  const now = new Date();
  let measurementDate: Date;

  if (targetDate) {
    measurementDate = new Date(targetDate);
    measurementDate.setHours(0, 0, 0, 0);
  } else {
    measurementDate = new Date();
    measurementDate.setHours(0, 0, 0, 0);
  }

  if (slot.isRange) {
    const endHour = slot.endHour ?? 23;
    measurementDate.setHours(endHour, 59, 59, 999);
  } else {
    const measurementHour = slot.measurementHour ?? 12;
    measurementDate.setHours(measurementHour, 0, 0, 0);
  }

  if (!targetDate && measurementDate <= now) {
    measurementDate.setDate(measurementDate.getDate() + 1);
  }

  return measurementDate;
}

export function BetTimeline({ bets, parlays, combinedBets, mode }: BetTimelineProps) {
  const [now, setNow] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const timelineItems = useMemo(() => {
    const items: TimelineItem[] = [];

    // Add single bets
    bets
      .filter(bet => bet.result === 'pending')
      .forEach(bet => {
        const category = bet.prediction_type as BettingCategory;
        const slot = bet.time_slot_id 
          ? getTimeSlot(category, bet.time_slot_id) 
          : getDefaultTimeSlot(category);
        
        const measurementTime = getNextMeasurementTime(
          category,
          bet.time_slot_id,
          bet.target_date
        );

        items.push({
          id: bet.id,
          type: 'single',
          measurementTime,
          city: bet.city,
          predictionType: bet.prediction_type,
          predictionValue: bet.prediction_value,
          stake: bet.stake,
          odds: bet.odds,
          potentialWin: Math.floor(bet.stake * bet.odds),
          timeSlotLabel: slot?.label || 'Default',
          timeSlotIcon: slot?.icon || '⏰',
          currencyType: bet.currency_type || 'virtual',
        });
      });

    // Add parlays (use earliest leg measurement time)
    parlays
      .filter(parlay => parlay.result === 'pending')
      .forEach(parlay => {
        // For parlays, use the first leg's timing
        const firstLeg = parlay.parlay_legs[0];
        if (!firstLeg) return;

        const category = firstLeg.prediction_type as BettingCategory;
        const slot = getDefaultTimeSlot(category);
        const measurementTime = getNextMeasurementTime(category);

        items.push({
          id: parlay.id,
          type: 'parlay',
          measurementTime,
          city: parlay.parlay_legs.map(l => l.city).join(', '),
          predictionType: 'parlay',
          predictionValue: `${parlay.parlay_legs.length} legs`,
          stake: parlay.total_stake,
          odds: parlay.combined_odds,
          potentialWin: Math.floor(parlay.total_stake * parlay.combined_odds),
          timeSlotLabel: slot?.label || 'Default',
          timeSlotIcon: '💰',
          currencyType: parlay.currency_type || 'virtual',
          legCount: parlay.parlay_legs.length,
        });
      });

    // Add combined bets
    combinedBets
      .filter(cb => cb.result === 'pending')
      .forEach(cb => {
        // Find the next category to be resolved
        const pendingCategories = cb.combined_bet_categories.filter(c => c.result === 'pending');
        if (pendingCategories.length === 0) return;

        // Parse prediction types and find earliest measurement
        let earliestTime = new Date(9999, 11, 31);
        let earliestSlot = getDefaultTimeSlot('temperature');

        pendingCategories.forEach(cat => {
          const [baseCategory, slotId] = cat.prediction_type.includes('_') 
            ? [cat.prediction_type.split('_')[0] as BettingCategory, cat.prediction_type.split('_').slice(1).join('_')]
            : [cat.prediction_type as BettingCategory, undefined];
          
          const measurementTime = getNextMeasurementTime(baseCategory, slotId, cb.target_date);
          if (measurementTime < earliestTime) {
            earliestTime = measurementTime;
            earliestSlot = slotId ? getTimeSlot(baseCategory, slotId) || getDefaultTimeSlot(baseCategory) : getDefaultTimeSlot(baseCategory);
          }
        });

        items.push({
          id: cb.id,
          type: 'combined',
          measurementTime: earliestTime,
          city: cb.city,
          predictionType: 'combined',
          predictionValue: `${cb.combined_bet_categories.length} categories`,
          stake: cb.total_stake,
          odds: cb.combined_odds,
          potentialWin: Math.floor(cb.total_stake * cb.combined_odds),
          timeSlotLabel: earliestSlot?.label || 'Default',
          timeSlotIcon: '⚡',
          currencyType: cb.currency_type || 'virtual',
          categoryCount: cb.combined_bet_categories.length,
        });
      });

    // Sort by measurement time (ascending)
    return items.sort((a, b) => a.measurementTime.getTime() - b.measurementTime.getTime());
  }, [bets, parlays, combinedBets]);

  // Filter to only show items for current mode
  const filteredItems = timelineItems.filter(item => 
    mode === 'real' ? item.currencyType === 'real' : item.currencyType === 'virtual'
  );

  // Group items by time proximity
  const groupedItems = useMemo(() => {
    const groups: { label: string; items: TimelineItem[] }[] = [];
    let currentGroup: { label: string; items: TimelineItem[] } | null = null;

    filteredItems.forEach(item => {
      const diffMs = item.measurementTime.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      let label: string;
      if (diffMs <= 0) {
        label = 'Resolving Now';
      } else if (diffHours <= 1) {
        label = 'Within 1 Hour';
      } else if (diffHours <= 3) {
        label = 'Within 3 Hours';
      } else if (diffHours <= 6) {
        label = 'Within 6 Hours';
      } else if (diffHours <= 12) {
        label = 'Within 12 Hours';
      } else if (diffHours <= 24) {
        label = 'Today';
      } else {
        label = 'Tomorrow & Later';
      }

      if (!currentGroup || currentGroup.label !== label) {
        currentGroup = { label, items: [] };
        groups.push(currentGroup);
      }
      currentGroup.items.push(item);
    });

    return groups;
  }, [filteredItems, now]);

  if (filteredItems.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            Bet Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No pending bets to display in timeline.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="h-5 w-5 text-primary" />
          Bet Resolution Timeline
          <Badge variant="secondary" className="ml-auto">
            {filteredItems.length} pending
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-muted" />

            <div className="space-y-6">
              {groupedItems.map((group, groupIdx) => (
                <div key={group.label} className="space-y-3">
                  {/* Group Header */}
                  <div className="flex items-center gap-3 relative">
                    <div className={`w-3 h-3 rounded-full z-10 ${
                      group.label === 'Resolving Now' 
                        ? 'bg-green-500 animate-pulse' 
                        : group.label === 'Within 1 Hour'
                        ? 'bg-yellow-500'
                        : 'bg-primary'
                    }`} />
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                      {group.label}
                    </h3>
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground">
                      {group.items.length} bet{group.items.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Items in group */}
                  <div className="space-y-2 ml-8">
                    {group.items.map((item, idx) => (
                      <div
                        key={item.id}
                        className={`relative p-3 rounded-lg border transition-all hover:shadow-md ${
                          item.type === 'parlay' 
                            ? 'bg-gradient-to-r from-primary/5 to-transparent border-primary/20' 
                            : item.type === 'combined'
                            ? 'bg-gradient-to-r from-accent/5 to-transparent border-accent/20'
                            : 'bg-card hover:bg-muted/50'
                        }`}
                      >
                        {/* Connector dot */}
                        <div className={`absolute -left-6 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${
                          item.measurementTime <= now 
                            ? 'bg-green-500' 
                            : 'bg-muted-foreground'
                        }`} />

                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">{item.timeSlotIcon}</span>
                              <span className="font-medium truncate">
                                {item.type === 'parlay' ? (
                                  <span className="flex items-center gap-1">
                                    💰 {item.legCount}-Leg Parlay
                                  </span>
                                ) : item.type === 'combined' ? (
                                  <span className="flex items-center gap-1">
                                    <Zap className="h-4 w-4 text-primary" />
                                    {item.categoryCount}-Category Combo
                                  </span>
                                ) : (
                                  <span className="capitalize">
                                    {item.predictionType.replace('_', ' ')}
                                  </span>
                                )}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {item.timeSlotLabel}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">{item.city}</span>
                              <ChevronRight className="h-3 w-3" />
                              <span className="font-medium text-foreground">
                                {item.type === 'single' ? item.predictionValue : item.predictionValue}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="flex items-center gap-1 text-sm font-medium">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              {item.measurementTime <= now ? (
                                <span className="text-green-600">Now</span>
                              ) : (
                                <span>{format(item.measurementTime, 'HH:mm')}</span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.measurementTime > now && formatDistanceToNow(item.measurementTime, { addSuffix: true })}
                            </div>
                            <div className="flex items-center gap-1 mt-1 text-xs">
                              <TrendingUp className="h-3 w-3 text-primary" />
                              <span className="text-primary font-medium">
                                {formatCurrency(item.potentialWin, item.currencyType === 'real' ? 'real' : 'virtual')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
