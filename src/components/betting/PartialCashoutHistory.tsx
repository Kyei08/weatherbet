import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, TrendingDown, Calendar, Coins } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { format } from 'date-fns';

interface PartialCashout {
  id: string;
  amount_cents: number;
  created_at: string;
  currency_type: string;
  metadata: {
    percentage?: number;
    remaining_stake?: number;
    original_stake?: number;
  } | null;
}

interface PartialCashoutHistoryProps {
  betId: string;
  betType: 'bet' | 'parlay' | 'combined_bet';
  currencyType: 'virtual' | 'real';
}

export const PartialCashoutHistory = ({ betId, betType, currencyType }: PartialCashoutHistoryProps) => {
  const [history, setHistory] = useState<PartialCashout[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCashedOut, setTotalCashedOut] = useState(0);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data, error } = await supabase
          .from('financial_transactions')
          .select('id, amount_cents, created_at, currency_type, metadata')
          .eq('reference_id', betId)
          .eq('reference_type', betType)
          .eq('transaction_type', 'partial_cashout')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const cashouts = (data || []) as PartialCashout[];
        setHistory(cashouts);
        setTotalCashedOut(cashouts.reduce((sum, c) => sum + c.amount_cents, 0));
      } catch (error) {
        console.error('Error fetching partial cashout history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [betId, betType]);

  if (loading) {
    return (
      <div className="text-xs text-muted-foreground animate-pulse">
        Loading history...
      </div>
    );
  }

  if (history.length === 0) {
    return null;
  }

  return (
    <Card className="border-dashed border-muted-foreground/30 bg-muted/20">
      <CardHeader className="py-2 px-3">
        <CardTitle className="text-xs font-medium flex items-center gap-2">
          <History className="h-3 w-3" />
          Partial Cashout History
          <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
            {history.length} cashout{history.length > 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2 px-3">
        <ScrollArea className="max-h-32">
          <div className="space-y-2">
            {history.map((cashout, index) => {
              const metadata = cashout.metadata as { percentage?: number; remaining_stake?: number } | null;
              return (
                <div
                  key={cashout.id}
                  className="flex items-center justify-between text-xs p-2 rounded-md bg-background/50 border border-border/50"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                      {history.length - index}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <TrendingDown className="h-3 w-3 text-orange-500" />
                        <span className="font-medium text-foreground">
                          {formatCurrency(cashout.amount_cents, currencyType)}
                        </span>
                        {metadata?.percentage && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                            {metadata.percentage}%
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground text-[10px]">
                        <Calendar className="h-2.5 w-2.5" />
                        {format(new Date(cashout.created_at), 'MMM d, HH:mm')}
                      </div>
                    </div>
                  </div>
                  {metadata?.remaining_stake !== undefined && (
                    <div className="text-right text-[10px] text-muted-foreground">
                      <div>Remaining</div>
                      <div className="font-medium text-foreground">
                        {formatCurrency(metadata.remaining_stake, currencyType)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
        
        {/* Total Summary */}
        <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Coins className="h-3 w-3" />
            Total Cashed Out
          </div>
          <span className="text-xs font-bold text-primary">
            {formatCurrency(totalCashedOut, currencyType)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
