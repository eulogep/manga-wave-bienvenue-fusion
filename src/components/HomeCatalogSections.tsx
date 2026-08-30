import { useMemo, useState } from 'react';
import MangaCard from '@/components/MangaCard';
import { useManga, type Manga } from '@/hooks/useManga';
import { buildAnonymousHomeCatalog, buildPersonalizedHomeCatalog } from '@/domain/homePersonalization';

type Props = {
  mode: 'anonymous' | 'personalized';
};

type RailProps = {
  eyebrow: string;
  title: string;
  description: string;
  mangas: Manga[];
  favorites: number[];
  surface?: 'base' | 'raised';
};

const MangaRail = ({ eyebrow, title, description, mangas, favorites, surface = 'base' }: RailProps) => {
  if (mangas.length === 0) return null;
  return (
    <section className={`${surface === 'raised' ? 'bg-[#08131d]' : 'bg-[#06101a]'} py-12 section-padding`} aria-labelledby={`home-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
      <div className="container mx-auto">
        <div className="mb-7 border-b border-[var(--mw-border)] pb-5 md:flex md:items-end md:justify-between md:gap-8">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--mw-accent-blue)]">{eyebrow}</p>
            <h2 id={`home-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} className="font-editorial text-3xl uppercase text-white md:text-4xl">{title}</h2>
          </div>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--mw-text-secondary)] md:mt-0 md:text-right">{description}</p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {mangas.map((manga) => (
            <MangaCard
              key={manga.id}
              id={manga.id}
              title={manga.title}
              author={manga.author || 'Auteur inconnu'}
              rating={manga.rating}
              status={manga.status}
              genre={manga.genre}
              imageUrl={manga.cover_image}
              lastUpdate={manga.source_updated_at || manga.created_at}
              isFavorite={favorites.includes(manga.id)}
              favoriteId={manga.id}
              externalUrl={manga.mangadex_id ? `https://mangadex.org/title/${manga.mangadex_id}` : undefined}
              detailUrl={`/manga/${manga.id}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

const HomeCatalogSections = ({ mode }: Props) => {
  const { mangas, favorites, isLoading, isError } = useManga();
  const [selectedFormat, setSelectedFormat] = useState<string>('all');
  const seed = useMemo(() => Number(new Date().toISOString().slice(0, 10).replace(/-/g, '')), []);
  const anonymous = useMemo(() => buildAnonymousHomeCatalog(mangas, seed), [mangas, seed]);
  const personalized = useMemo(() => buildPersonalizedHomeCatalog(mangas, favorites), [favorites, mangas]);
  const formatMangas = useMemo(
    () => (selectedFormat === 'all' ? mangas : mangas.filter((manga) => manga.manga_type === selectedFormat)).slice(0, 6),
    [mangas, selectedFormat],
  );

  if (isLoading) {
    return <section className="bg-[#08131d] py-16 text-center text-sm text-[var(--mw-text-secondary)]" aria-live="polite">Préparation de votre accueil…</section>;
  }
  if (isError || mangas.length === 0) return null;

  if (mode === 'personalized') {
    return (
      <>
        <MangaRail eyebrow="À lire maintenant" title="Nouveaux chapitres" description="Les séries en cours actualisées le plus récemment." mangas={personalized.newChapters} favorites={favorites} surface="raised" />
        <MangaRail eyebrow="Sélection personnelle" title="Pour vous" description={personalized.favoriteGenres.length ? `Inspiré par ${personalized.favoriteGenres.slice(0, 3).join(', ')}.` : 'Une sélection populaire pendant que vos goûts se précisent.'} mangas={personalized.forYou} favorites={favorites} />
        <MangaRail eyebrow="Communauté" title="Tendances" description="Les titres qui concentrent le plus d’intérêt dans le catalogue." mangas={personalized.trending} favorites={favorites} surface="raised" />
        <MangaRail eyebrow="Catalogue" title="Récemment mis à jour" description="Les dernières fiches synchronisées, toutes séries confondues." mangas={personalized.recentlyUpdated} favorites={favorites} />
        {personalized.favoriteGenres.length > 0 && (
          <section className="bg-[#08131d] py-10 section-padding" aria-labelledby="favorite-genres-title">
            <div className="container mx-auto border-y border-[var(--mw-border)] py-7">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--mw-accent-coral)]">Votre univers</p>
              <h2 id="favorite-genres-title" className="font-editorial text-3xl uppercase text-white">Genres favoris</h2>
              <div className="mt-5 flex flex-wrap gap-2">{personalized.favoriteGenres.map((genre) => <span key={genre} className="border border-[var(--mw-border)] bg-[var(--mw-surface)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white">{genre}</span>)}</div>
            </div>
          </section>
        )}
        <MangaRail eyebrow="À découvrir sans attendre" title="Séries terminées" description="Des histoires complètes pour lire jusqu’au dernier chapitre." mangas={personalized.completed} favorites={favorites} surface="raised" />
      </>
    );
  }

  return (
    <>
      <MangaRail eyebrow="Nouveautés" title="Dernières sorties" description="Les titres récemment actualisés dans le catalogue Manga Wave." mangas={anonymous.latest} favorites={favorites} />
      <MangaRail eyebrow="Les plus consultés" title="Populaires" description="Une sélection ordonnée par intérêt et appréciation." mangas={anonymous.popular} favorites={favorites} surface="raised" />
      <section className="bg-[#06101a] py-10 section-padding" aria-labelledby="formats-title">
        <div className="container mx-auto">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--mw-accent-coral)]">Origines et formats</p>
          <h2 id="formats-title" className="font-editorial text-3xl uppercase text-white">Manga · Manhwa · Manhua</h2>
          <div className="my-6 flex gap-2 overflow-x-auto hide-scrollbar">
            <button type="button" onClick={() => setSelectedFormat('all')} aria-pressed={selectedFormat === 'all'} className={`min-h-11 shrink-0 border px-4 text-xs font-semibold uppercase ${selectedFormat === 'all' ? 'border-[var(--mw-accent-coral)] text-white' : 'border-[var(--mw-border)] text-[var(--mw-text-secondary)]'}`}>Tous</button>
            {anonymous.formats.map((format) => <button key={format} type="button" onClick={() => setSelectedFormat(format)} aria-pressed={selectedFormat === format} className={`min-h-11 shrink-0 border px-4 text-xs font-semibold uppercase ${selectedFormat === format ? 'border-[var(--mw-accent-coral)] text-white' : 'border-[var(--mw-border)] text-[var(--mw-text-secondary)]'}`}>{format}</button>)}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">{formatMangas.map((manga) => <MangaCard key={manga.id} id={manga.id} title={manga.title} author={manga.author || 'Auteur inconnu'} rating={manga.rating} status={manga.status} genre={manga.genre} imageUrl={manga.cover_image} lastUpdate={manga.source_updated_at || manga.created_at} isFavorite={favorites.includes(manga.id)} favoriteId={manga.id} externalUrl={manga.mangadex_id ? `https://mangadex.org/title/${manga.mangadex_id}` : undefined} detailUrl={`/manga/${manga.id}`} />)}</div>
        </div>
      </section>
      <MangaRail eyebrow="Laissez faire la vague" title="Découverte aléatoire" description="Une sélection renouvelée chaque jour pour sortir des habitudes." mangas={anonymous.randomDiscovery} favorites={favorites} surface="raised" />
    </>
  );
};

export default HomeCatalogSections;
