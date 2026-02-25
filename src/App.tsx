import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { PageTransition } from "@/components/PageTransition";
import Index from "./pages/Index";
import NewScan from "./pages/NewScan";
import ScanDetail from "./pages/ScanDetail";
import History from "./pages/History";
import Compare from "./pages/Compare";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <PageTransition>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/scan" element={<NewScan />} />
              <Route path="/scan/:id" element={<ScanDetail />} />
              <Route path="/history" element={<History />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </PageTransition>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
