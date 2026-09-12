import { Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import MangaCover from '@/components/MangaCover';
import { useCanonicalSearch } from '@/hooks/useCanonicalSearch';
import { findSimilarWorks } from '@/domain/recommendations';
import { discoveryStatusLabel, discoveryTypeBadgeClass } from '@/domain/discoveryPresentation';

export type SimilarWorksSectionProps = {
  canonicalMangaId: number | undefined;
  limit?: number;
};

/**
 * T-3024: content-based "similar works", grounded entirely in T-3020's
 * already-cached, already-audited canonical metadata (genres, author,
 * type) — no extra query beyond the same snapshot Search/Command Search/
 * Trending/Ranking already share, no per-provider call, no user data.
 * Renders nothing when the target isn't in the enriched catalog yet or
 * nothing genuinely overlaps — never a fabricated "you might also like".
 */
const SimilarWorksSection = ({ canonicalMangaId, limit = 6 }: SimilarWorksSectionProps) => {
  const { data: catalog } = useCanonicalSearch(Boolean(canonicalMangaId));
  const target = catalog?.find((work) => work.id === canonicalMangaId);
  const similar = target && catalog ? findSimilarWorks(target, catalog, limit) : [];

  if (!target || similar.length === 0) return null;

  const byId = new Map(catalog!.map((work) => [work.id, work]));

  return (
    <section aria-labelledby="similar-works-heading" className="mt-10">
      <h2 id="similar-works-heading" className="mb-5 flex items-center gap-2 text-xl font-bold font-outfit text-white">
        <Sparkles className="h-5 w-5 text-manga-cyan" aria-hidden="true" />
        Vous aimerez aussi
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {similar.map((result) => {
          const work = byId.get(result.canonicalMangaId);
          if (!work) return null;
          return (
            <Link
              key={work.id}
              to={`/manga/${work.id}`}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0f1520]/80 shadow-card transition-all duration-300 hover:border-manga-purple/40 hover:shadow-card-hover"
              aria-label={`Voir ${work.title}${result.sharedGenres.length ? `, genres communs : ${result.sharedGenres.join(', ')}` : ''}`}
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-black/40">
                <MangaCover
                  src={work.cover_image}
                  alt={`Couverture de ${work.title}`}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/10" />
                {work.manga_type && (
                  <span className={`absolute right-2 top-2 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${discoveryTypeBadgeClass(work.manga_type)}`}>
                    {work.manga_type}
                  </span>
                )}
              </div>
              <div className="p-3">
                <p className="line-clamp-2 min-h-10 font-outfit text-sm font-semibold text-white">{work.title}</p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="truncate text-[10px] font-medium text-white/50">
                    {result.sharedGenres[0] || (result.sameAuthor ? 'Même auteur' : '')}
                  </span>
                  {work.status && (
                    <span className="shrink-0 text-[10px] text-white/40">{discoveryStatusLabel(work.status)}</span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default SimilarWorksSection;
