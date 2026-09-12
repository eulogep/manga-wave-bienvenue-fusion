
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { CommandSearchProvider } from "@/hooks/useCommandSearch";
import { CommandSearchDialog } from "@/components/CommandSearchDialog";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Search from "./pages/Search";
import MangaDetail from "./pages/MangaDetail";
import History from "./pages/History";
import Library from "./pages/Library";
import Trending from "./pages/Trending";
import Reader from "./pages/Reader";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <CommandSearchProvider>
            <CommandSearchDialog />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/search" element={<Search />} />
              <Route path="/manga/:id" element={<MangaDetail />} />
              <Route path="/read/:source/:mangaId/:chapterId" element={<Reader />} />
              <Route path="/history" element={<History />} />
              <Route path="/library" element={<Library />} />
              <Route path="/trending" element={<Trending />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </CommandSearchProvider>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
