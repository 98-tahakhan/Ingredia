import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import { AppShell } from "./components/AppShell";
import Scan from "./pages/Scan";
import Processing from "./pages/Processing";
import Results from "./pages/Results";
import HistoryPage from "./pages/History";
import Saved from "./pages/Saved";
import SettingsPage from "./pages/SettingsPage";
import About from "./pages/About";
import Disclaimer from "./pages/Disclaimer";
import Privacy from "./pages/Privacy";
import Notifications from "./pages/Notifications";
import Auth from "./pages/Auth";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { Loader2 } from "lucide-react";
import SplashScreen from "./components/SplashScreen";
import { useState } from "react";

const queryClient = new QueryClient();

const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <Outlet />;
};

const App = () => {
  const [splashDone, setSplashDone] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {!splashDone && <SplashScreen onComplete={() => setSplashDone(true)} />}
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppShell />}>
                  <Route path="/" element={<Index />} />
                  <Route path="/history" element={<HistoryPage />} />
                  <Route path="/saved" element={<Saved />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/disclaimer" element={<Disclaimer />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/results/:barcode" element={<Results />} />
                  <Route path="/processing/:barcode" element={<Processing />} />
                  <Route path="/scan" element={<Scan />} />
                </Route>
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
