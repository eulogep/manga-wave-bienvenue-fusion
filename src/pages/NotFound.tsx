import { Link, useLocation } from 'react-router-dom';
import { Compass, Home, Search } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { useDocumentMetadata } from '@/hooks/useDocumentMetadata';
import { formatDocumentTitle } from '@/domain/documentMetadata';

const NotFound = () => {
  useDocumentMetadata(formatDocumentTitle('Page introuvable'));
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-[#080c14] text-white">
      <Header />
      <main className="flex flex-1 items-center justify-center section-padding py-16">
        <div className="max-w-xl text-center">
          <p className="font-editorial text-7xl text-[var(--mw-accent-coral)] md:text-8xl" aria-hidden="true">404</p>
          <h1 className="mt-4 font-editorial text-3xl uppercase md:text-4xl">Cette page s’est perdue entre deux chapitres</h1>
          <p className="mt-4 text-sm leading-6 text-white/70">
            L’adresse <code className="rounded bg-white/10 px-1.5 py-0.5 text-white/85">{location.pathname}</code> ne mène à aucune page de Manga Wave.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild className="btn-gradient rounded-full px-6"><Link to="/"><Home className="mr-2 h-4 w-4" aria-hidden="true" />Accueil</Link></Button>
            <Button asChild variant="outline" className="rounded-full border-white/20"><Link to="/search"><Search className="mr-2 h-4 w-4" aria-hidden="true" />Chercher un manga</Link></Button>
            <Button asChild variant="ghost" className="rounded-full text-white/75"><Link to="/collections"><Compass className="mr-2 h-4 w-4" aria-hidden="true" />Collections</Link></Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default NotFound;
