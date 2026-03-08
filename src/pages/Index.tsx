import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ModeRouter } from '@/components/betting/ModeRouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, LogOut, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { MobileBottomNav } from '@/components/MobileBottomNav';

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileAction, setMobileAction] = useState<string | null>(null);

  const handleMobileAction = useCallback((action: string) => {
    // Broadcast action to dashboards via a custom event
    window.dispatchEvent(new CustomEvent('mobile-nav-action', { detail: action }));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              WeatherBet SA
            </CardTitle>
            <CardDescription>
              Please sign in to access your betting dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.href = '/auth'} className="w-full">
              Go to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-lg sm:text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent truncate">
            ⛈️ WeatherBet SA
          </h1>
          <div className="flex items-center gap-1 sm:gap-2">
            <NotificationCenter />
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/mode-comparison')}
              className="hidden sm:inline-flex"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Compare Modes
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="pb-20 md:pb-4">
        <ModeRouter />
      </main>
      <MobileBottomNav onAction={handleMobileAction} />
    </div>
  );
};

export default Index;
