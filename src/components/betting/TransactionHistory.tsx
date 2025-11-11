import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/currency';
import { useCurrencyMode } from '@/contexts/CurrencyModeContext';
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';

interface Transaction {
  id: string;
  transaction_type: string;
  amount_cents: number;
  balance_after_cents: number;
  created_at: string;
  reference_type: string | null;
  currency_type: 'virtual' | 'real';
}

export const TransactionHistory = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { mode } = useCurrencyMode();

  useEffect(() => {
    loadTransactions();
  }, [mode]);

  const loadTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('financial_transactions')
        .select('*')
        .eq('currency_type', mode)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setTransactions((data || []) as Transaction[]);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTransactionIcon = (type: string, amount: number) => {
    if (amount > 0) {
      return <ArrowUpRight className="h-4 w-4 text-green-500" />;
    }
    return <ArrowDownLeft className="h-4 w-4 text-red-500" />;
  };

  const getTransactionLabel = (type: string) => {
    const labels: Record<string, string> = {
      bet_placed: 'Bet Placed',
      bet_won: 'Bet Won',
      bet_lost: 'Bet Lost',
      cashout: 'Cash Out',
      deposit: 'Deposit',
      withdrawal: 'Withdrawal',
      manual: 'Manual Adjustment'
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading transactions...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction History</CardTitle>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="text-muted-foreground">No transactions yet</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  {getTransactionIcon(tx.transaction_type, tx.amount_cents)}
                  <div>
                    <p className="font-medium">{getTransactionLabel(tx.transaction_type)}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(tx.created_at).toLocaleDateString()} at{' '}
                      {new Date(tx.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`font-bold ${
                      tx.amount_cents > 0 ? 'text-green-500' : 'text-red-500'
                    }`}
                  >
                    {tx.amount_cents > 0 ? '+' : ''}
                    {formatCurrency(tx.amount_cents, mode)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Balance: {formatCurrency(tx.balance_after_cents, mode)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
