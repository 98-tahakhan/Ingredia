import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "./components/AppShell";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { Loader2 } from "lucide-react";
import SplashScreen from "./components/SplashScreen";
import PageSkeleton from "./components/PageSkeleton";
import { lazy, Suspense, useState } from "react";

// ─── Lazy-loaded pages (non-tab pages only — tabs are loaded by SwipePager) ──
const Scan = lazy(() => import("./pages/Scan"));
const Processing = lazy(() => import("./pages/Processing"));
const Results = lazy(() => import("./pages/Results"));
const About = lazy(() => import("./pages/About"));
const Disclaimer = lazy(() => import("./pages/Disclaimer"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));

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

/**
 * Empty component for swipeable tab routes.
 * The actual rendering is handled by SwipePager inside AppShell.
 * These routes exist so React Router matches the path and AppShell
 * knows which tab is active.
 */
const TabPlaceholder = () => null;

const App = () => {
  const [splashDone, setSplashDone] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner
          position="top-center"
          toastOptions={{
            duration: 3000,
            className: "!rounded-2xl !shadow-card",
          }}
        />
        {!splashDone && <SplashScreen onComplete={() => setSplashDone(true)} />}
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route element={<ProtectedRoute />}>
                  <Route element={<AppShell />}>
                    {/* Swipeable tabs — rendered by SwipePager, route just for path matching */}
                    <Route path="/" element={<TabPlaceholder />} />
                    <Route path="/history" element={<TabPlaceholder />} />
                    <Route path="/saved" element={<TabPlaceholder />} />
                    <Route path="/settings" element={<TabPlaceholder />} />
                    {/* Non-swipeable pages — rendered normally via Outlet */}
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
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
