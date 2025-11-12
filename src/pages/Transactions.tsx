import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeft, 
  Wallet, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  CreditCard, 
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  Shield,
  Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCurrencyMode } from '@/contexts/CurrencyModeContext';
import { formatCurrency } from '@/lib/currency';
import { getUser } from '@/lib/supabase-auth-storage';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { format } from 'date-fns';

const depositSchema = z.object({
  amount: z.number().min(10, 'Minimum deposit is R10.00').max(10000, 'Maximum deposit is R10,000.00'),
  paymentMethod: z.string().min(1, 'Please select a payment method'),
});

const withdrawalSchema = z.object({
  amount: z.number().min(50, 'Minimum withdrawal is R50.00').max(50000, 'Maximum withdrawal is R50,000.00'),
  bankAccount: z.string().min(1, 'Please select a bank account'),
});

interface PaymentMethod {
  id: string;
  type: 'card' | 'bank';
  last4: string;
  name: string;
  isDefault: boolean;
}

interface Transaction {
  id: string;
  transaction_type: string;
  amount_cents: number;
  balance_after_cents: number;
  currency_type: string;
  created_at: string;
  metadata?: any;
}

const Transactions = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { mode } = useCurrencyMode();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [selectedBankAccount, setSelectedBankAccount] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
    { id: '1', type: 'card', last4: '4242', name: 'Visa ending in 4242', isDefault: true },
    { id: '2', type: 'bank', last4: '5678', name: 'FNB Account ****5678', isDefault: false },
  ]);

  useEffect(() => {
    loadData();
    
    // Check for deposit success/cancel in URL params
    const params = new URLSearchParams(window.location.search);
    const depositStatus = params.get('deposit');
    
    if (depositStatus === 'success') {
      toast({
        title: 'Deposit Successful! 🎉',
        description: 'Your account will be credited shortly. Please refresh to see updated balance.',
      });
      // Clean up URL
      window.history.replaceState({}, '', '/transactions');
    } else if (depositStatus === 'cancelled') {
      toast({
        title: 'Deposit Cancelled',
        description: 'Your deposit was cancelled. No charges were made.',
        variant: 'destructive',
      });
      window.history.replaceState({}, '', '/transactions');
    }
  }, []);

  const loadData = async () => {
    try {
      const userData = await getUser();
      setUser(userData);

      // Fetch real money transactions only
      const { data: transactionsData, error } = await supabase
        .from('financial_transactions')
        .select('*')
        .eq('currency_type', 'real')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setTransactions(transactionsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load banking data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    try {
      const amount = parseFloat(depositAmount);
      const validation = depositSchema.safeParse({
        amount,
        paymentMethod: selectedPaymentMethod,
      });

      if (!validation.success) {
        toast({
          title: 'Validation Error',
          description: validation.error.errors[0].message,
          variant: 'destructive',
        });
        return;
      }

      const amountCents = Math.round(amount * 100);

      // Call Stripe edge function to create checkout session
      const { data, error } = await supabase.functions.invoke('create-deposit-payment', {
        body: { amountCents },
      });

      if (error) throw error;

      if (data?.url) {
        // Open Stripe checkout in new tab
        window.open(data.url, '_blank');
        toast({
          title: 'Redirecting to Payment',
          description: 'Opening Stripe checkout in a new tab...',
        });
      }

      setDepositAmount('');
    } catch (error) {
      console.error('Deposit error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to process deposit',
        variant: 'destructive',
      });
    }
  };

  const handleWithdrawal = async () => {
    try {
      const amount = parseFloat(withdrawalAmount);
      const validation = withdrawalSchema.safeParse({
        amount,
        bankAccount: selectedBankAccount,
      });

      if (!validation.success) {
        toast({
          title: 'Validation Error',
          description: validation.error.errors[0].message,
          variant: 'destructive',
        });
        return;
      }

      const amountCents = Math.round(amount * 100);
      if (amountCents > (user?.balance_cents || 0)) {
        toast({
          title: 'Insufficient Funds',
          description: `You only have ${formatCurrency(user?.balance_cents || 0, 'real')} available`,
          variant: 'destructive',
        });
        return;
      }

      // Call withdrawal edge function
      const { data, error } = await supabase.functions.invoke('create-withdrawal', {
        body: { amountCents },
      });

      if (error) throw error;

      toast({
        title: 'Withdrawal Initiated',
        description: data?.message || `Withdrawal of ${formatCurrency(amountCents, 'real')} is being processed. Funds typically arrive in 2-5 business days.`,
      });

      setWithdrawalAmount('');
      
      // Refresh data to show updated balance
      await loadData();
    } catch (error) {
      console.error('Withdrawal error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to process withdrawal',
        variant: 'destructive',
      });
    }
  };

  const handleAddPaymentMethod = () => {
    toast({
      title: 'Add Payment Method',
      description: 'Payment method management requires Stripe or PayFast integration.',
    });
  };

  const handleRemovePaymentMethod = (id: string) => {
    setPaymentMethods(paymentMethods.filter(pm => pm.id !== id));
    toast({
      title: 'Payment Method Removed',
      description: 'The payment method has been removed from your account.',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (mode === 'virtual') {
    return (
      <div className="min-h-screen bg-gradient-subtle p-4">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <CardTitle>Banking & Transactions</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Banking features are only available in Real Money Mode. Switch to Real Money Mode to deposit, withdraw, or manage payment methods.
                </AlertDescription>
              </Alert>
              <Button className="mt-4" onClick={() => navigate('/')}>
                Return to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-real-bg via-real-bg/95 to-real-accent/10 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border-2 border-real-border bg-real-bg/50 backdrop-blur-sm shadow-lg shadow-real-glow/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <CardTitle className="text-2xl flex items-center gap-2 text-real-primary">
                    <Wallet className="h-6 w-6" />
                    Banking & Transactions
                  </CardTitle>
                  <CardDescription>Manage your real money deposits, withdrawals, and payment methods</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="bg-real-primary/10 border-real-primary text-real-primary">
                💰 Real Money Mode
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Balance Overview */}
        <Card className="border-2 border-real-border shadow-lg shadow-real-glow/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Available Balance</p>
                <p className="text-4xl font-bold text-real-primary">
                  {formatCurrency(user?.balance_cents || 0, 'real')}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadData}
                  className="border-real-border hover:bg-real-primary/10"
                >
                  Refresh Balance
                </Button>
                <div className="p-4 rounded-full bg-real-primary/10">
                  <DollarSign className="h-8 w-8 text-real-primary" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs defaultValue="deposit" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="deposit" className="flex items-center gap-2">
              <ArrowDownToLine className="h-4 w-4" />
              Deposit
            </TabsTrigger>
            <TabsTrigger value="withdraw" className="flex items-center gap-2">
              <ArrowUpFromLine className="h-4 w-4" />
              Withdraw
            </TabsTrigger>
            <TabsTrigger value="payment-methods" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Payment Methods
            </TabsTrigger>
          </TabsList>

          {/* Deposit Tab */}
          <TabsContent value="deposit">
            <Card className="border-2 border-real-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-real-primary">
                  <ArrowDownToLine className="h-5 w-5" />
                  Deposit Funds
                </CardTitle>
                <CardDescription>Add money to your betting account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="bg-real-primary/5 border-real-primary/20">
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    All transactions are secured with bank-level encryption. Deposits are instant.
                  </AlertDescription>
                </Alert>

                <Alert className="bg-blue-500/5 border-blue-500/20">
                  <AlertCircle className="h-4 w-4 text-blue-500" />
                  <AlertDescription className="text-sm">
                    <strong>Setup Required:</strong> Configure your Stripe webhook endpoint in the{' '}
                    <a 
                      href="https://dashboard.stripe.com/webhooks" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline font-medium"
                    >
                      Stripe Dashboard
                    </a>
                    {' '}to enable automatic balance updates. Webhook URL: <code className="text-xs bg-muted px-1 py-0.5 rounded">
                      https://imyzcwgskjngwvcadrjn.supabase.co/functions/v1/stripe-webhook
                    </code>
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="deposit-amount">Amount (ZAR)</Label>
                  <Input
                    id="deposit-amount"
                    type="number"
                    placeholder="Enter amount (R10 - R10,000)"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    min="10"
                    max="10000"
                    step="10"
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum: R10.00 • Maximum: R10,000.00
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment-method">Payment Method</Label>
                  <select
                    id="payment-method"
                    className="w-full rounded-md border border-input bg-background px-3 py-2"
                    value={selectedPaymentMethod}
                    onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                  >
                    <option value="">Select payment method</option>
                    {paymentMethods.map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.name} {method.isDefault && '(Default)'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Deposit Amount:</span>
                    <span className="font-medium">
                      {depositAmount ? formatCurrency(Math.round(parseFloat(depositAmount) * 100), 'real') : 'R0.00'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Processing Fee:</span>
                    <span className="font-medium">R0.00</span>
                  </div>
                  <div className="flex items-center justify-between text-lg font-bold border-t pt-2">
                    <span>You Will Receive:</span>
                    <span className="text-real-primary">
                      {depositAmount ? formatCurrency(Math.round(parseFloat(depositAmount) * 100), 'real') : 'R0.00'}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={handleDeposit}
                  disabled={!depositAmount || !selectedPaymentMethod}
                  className="w-full bg-real-primary hover:bg-real-primary/90 text-real-primary-foreground"
                  size="lg"
                >
                  Deposit Funds via Stripe
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Withdraw Tab */}
          <TabsContent value="withdraw">
            <Card className="border-2 border-real-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-real-primary">
                  <ArrowUpFromLine className="h-5 w-5" />
                  Withdraw Funds
                </CardTitle>
                <CardDescription>Transfer winnings to your bank account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="bg-real-accent/10 border-real-accent/20">
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    Withdrawals typically take 2-5 business days to process. Maximum withdrawal: R50,000 per transaction.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="withdrawal-amount">Amount (ZAR)</Label>
                  <Input
                    id="withdrawal-amount"
                    type="number"
                    placeholder="Enter amount (R50 - R50,000)"
                    value={withdrawalAmount}
                    onChange={(e) => setWithdrawalAmount(e.target.value)}
                    min="50"
                    max="50000"
                    step="10"
                  />
                  <p className="text-xs text-muted-foreground">
                    Available: {formatCurrency(user?.balance_cents || 0, 'real')} • Minimum: R50.00
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bank-account">Bank Account</Label>
                  <select
                    id="bank-account"
                    className="w-full rounded-md border border-input bg-background px-3 py-2"
                    value={selectedBankAccount}
                    onChange={(e) => setSelectedBankAccount(e.target.value)}
                  >
                    <option value="">Select bank account</option>
                    {paymentMethods.filter(m => m.type === 'bank').map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.name} {method.isDefault && '(Default)'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Withdrawal Amount:</span>
                    <span className="font-medium">
                      {withdrawalAmount ? formatCurrency(Math.round(parseFloat(withdrawalAmount) * 100), 'real') : 'R0.00'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Processing Fee:</span>
                    <span className="font-medium">R0.00</span>
                  </div>
                  <div className="flex items-center justify-between text-lg font-bold border-t pt-2">
                    <span>You Will Receive:</span>
                    <span className="text-real-primary">
                      {withdrawalAmount ? formatCurrency(Math.round(parseFloat(withdrawalAmount) * 100), 'real') : 'R0.00'}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={handleWithdrawal}
                  disabled={!withdrawalAmount || !selectedBankAccount}
                  className="w-full bg-real-primary hover:bg-real-primary/90 text-real-primary-foreground"
                  size="lg"
                >
                  Request Withdrawal
                </Button>

                <Alert className="bg-yellow-500/5 border-yellow-500/20">
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  <AlertDescription className="text-xs">
                    <strong>Note:</strong> Full withdrawal processing requires Stripe Connect setup for payouts. Contact support for assistance with payout configuration.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Methods Tab */}
          <TabsContent value="payment-methods">
            <Card className="border-2 border-real-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-real-primary">
                      <CreditCard className="h-5 w-5" />
                      Payment Methods
                    </CardTitle>
                    <CardDescription>Manage your cards and bank accounts</CardDescription>
                  </div>
                  <Button onClick={handleAddPaymentMethod} className="bg-real-primary hover:bg-real-primary/90">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Method
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {paymentMethods.map((method) => (
                  <Card key={method.id} className="border">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {method.type === 'card' ? (
                            <div className="p-3 rounded-full bg-real-primary/10">
                              <CreditCard className="h-5 w-5 text-real-primary" />
                            </div>
                          ) : (
                            <div className="p-3 rounded-full bg-real-accent/10">
                              <Wallet className="h-5 w-5 text-real-accent" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{method.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {method.type === 'card' ? 'Credit/Debit Card' : 'Bank Account'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {method.isDefault && (
                            <Badge variant="outline" className="bg-real-primary/10 border-real-primary text-real-primary">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Default
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemovePaymentMethod(method.id)}
                            disabled={method.isDefault}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <Alert className="bg-real-primary/5 border-real-primary/20">
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    Your payment information is encrypted and stored securely. We never store full card details.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Transaction History */}
        <Card className="border-2 border-real-border">
          <CardHeader>
            <CardTitle className="text-real-primary">Recent Transactions</CardTitle>
            <CardDescription>Your latest real money transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No transactions yet</p>
            ) : (
              <div className="space-y-2">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        transaction.amount_cents > 0 ? 'bg-success/10' : 'bg-destructive/10'
                      }`}>
                        {transaction.amount_cents > 0 ? (
                          <ArrowDownToLine className="h-4 w-4 text-success" />
                        ) : (
                          <ArrowUpFromLine className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium capitalize">{transaction.transaction_type.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(transaction.created_at), 'MMM dd, yyyy HH:mm')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${
                        transaction.amount_cents > 0 ? 'text-success' : 'text-destructive'
                      }`}>
                        {transaction.amount_cents > 0 ? '+' : ''}{formatCurrency(transaction.amount_cents, 'real')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Balance: {formatCurrency(transaction.balance_after_cents, 'real')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Transactions;
