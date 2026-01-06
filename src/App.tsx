import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { CurrencyModeProvider } from "./contexts/CurrencyModeContext";
import { UserPreferencesProvider } from "./contexts/UserPreferencesContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import PurchaseHistory from "./pages/PurchaseHistory";
import CityAnalytics from "./pages/CityAnalytics";
import Admin from "./pages/Admin";
import Transactions from "./pages/Transactions";
import ModeComparison from "./pages/ModeComparison";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CurrencyModeProvider>
            <UserPreferencesProvider>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/purchase-history" element={<PurchaseHistory />} />
                <Route path="/city-analytics" element={<CityAnalytics />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/mode-comparison" element={<ModeComparison />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </UserPreferencesProvider>
          </CurrencyModeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
