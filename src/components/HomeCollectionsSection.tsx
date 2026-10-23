import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CollectionTile } from '@/components/CollectionTile';
import { useCanonicalSearch } from '@/hooks/useCanonicalSearch';
import { distinctTileCovers, publishedCollections } from '@/domain/collections';

const HOME_COLLECTION_COUNT = 3;

/** Home teaser for editorial collections; reuses the catalogue the hero already loads. */
const HomeCollectionsSection = () => {
  const catalog = useCanonicalSearch(true);
  const collections = useMemo(
    () => publishedCollections(catalog.data || []).slice(0, HOME_COLLECTION_COUNT),
    [catalog.data],
  );
  const covers = useMemo(() => distinctTileCovers(collections), [collections]);

  if (collections.length === 0) return null;

  return (
    <section className="bg-[#06101a] py-14 section-padding" aria-labelledby="home-collections-title">
      <div className="container mx-auto">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--mw-accent-coral)]">Sélections</p>
            <h2 id="home-collections-title" className="font-editorial text-3xl uppercase text-white md:text-4xl">Collections du moment</h2>
          </div>
          <Link to="/collections" className="text-xs font-semibold uppercase tracking-wider text-manga-cyan hover:underline">
            Toutes les collections →
          </Link>
        </div>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map(({ collection, works }, index) => (
            <li key={collection.slug}>
              <CollectionTile collection={collection} count={works.length} covers={covers[index]} headingLevel="h3" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default HomeCollectionsSection;
