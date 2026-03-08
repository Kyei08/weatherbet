import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { CurrencyModeProvider } from "./contexts/CurrencyModeContext";
import { UserPreferencesProvider } from "./contexts/UserPreferencesContext";
import { Loader2 } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { PageTransition } from "./components/PageTransition";

// Lazy-loaded routes
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const PurchaseHistory = lazy(() => import("./pages/PurchaseHistory"));
const CityAnalytics = lazy(() => import("./pages/CityAnalytics"));
const CityComparisonPage = lazy(() => import("./pages/CityComparisonPage"));
const Admin = lazy(() => import("./pages/Admin"));
const Transactions = lazy(() => import("./pages/Transactions"));
const ModeComparison = lazy(() => import("./pages/ModeComparison"));
const CashoutManagement = lazy(() => import("./pages/CashoutManagement"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Index /></PageTransition>} />
        <Route path="/auth" element={<PageTransition><Auth /></PageTransition>} />
        <Route path="/reset-password" element={<PageTransition><ResetPassword /></PageTransition>} />
        <Route path="/purchase-history" element={<PageTransition><PurchaseHistory /></PageTransition>} />
        <Route path="/city-analytics" element={<PageTransition><CityAnalytics /></PageTransition>} />
        <Route path="/city-comparison" element={<PageTransition><CityComparisonPage /></PageTransition>} />
        <Route path="/admin" element={<PageTransition><Admin /></PageTransition>} />
        <Route path="/transactions" element={<PageTransition><Transactions /></PageTransition>} />
        <Route path="/mode-comparison" element={<PageTransition><ModeComparison /></PageTransition>} />
        <Route path="/cashout" element={<PageTransition><CashoutManagement /></PageTransition>} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CurrencyModeProvider>
            <UserPreferencesProvider>
              <Suspense fallback={<PageLoader />}>
                <AnimatedRoutes />
              </Suspense>
            </UserPreferencesProvider>
          </CurrencyModeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
