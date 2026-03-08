import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { CurrencyModeProvider } from "./contexts/CurrencyModeContext";
import { UserPreferencesProvider } from "./contexts/UserPreferencesContext";
import { Loader2 } from "lucide-react";

// Lazy-loaded routes
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
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
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/purchase-history" element={<PurchaseHistory />} />
                  <Route path="/city-analytics" element={<CityAnalytics />} />
                  <Route path="/city-comparison" element={<CityComparisonPage />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/mode-comparison" element={<ModeComparison />} />
                  <Route path="/cashout" element={<CashoutManagement />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </UserPreferencesProvider>
          </CurrencyModeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
