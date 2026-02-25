import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { PageTransition } from "@/components/PageTransition";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import Index from "./pages/Index";
import ScanDetail from "./pages/ScanDetail";
import History from "./pages/History";
import Compare from "./pages/Compare";
import Policies from "./pages/Policies";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!session) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

const AppRoutes = () => {
  const { session, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <Routes>
      <Route path="/auth" element={session ? <Navigate to="/" replace /> : <Auth />} />
      <Route path="/auth/*" element={<Auth />} />
      <Route path="/~oauth" element={<Auth />} />
      <Route path="/~oauth/*" element={<Auth />} />
      <Route path="/" element={<ProtectedRoute><AppLayout><PageTransition><Index /></PageTransition></AppLayout></ProtectedRoute>} />
      <Route path="/scan/:id" element={<ProtectedRoute><AppLayout><PageTransition><ScanDetail /></PageTransition></AppLayout></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><AppLayout><PageTransition><History /></PageTransition></AppLayout></ProtectedRoute>} />
      <Route path="/compare" element={<ProtectedRoute><AppLayout><PageTransition><Compare /></PageTransition></AppLayout></ProtectedRoute>} />
      <Route path="/policies" element={<ProtectedRoute><AppLayout><PageTransition><Policies /></PageTransition></AppLayout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><AppLayout><PageTransition><Settings /></PageTransition></AppLayout></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
