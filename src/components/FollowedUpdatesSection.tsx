import { ArrowRight, BookOpen, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import MangaCover from '@/components/MangaCover';
import { buildReaderLocation } from '@/domain/readerNavigation';
import { useFollowedChapterUpdates } from '@/hooks/useFollowedChapterUpdates';

const FollowedUpdatesSection = () => {
  const { data: updates = [], isLoading } = useFollowedChapterUpdates();
  if (isLoading) {
    return <section className="bg-[#08131d] py-12 text-center text-sm text-[var(--mw-text-secondary)]" aria-live="polite">Détection des nouveaux chapitres…</section>;
  }
  if (updates.length === 0) return null;
  const total = updates.reduce((count, update) => count + update.newChapterCount, 0);

  return (
    <section className="bg-[#08131d] py-12 section-padding" aria-labelledby="followed-updates-title">
      <div className="container mx-auto">
        <div className="mb-7 flex flex-col gap-3 border-b border-[var(--mw-border)] pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--mw-accent-coral)]"><Sparkles className="h-3.5 w-3.5" /> À lire maintenant</p>
            <h2 id="followed-updates-title" className="font-editorial text-3xl uppercase text-white md:text-4xl">Nouveaux chapitres</h2>
          </div>
          <p className="text-sm text-[var(--mw-text-secondary)]">{total} nouveau{total > 1 ? 'x' : ''} chapitre{total > 1 ? 's' : ''} dans vos favoris</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {updates.slice(0, 6).map(({ manga, latestChapter, newChapterCount }) => {
            const readerUrl = buildReaderLocation({
              source: latestChapter.provider,
              mangaId: latestChapter.providerMangaId,
              chapterId: latestChapter.providerChapterId,
              language: latestChapter.language,
              pageIndex: 0,
              mangaTitle: manga.title,
              mangaAuthor: manga.author,
            });
            return (
              <article key={manga.id} className="flex min-w-0 gap-4 border border-[var(--mw-border)] bg-[var(--mw-surface)] p-3">
                <Link to={`/manga/${manga.id}`} className="h-32 w-24 shrink-0 overflow-hidden" aria-label={`Voir ${manga.title}`}>
                  <MangaCover src={manga.cover_image} alt={`Couverture de ${manga.title}`} className="h-full w-full object-cover" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  <div>
                    <span className="inline-flex bg-[var(--mw-accent-coral)] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white">{newChapterCount} nouveau{newChapterCount > 1 ? 'x' : ''}</span>
                    <h3 className="mt-2 line-clamp-2 font-editorial text-lg uppercase text-white">{manga.title}</h3>
                    <p className="mt-1 text-xs text-[var(--mw-text-secondary)]">Chapitre {latestChapter.chapterNumber} · {latestChapter.language.toUpperCase()}</p>
                  </div>
                  <Link to={readerUrl} className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 bg-[var(--mw-accent-coral)] px-3 text-xs font-bold uppercase text-white hover:bg-[#ff6671]">
                    <BookOpen className="h-4 w-4" /> Lire maintenant <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FollowedUpdatesSection;
