import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, EyeOff, Check, X, Mail, Lock, CloudSun, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

// Friendly error messages for Supabase auth errors
const friendlyErrors: Record<string, string> = {
  'Invalid login credentials': 'Incorrect email or password. Please try again.',
  'Email not confirmed': 'Please check your email and confirm your account before signing in.',
  'User already registered': 'An account with this email already exists. Try signing in instead.',
  'Signup requires a valid password': 'Please enter a valid password.',
  'Password should be at least 6 characters': 'Password must be at least 8 characters long.',
  'Email rate limit exceeded': 'Too many attempts. Please wait a few minutes before trying again.',
  'For security purposes, you can only request this after': 'Too many requests. Please wait before trying again.',
};

const getFriendlyError = (msg: string): string => {
  for (const [key, value] of Object.entries(friendlyErrors)) {
    if (msg.includes(key)) return value;
  }
  if (msg.includes('rate limit') || msg.includes('too many')) {
    return 'Too many attempts. Please wait a few minutes before trying again.';
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return 'Network error. Please check your connection and try again.';
  }
  return msg;
};

const signUpSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address').max(255, 'Email is too long'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password is too long')
    .regex(/[a-z]/, 'Must include a lowercase letter')
    .regex(/[A-Z]/, 'Must include an uppercase letter')
    .regex(/[0-9]/, 'Must include a number'),
});

const signInSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address').max(255),
  password: z.string().min(1, 'Password is required'),
});

const forgotSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
});

interface PasswordCheck {
  label: string;
  met: boolean;
}

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('signin');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmailSent, setForgotEmailSent] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) navigate('/');
    };
    checkAuth();
  }, [navigate]);

  // Clear error when switching tabs or changing inputs
  useEffect(() => { setError(''); }, [activeTab, email, password]);

  const passwordChecks: PasswordCheck[] = useMemo(() => [
    { label: '8+ characters', met: password.length >= 8 },
    { label: 'Lowercase letter', met: /[a-z]/.test(password) },
    { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Number', met: /[0-9]/.test(password) },
  ], [password]);

  const passwordStrength = useMemo(() => {
    const score = passwordChecks.filter(c => c.met).length;
    if (score <= 1) return { label: 'Weak', color: 'bg-destructive', width: '25%' };
    if (score === 2) return { label: 'Fair', color: 'bg-warning', width: '50%' };
    if (score === 3) return { label: 'Good', color: 'bg-primary', width: '75%' };
    return { label: 'Strong', color: 'bg-success', width: '100%' };
  }, [passwordChecks]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const validation = signUpSchema.safeParse({ email: email.trim(), password });
    if (!validation.success) {
      const errors = validation.error.flatten().fieldErrors;
      setError(errors.email?.[0] || errors.password?.[0] || 'Please fix the errors above');
      setLoading(false);
      return;
    }

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });

      if (signUpError) {
        setError(getFriendlyError(signUpError.message));
      } else {
        toast({
          title: "Account created! 🎉",
          description: "Check your email for a confirmation link, then sign in.",
        });
        setActiveTab('signin');
        setPassword('');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const validation = signInSchema.safeParse({ email: email.trim(), password });
    if (!validation.success) {
      const errors = validation.error.flatten().fieldErrors;
      setError(errors.email?.[0] || errors.password?.[0] || 'Please fix the errors above');
      setLoading(false);
      return;
    }

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(getFriendlyError(signInError.message));
      } else {
        navigate('/');
        toast({ title: "Welcome back! ☀️", description: "You've successfully signed in." });
      }
    } catch {
      setError('Connection failed. Please check your network.');
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const validation = forgotSchema.safeParse({ email: email.trim() });
    if (!validation.success) {
      setError(validation.error.flatten().fieldErrors.email?.[0] || 'Invalid email');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setError(getFriendlyError(error.message));
      } else {
        setForgotEmailSent(true);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  // Forgot password view
  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <button
              onClick={() => { setShowForgotPassword(false); setForgotEmailSent(false); setError(''); }}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2 self-start"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </button>
            <CardTitle className="text-xl">Reset Password</CardTitle>
            <CardDescription>
              Enter your email and we'll send you a reset link
            </CardDescription>
          </CardHeader>
          <CardContent>
            {forgotEmailSent ? (
              <div className="text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                  <Mail className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="font-medium">Check your email</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    We sent a password reset link to <strong>{email}</strong>. It may take a minute to arrive.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Didn't receive it? Check spam or{' '}
                  <button
                    onClick={() => setForgotEmailSent(false)}
                    className="text-primary hover:underline"
                  >
                    try again
                  </button>
                </p>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send Reset Link
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <CloudSun className="h-7 w-7 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">WeatherBet</CardTitle>
            <CardDescription className="mt-1">
              Predict the weather, win rewards
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setError(''); }} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="signin-password">Password</Label>
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signin-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription className="text-sm">{error}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : 'Sign In'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create a strong password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Password strength bar */}
                  {password.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Strength</span>
                        <span className={`font-medium ${
                          passwordStrength.label === 'Weak' ? 'text-destructive' :
                          passwordStrength.label === 'Fair' ? 'text-warning' :
                          passwordStrength.label === 'Good' ? 'text-primary' : 'text-success'
                        }`}>
                          {passwordStrength.label}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color}`}
                          style={{ width: passwordStrength.width }}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        {passwordChecks.map((check) => (
                          <div key={check.label} className="flex items-center gap-1.5 text-[11px]">
                            {check.met ? (
                              <Check className="h-3 w-3 text-success flex-shrink-0" />
                            ) : (
                              <X className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            )}
                            <span className={check.met ? 'text-success' : 'text-muted-foreground'}>
                              {check.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription className="text-sm">{error}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" className="w-full" size="lg" disabled={loading || passwordChecks.some(c => !c.met)}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : 'Create Account'}
                </Button>
                <p className="text-[10px] text-center text-muted-foreground">
                  By signing up you agree to responsible betting practices
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
