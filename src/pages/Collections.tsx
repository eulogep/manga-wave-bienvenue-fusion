import { useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { CollectionTile } from '@/components/CollectionTile';
import { Button } from '@/components/ui/button';
import { useCanonicalSearch } from '@/hooks/useCanonicalSearch';
import { useDocumentMetadata } from '@/hooks/useDocumentMetadata';
import { formatDocumentTitle } from '@/domain/documentMetadata';
import { distinctTileCovers, publishedCollections } from '@/domain/collections';

const Collections = () => {
  useDocumentMetadata(
    formatDocumentTitle('Collections'),
    'Des sélections thématiques du catalogue Manga Wave : manhwas d’action, isekai, séries terminées, romances et plus encore.',
  );
  const catalog = useCanonicalSearch(true);
  const collections = useMemo(() => publishedCollections(catalog.data || []), [catalog.data]);
  const tileCovers = useMemo(() => distinctTileCovers(collections), [collections]);

  return (
    <div className="min-h-screen flex flex-col bg-[#080c14] text-white">
      <Header />
      <main className="flex-1 section-padding py-10 md:py-14">
        <div className="container mx-auto">
          <section className="mb-10">
            <p className="text-manga-cyan font-semibold tracking-widest text-xs mb-2">SÉLECTIONS</p>
            <h1 className="text-4xl md:text-5xl font-bold font-japanese mb-2">
              <span className="glow-text">Collections</span>
            </h1>
            <p className="text-white/50 text-sm md:text-base max-w-2xl">
              Des portes d’entrée thématiques dans le catalogue, construites à partir des genres, formats et statuts
              de chaque œuvre. Chaque collection a sa propre page, facile à partager.
            </p>
          </section>

          {catalog.isPending ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
              {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-72 animate-pulse rounded-2xl bg-white/5" />)}
            </div>
          ) : catalog.isError ? (
            <section role="alert" className="mx-auto max-w-xl rounded-2xl border border-destructive/40 bg-destructive/10 p-8 text-center">
              <h2 className="mb-2 text-xl font-bold">Collections indisponibles</h2>
              <p className="mb-6 text-sm text-white/60">Le catalogue n’a pas pu être chargé.</p>
              <Button className="btn-gradient" onClick={() => void catalog.refetch()}>Réessayer</Button>
            </section>
          ) : (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {collections.map(({ collection, works }, index) => (
                <li key={collection.slug}>
                  <CollectionTile collection={collection} count={works.length} covers={tileCovers[index]} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Collections;
