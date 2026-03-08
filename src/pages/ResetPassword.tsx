import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, EyeOff, Check, X, Lock, CloudSun } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check for recovery session from the URL hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');

    if (type === 'recovery') {
      setIsValidSession(true);
      setChecking(false);
    } else {
      // Also check if user has an active session (they may have already been redirected)
      supabase.auth.getSession().then(({ data: { session } }) => {
        setIsValidSession(!!session);
        setChecking(false);
      });
    }
  }, []);

  const passwordChecks = useMemo(() => [
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

  const allChecksMet = passwordChecks.every(c => c.met);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allChecksMet) return;
    if (!passwordsMatch) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
        toast({ title: 'Password updated! 🔒', description: 'You can now sign in with your new password.' });
        setTimeout(() => navigate('/'), 2000);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isValidSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <X className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="font-medium">Invalid or expired link</p>
              <p className="text-sm text-muted-foreground mt-1">
                This password reset link is invalid or has expired. Please request a new one.
              </p>
            </div>
            <Button onClick={() => navigate('/auth')} className="w-full">
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
              <Check className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="font-medium">Password updated!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Redirecting you to the app...
              </p>
            </div>
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
            <CardTitle className="text-xl">Set New Password</CardTitle>
            <CardDescription>Choose a strong password for your account</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="new-password"
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

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10"
                  required
                  autoComplete="new-password"
                />
              </div>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <X className="h-3 w-3" /> Passwords don't match
                </p>
              )}
              {passwordsMatch && (
                <p className="text-xs text-success flex items-center gap-1">
                  <Check className="h-3 w-3" /> Passwords match
                </p>
              )}
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription className="text-sm">{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={loading || !allChecksMet || !passwordsMatch}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : 'Update Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
