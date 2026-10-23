import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Share2 } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import EditorialMangaCard from '@/components/EditorialMangaCard';
import { Button } from '@/components/ui/button';
import '@/components/Catalogue.css';
import { useCanonicalSearch } from '@/hooks/useCanonicalSearch';
import { useDocumentMetadata } from '@/hooks/useDocumentMetadata';
import { useToast } from '@/hooks/use-toast';
import { formatDocumentTitle } from '@/domain/documentMetadata';
import { collectionWorks, EDITORIAL_COLLECTIONS, findCollection, MIN_COLLECTION_SIZE } from '@/domain/collections';
import NotFound from './NotFound';

const PAGE_SIZE = 24;

const Collection = () => {
  const { slug } = useParams<{ slug: string }>();
  const collection = findCollection(slug);
  const catalog = useCanonicalSearch(Boolean(collection));
  const works = useMemo(() => (collection ? collectionWorks(collection, catalog.data || []) : []), [collection, catalog.data]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const { toast } = useToast();
  useEffect(() => setVisibleCount(PAGE_SIZE), [slug]);

  useDocumentMetadata(
    collection ? formatDocumentTitle(collection.title, 'Collections') : null,
    collection?.description,
    { canonicalUrl: collection ? `/collections/${collection.slug}` : null, imageUrl: works[0]?.cover_image || null },
  );

  if (!collection) return <NotFound />;

  const others = EDITORIAL_COLLECTIONS.filter((entry) => entry.slug !== collection.slug);
  const tooSmall = !catalog.isPending && !catalog.isError && works.length < MIN_COLLECTION_SIZE;

  const handleShare = async () => {
    const url = `${window.location.origin}/collections/${collection.slug}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: collection.title, text: collection.tagline, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: 'Lien copié', description: url });
      }
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') {
        toast({ variant: 'destructive', title: 'Partage impossible', description: url });
      }
    }
  };

  return (
    <div className="catalogue-page">
      <Header />
      <main className="section-padding py-10 md:py-14">
        <div className="catalogue-width">
          <Link to="/collections" className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-white/60 hover:text-white">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Toutes les collections
          </Link>
          <section className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-3xl">
              <p className="catalogue-eyebrow">{collection.tagline}</p>
              <h1 className="mt-2 font-editorial text-4xl uppercase leading-tight md:text-5xl">{collection.title}</h1>
              <p className="mt-3 text-sm leading-6 text-white/60 md:text-base">{collection.description}</p>
            </div>
            <Button type="button" variant="outline" className="border-white/20" onClick={() => void handleShare()}>
              <Share2 className="mr-2 h-4 w-4" aria-hidden="true" /> Partager
            </Button>
          </section>

          <section aria-labelledby="collection-results" aria-busy={catalog.isFetching} className="catalogue-results">
            <h2 id="collection-results" className="sr-only">Titres de la collection</h2>
            {catalog.isPending ? (
              <div className="catalogue-grid catalogue-skeleton" aria-label="Chargement des œuvres">{Array.from({ length: 10 }, (_, index) => <div key={index} />)}</div>
            ) : catalog.isError ? (
              <div role="alert" className="catalogue-empty"><p>Le catalogue n’a pas pu être chargé.</p>
                <div><button onClick={() => void catalog.refetch()}>Réessayer</button></div></div>
            ) : tooSmall ? (
              <div className="catalogue-empty"><h3>Cette collection se remplit encore.</h3>
                <p>Le catalogue ne contient pas encore assez de titres correspondants.</p>
                <div><Link to="/collections">Voir les autres collections</Link></div></div>
            ) : (
              <>
                <p role="status" className="mb-4 text-xs text-white/50">{works.length} titres</p>
                <div className="catalogue-grid">
                  {works.slice(0, visibleCount).map((work, index) => (
                    <EditorialMangaCard key={work.id} work={work} gated={false} priority={index < 2} />
                  ))}
                </div>
                {visibleCount < works.length && (
                  <div className="catalogue-pagination">
                    <button onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                      Afficher plus ({works.length - visibleCount} restants)
                    </button>
                  </div>
                )}
              </>
            )}
          </section>

          <nav aria-label="Autres collections" className="mt-14 border-t border-white/10 pt-8">
            <p className="catalogue-eyebrow mb-4">Autres collections</p>
            <div className="flex flex-wrap gap-2">
              {others.map((entry) => (
                <Link key={entry.slug} to={`/collections/${entry.slug}`} className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-4 text-sm text-white/75 hover:border-manga-purple hover:text-white">
                  {entry.title}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Collection;
