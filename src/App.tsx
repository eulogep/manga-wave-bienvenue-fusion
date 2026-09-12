import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { CommandSearchProvider, useCommandSearch } from "@/hooks/useCommandSearch";
import Index from "./pages/Index";

const CommandSearchDialog = lazy(() => import("@/components/CommandSearchDialog").then((module) => ({ default: module.CommandSearchDialog })));
const Auth = lazy(() => import("./pages/Auth"));
const Search = lazy(() => import("./pages/Search"));
const MangaDetail = lazy(() => import("./pages/MangaDetail"));
const History = lazy(() => import("./pages/History"));
const Library = lazy(() => import("./pages/Library"));
const Trending = lazy(() => import("./pages/Trending"));
const Ranking = lazy(() => import("./pages/Ranking"));
const Random = lazy(() => import("./pages/Random"));
const Reader = lazy(() => import("./pages/Reader"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const RouteLoading = () => (
  <main className="flex min-h-[60vh] items-center justify-center bg-[var(--mw-background)] px-6 text-[var(--mw-text-primary)]">
    <p role="status" className="text-sm text-[var(--mw-text-secondary)]">Chargement de Manga Wave…</p>
  </main>
);

const DeferredCommandSearchDialog = () => {
  const { isOpen } = useCommandSearch();
  if (!isOpen) return null;
  return <Suspense fallback={null}><CommandSearchDialog /></Suspense>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <CommandSearchProvider>
            <DeferredCommandSearchDialog />
            <Suspense fallback={<RouteLoading />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/search" element={<Search />} />
                <Route path="/manga/:id" element={<MangaDetail />} />
                <Route path="/read/:source/:mangaId/:chapterId" element={<Reader />} />
                <Route path="/history" element={<History />} />
                <Route path="/library" element={<Library />} />
                <Route path="/trending" element={<Trending />} />
                <Route path="/ranking" element={<Ranking />} />
                <Route path="/random" element={<Random />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </CommandSearchProvider>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
