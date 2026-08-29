import { useCallback, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import UniversalReader from '@/components/UniversalReader';
import {
  useUniversalMangaChapters,
  useUniversalMangaDetail,
  type ChapterSourceAlternative,
} from '@/hooks/useMangaReader';
import type { SourceType } from '@/integrations/sources';
import { appendTriedSource, parseTriedSources } from '@/domain/automaticFallback';

const Reader = () => {
  const params = useParams<{ source: string; mangaId: string; chapterId: string }>();
  const source = params.source || 'mangadex';
  const mangaId = decodeURIComponent(params.mangaId || '');
  const chapterId = decodeURIComponent(params.chapterId || '');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const lang = searchParams.get('lang') || 'fr';
  const pageParam = Number.parseInt(searchParams.get('page') || '0', 10);
  const initialPage = Number.isNaN(pageParam) ? 0 : pageParam;
  const triedSources = useMemo(() => parseTriedSources(searchParams.get('tried')), [searchParams]);
  const autoFallbackApplied = searchParams.get('fallback') === '1';

  const { data: manga } = useUniversalMangaDetail(source as SourceType, mangaId);
  const { data: chapters = [] } = useUniversalMangaChapters(source as SourceType, mangaId, {
    language: lang,
    limit: 500,
  });

  const handleSelectChapter = (nextChapterId: string) => {
    navigate(
      `/read/${encodeURIComponent(source)}/${encodeURIComponent(mangaId)}/${encodeURIComponent(nextChapterId)}?lang=${encodeURIComponent(lang)}`,
    );
  };

  const handleBackToManga = () => {
    navigate(`/manga/${encodeURIComponent(mangaId)}?source=${encodeURIComponent(source)}`);
  };

  const handleAutomaticSourceFallback = useCallback((alternative: ChapterSourceAlternative, pageIndex: number) => {
    if (!alternative.chapter) return;
    const nextParams = new URLSearchParams({
      lang,
      page: String(pageIndex),
      tried: appendTriedSource(triedSources, source).join(','),
      fallback: '1',
    });
    navigate(
      `/read/${encodeURIComponent(alternative.source)}/${encodeURIComponent(alternative.mangaId)}/${encodeURIComponent(alternative.chapter.id)}?${nextParams}`,
      { replace: true },
    );
  }, [lang, navigate, source, triedSources]);

  return (
    <main className="h-[100dvh] overflow-hidden bg-[var(--mw-background)] text-[var(--mw-text-primary)]" aria-label="Lecteur Manga Wave">
      <UniversalReader
        source={source as SourceType}
        chapterId={chapterId}
        mangaId={mangaId}
        mangaTitle={manga?.title}
        mangaAuthor={manga?.author}
        coverImage={manga?.coverUrl}
        chapters={chapters}
        initialPage={initialPage}
        triedSources={triedSources}
        autoFallbackApplied={autoFallbackApplied}
        onAutomaticSourceFallback={handleAutomaticSourceFallback}
        onSelectChapter={handleSelectChapter}
        onClose={handleBackToManga}
      />
    </main>
  );
};

export default Reader;
