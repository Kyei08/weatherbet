import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
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
  Clock,
  Sparkles,
  TrendingUp,
  TrendingDown,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCurrencyMode } from '@/contexts/CurrencyModeContext';
import { formatCurrency } from '@/lib/currency';
import { getUser } from '@/lib/supabase-auth-storage';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

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

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

const DEPOSIT_PRESETS = [10, 25, 50, 100, 250, 500];
const WITHDRAWAL_PRESETS = [50, 100, 250, 500, 1000];

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
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
    { id: '1', type: 'card', last4: '4242', name: 'Visa ending in 4242', isDefault: true },
    { id: '2', type: 'bank', last4: '5678', name: 'FNB Account ****5678', isDefault: false },
  ]);

  useEffect(() => {
    loadData();
    
    const params = new URLSearchParams(window.location.search);
    const depositStatus = params.get('deposit');
    
    if (depositStatus === 'success') {
      toast({ title: 'Deposit Successful! 🎉', description: 'Your account will be credited shortly.' });
      window.history.replaceState({}, '', '/transactions');
    } else if (depositStatus === 'cancelled') {
      toast({ title: 'Deposit Cancelled', description: 'No charges were made.', variant: 'destructive' });
      window.history.replaceState({}, '', '/transactions');
    }
  }, []);

  const loadData = async () => {
    try {
      const userData = await getUser();
      setUser(userData);
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
      toast({ title: 'Error', description: 'Failed to load banking data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    try {
      const amount = parseFloat(depositAmount);
      const validation = depositSchema.safeParse({ amount, paymentMethod: selectedPaymentMethod });
      if (!validation.success) {
        toast({ title: 'Validation Error', description: validation.error.errors[0].message, variant: 'destructive' });
        return;
      }
      setIsDepositing(true);
      const amountCents = Math.round(amount * 100);
      const { data, error } = await supabase.functions.invoke('create-yoco-deposit', { body: { amountCents } });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
        toast({ title: 'Redirecting to Payment', description: 'Opening checkout in a new tab...' });
      }
      setDepositAmount('');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to process deposit', variant: 'destructive' });
    } finally {
      setIsDepositing(false);
    }
  };

  const handleWithdrawal = async () => {
    try {
      const amount = parseFloat(withdrawalAmount);
      const validation = withdrawalSchema.safeParse({ amount, bankAccount: selectedBankAccount });
      if (!validation.success) {
        toast({ title: 'Validation Error', description: validation.error.errors[0].message, variant: 'destructive' });
        return;
      }
      const amountCents = Math.round(amount * 100);
      if (amountCents > (user?.balance_cents || 0)) {
        toast({ title: 'Insufficient Funds', description: `You only have ${formatCurrency(user?.balance_cents || 0, 'real')} available`, variant: 'destructive' });
        return;
      }
      setIsWithdrawing(true);
      const { data, error } = await supabase.functions.invoke('create-withdrawal', { body: { amountCents } });
      if (error) throw error;
      toast({ title: 'Withdrawal Initiated', description: data?.message || `Withdrawal of ${formatCurrency(amountCents, 'real')} is being processed.` });
      setWithdrawalAmount('');
      await loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to process withdrawal', variant: 'destructive' });
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleAddPaymentMethod = () => {
    toast({ title: 'Add Payment Method', description: 'Payment method management requires Stripe or PayFast integration.' });
  };

  const handleRemovePaymentMethod = (id: string) => {
    setPaymentMethods(paymentMethods.filter(pm => pm.id !== id));
    toast({ title: 'Payment Method Removed', description: 'The payment method has been removed.' });
  };

  // Transaction stats
  const totalDeposits = transactions.filter(t => t.amount_cents > 0).reduce((s, t) => s + t.amount_cents, 0);
  const totalWithdrawals = Math.abs(transactions.filter(t => t.amount_cents < 0).reduce((s, t) => s + t.amount_cents, 0));

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (mode === 'virtual') {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="max-w-md mx-auto border-2">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
                <Wallet className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-1">Real Money Only</h2>
                <p className="text-sm text-muted-foreground">
                  Banking features are only available in Real Money Mode.
                </p>
              </div>
              <Button onClick={() => navigate('/')} variant="outline">Return to Dashboard</Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <motion.div 
        className="max-w-6xl mx-auto space-y-6"
        initial="initial" animate="animate"
        variants={{ animate: { transition: { staggerChildren: 0.06 } } }}
      >
        {/* Header */}
        <motion.div variants={fadeUp} transition={{ duration: 0.4 }}>
          <Card className="border-2 border-primary/20 bg-card/80 backdrop-blur-sm shadow-lg shadow-primary/10 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5 pointer-events-none" />
            <CardHeader className="relative">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-full">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div>
                    <CardTitle className="text-2xl flex items-center gap-2 text-primary">
                      <Sparkles className="h-6 w-6" />
                      Banking & Transactions
                    </CardTitle>
                    <CardDescription>Manage deposits, withdrawals, and payment methods</CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="bg-primary/10 border-primary text-primary">
                  💰 Real Money
                </Badge>
              </div>
            </CardHeader>
          </Card>
        </motion.div>

        {/* Balance + Stats */}
        <motion.div variants={fadeUp} transition={{ duration: 0.4 }} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="md:col-span-1 border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden relative">
            <div className="absolute top-3 right-3 p-3 rounded-full bg-primary/10">
              <DollarSign className="h-7 w-7 text-primary" />
            </div>
            <CardContent className="pt-6 pb-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Available Balance</p>
              <motion.p 
                className="text-3xl font-bold text-primary"
                key={user?.balance_cents}
                initial={{ scale: 1.05 }}
                animate={{ scale: 1 }}
              >
                {formatCurrency(user?.balance_cents || 0, 'real')}
              </motion.p>
              <Button variant="ghost" size="sm" onClick={loadData} className="mt-2 text-xs text-muted-foreground hover:text-primary">
                <RefreshCw className="h-3 w-3 mr-1" /> Refresh
              </Button>
            </CardContent>
          </Card>

          <Card className="border">
            <CardContent className="pt-6 pb-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Deposits</p>
                <TrendingUp className="h-4 w-4 text-green-500 opacity-60" />
              </div>
              <p className="text-2xl font-bold text-green-500">{formatCurrency(totalDeposits, 'real')}</p>
              <p className="text-xs text-muted-foreground mt-1">{transactions.filter(t => t.amount_cents > 0).length} transactions</p>
            </CardContent>
          </Card>

          <Card className="border">
            <CardContent className="pt-6 pb-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Withdrawals</p>
                <TrendingDown className="h-4 w-4 text-red-500 opacity-60" />
              </div>
              <p className="text-2xl font-bold text-red-500">{formatCurrency(totalWithdrawals, 'real')}</p>
              <p className="text-xs text-muted-foreground mt-1">{transactions.filter(t => t.amount_cents < 0).length} transactions</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Main Tabs */}
        <motion.div variants={fadeUp} transition={{ duration: 0.4 }}>
          <Tabs defaultValue="deposit" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="deposit" className="flex items-center gap-2">
                <ArrowDownToLine className="h-4 w-4" /> Deposit
              </TabsTrigger>
              <TabsTrigger value="withdraw" className="flex items-center gap-2">
                <ArrowUpFromLine className="h-4 w-4" /> Withdraw
              </TabsTrigger>
              <TabsTrigger value="payment-methods" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Methods
              </TabsTrigger>
            </TabsList>

            {/* Deposit */}
            <TabsContent value="deposit">
              <Card className="border-2 border-primary/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <ArrowDownToLine className="h-5 w-5" /> Deposit Funds
                  </CardTitle>
                  <CardDescription>Add money to your betting account</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <Alert className="bg-primary/5 border-primary/20">
                    <Shield className="h-4 w-4" />
                    <AlertDescription>All transactions are secured with bank-level encryption.</AlertDescription>
                  </Alert>

                  <div className="space-y-3">
                    <Label htmlFor="deposit-amount">Amount (ZAR)</Label>
                    <Input
                      id="deposit-amount" type="number" placeholder="Enter amount (R10 - R10,000)"
                      value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)}
                      min="10" max="10000" step="10" className="text-lg h-12"
                    />
                    {/* Quick presets */}
                    <div className="flex flex-wrap gap-2">
                      {DEPOSIT_PRESETS.map(amt => (
                        <motion.div key={amt} whileTap={{ scale: 0.93 }}>
                          <Button
                            type="button" variant="outline" size="sm"
                            className={`text-xs ${depositAmount === String(amt) ? 'border-primary bg-primary/10 text-primary' : ''}`}
                            onClick={() => setDepositAmount(String(amt))}
                          >
                            R{amt}
                          </Button>
                        </motion.div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Min: R10 • Max: R10,000</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payment-method">Payment Method</Label>
                    <select
                      id="payment-method"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
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

                  <AnimatePresence>
                    {depositAmount && parseFloat(depositAmount) > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Deposit:</span>
                            <span className="font-medium">{formatCurrency(Math.round(parseFloat(depositAmount) * 100), 'real')}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Fee:</span>
                            <span className="font-medium text-green-500">R0.00</span>
                          </div>
                          <div className="flex justify-between text-lg font-bold border-t border-primary/10 pt-2">
                            <span>You Receive:</span>
                            <span className="text-primary">{formatCurrency(Math.round(parseFloat(depositAmount) * 100), 'real')}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.div whileTap={{ scale: 0.98 }}>
                    <Button
                      onClick={handleDeposit}
                      disabled={!depositAmount || !selectedPaymentMethod || isDepositing}
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-base"
                    >
                      {isDepositing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <ArrowDownToLine className="h-4 w-4 mr-2" />}
                      {isDepositing ? 'Processing...' : 'Deposit Funds'}
                    </Button>
                  </motion.div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Withdraw */}
            <TabsContent value="withdraw">
              <Card className="border-2 border-primary/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <ArrowUpFromLine className="h-5 w-5" /> Withdraw Funds
                  </CardTitle>
                  <CardDescription>Transfer winnings to your bank account</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <Alert className="bg-accent/10 border-accent/20">
                    <Clock className="h-4 w-4" />
                    <AlertDescription>Withdrawals take 2-5 business days. Max: R50,000/transaction.</AlertDescription>
                  </Alert>

                  <div className="space-y-3">
                    <Label htmlFor="withdrawal-amount">Amount (ZAR)</Label>
                    <Input
                      id="withdrawal-amount" type="number" placeholder="Enter amount (R50 - R50,000)"
                      value={withdrawalAmount} onChange={(e) => setWithdrawalAmount(e.target.value)}
                      min="50" max="50000" step="10" className="text-lg h-12"
                    />
                    <div className="flex flex-wrap gap-2">
                      {WITHDRAWAL_PRESETS.map(amt => (
                        <motion.div key={amt} whileTap={{ scale: 0.93 }}>
                          <Button
                            type="button" variant="outline" size="sm"
                            className={`text-xs ${withdrawalAmount === String(amt) ? 'border-primary bg-primary/10 text-primary' : ''}`}
                            onClick={() => setWithdrawalAmount(String(amt))}
                          >
                            R{amt}
                          </Button>
                        </motion.div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Available: {formatCurrency(user?.balance_cents || 0, 'real')} • Min: R50
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bank-account">Bank Account</Label>
                    <select
                      id="bank-account"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
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

                  <AnimatePresence>
                    {withdrawalAmount && parseFloat(withdrawalAmount) > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 rounded-xl bg-accent/5 border border-accent/20 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Withdrawal:</span>
                            <span className="font-medium">{formatCurrency(Math.round(parseFloat(withdrawalAmount) * 100), 'real')}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Fee:</span>
                            <span className="font-medium">R0.00</span>
                          </div>
                          <div className="flex justify-between text-lg font-bold border-t border-accent/10 pt-2">
                            <span>You Receive:</span>
                            <span className="text-primary">{formatCurrency(Math.round(parseFloat(withdrawalAmount) * 100), 'real')}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.div whileTap={{ scale: 0.98 }}>
                    <Button
                      onClick={handleWithdrawal}
                      disabled={!withdrawalAmount || !selectedBankAccount || isWithdrawing}
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-base"
                    >
                      {isWithdrawing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <ArrowUpFromLine className="h-4 w-4 mr-2" />}
                      {isWithdrawing ? 'Processing...' : 'Request Withdrawal'}
                    </Button>
                  </motion.div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Payment Methods */}
            <TabsContent value="payment-methods">
              <Card className="border-2 border-primary/10">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-primary">
                        <CreditCard className="h-5 w-5" /> Payment Methods
                      </CardTitle>
                      <CardDescription>Manage your cards and bank accounts</CardDescription>
                    </div>
                    <motion.div whileTap={{ scale: 0.95 }}>
                      <Button onClick={handleAddPaymentMethod} className="bg-primary hover:bg-primary/90">
                        <Plus className="h-4 w-4 mr-2" /> Add
                      </Button>
                    </motion.div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {paymentMethods.map((method, i) => (
                    <motion.div
                      key={method.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                    >
                      <Card className="border hover:border-primary/30 transition-colors">
                        <CardContent className="pt-4 pb-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2.5 rounded-xl ${method.type === 'card' ? 'bg-primary/10' : 'bg-accent/10'}`}>
                                {method.type === 'card' ? <CreditCard className="h-5 w-5 text-primary" /> : <Wallet className="h-5 w-5 text-accent-foreground" />}
                              </div>
                              <div>
                                <p className="font-medium text-sm">{method.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {method.type === 'card' ? 'Credit/Debit Card' : 'Bank Account'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {method.isDefault && (
                                <Badge variant="outline" className="bg-primary/10 border-primary text-primary text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Default
                                </Badge>
                              )}
                              <Button variant="ghost" size="icon" onClick={() => handleRemovePaymentMethod(method.id)} disabled={method.isDefault}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}

                  <Alert className="bg-primary/5 border-primary/20">
                    <Shield className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Your payment information is encrypted and stored securely.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Transaction History */}
        <motion.div variants={fadeUp} transition={{ duration: 0.4 }}>
          <Card className="border-2 border-primary/10 overflow-hidden">
            <CardHeader className="border-b">
              <CardTitle className="text-primary flex items-center gap-2">
                <Clock className="h-5 w-5" /> Recent Transactions
              </CardTitle>
              <CardDescription>{transactions.length} transactions</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {transactions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                    <Wallet className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">No transactions yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Make a deposit to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions.map((tx, i) => (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-center justify-between p-3.5 border rounded-xl hover:bg-muted/50 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${tx.amount_cents > 0 ? 'bg-green-500/10' : 'bg-red-500/10'} group-hover:scale-110 transition-transform`}>
                          {tx.amount_cents > 0 ? (
                            <ArrowDownToLine className="h-4 w-4 text-green-500" />
                          ) : (
                            <ArrowUpFromLine className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm capitalize">{tx.transaction_type.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(tx.created_at), 'MMM dd, yyyy • HH:mm')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${tx.amount_cents > 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {tx.amount_cents > 0 ? '+' : ''}{formatCurrency(tx.amount_cents, 'real')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Bal: {formatCurrency(tx.balance_after_cents, 'real')}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Transactions;
