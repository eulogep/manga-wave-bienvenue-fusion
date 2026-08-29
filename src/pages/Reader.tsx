import { useCallback, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import UniversalReader from '@/components/UniversalReader';
import {
  useUniversalMangaChapters,
  useUniversalMangaDetail,
  type ChapterSourceAlternative,
} from '@/hooks/useMangaReader';
import { getSource, type SourceType } from '@/integrations/sources';
import { appendTriedSource, buildFallbackNotice, parseTriedSources } from '@/domain/automaticFallback';
import { withReaderPage } from '@/domain/readerNavigation';

const Reader = () => {
  const params = useParams<{ source: string; mangaId: string; chapterId: string }>();
  const source = params.source || 'mangadex';
  const mangaId = decodeURIComponent(params.mangaId || '');
  const chapterId = decodeURIComponent(params.chapterId || '');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const lang = searchParams.get('lang') || 'fr';
  const pageParam = Number.parseInt(searchParams.get('page') || '0', 10);
  const initialPage = Number.isNaN(pageParam) ? 0 : pageParam;
  const triedSources = useMemo(() => parseTriedSources(searchParams.get('tried')), [searchParams]);
  const autoFallbackApplied = searchParams.get('fallback') === '1';
  const fallbackFromSource = searchParams.get('fallbackFrom');
  const fallbackFromLanguage = searchParams.get('fallbackFromLang');

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
    const actualLanguage = alternative.chapter.language || alternative.language || lang;
    const nextParams = new URLSearchParams({
      lang: actualLanguage,
      page: String(pageIndex),
      tried: appendTriedSource(triedSources, source).join(','),
      fallback: '1',
      fallbackFrom: source,
      fallbackFromLang: lang,
    });
    navigate(
      `/read/${encodeURIComponent(alternative.source)}/${encodeURIComponent(alternative.mangaId)}/${encodeURIComponent(alternative.chapter.id)}?${nextParams}`,
      { replace: true },
    );
  }, [lang, navigate, source, triedSources]);

  const handleManualSourceSelection = useCallback((alternative: ChapterSourceAlternative, pageIndex: number) => {
    if (!alternative.chapter) return;
    const nextParams = new URLSearchParams({
      lang: alternative.chapter.language || alternative.language || lang,
      page: String(pageIndex),
    });
    navigate(
      `/read/${encodeURIComponent(alternative.source)}/${encodeURIComponent(alternative.mangaId)}/${encodeURIComponent(alternative.chapter.id)}?${nextParams}`,
    );
  }, [lang, navigate]);

  const handlePageChange = useCallback((pageIndex: number) => {
    setSearchParams(withReaderPage(searchParams, pageIndex), { replace: true });
  }, [searchParams, setSearchParams]);

  const activeSourceName = getSource(source)?.displayName || source;
  const previousSourceName = fallbackFromSource
    ? getSource(fallbackFromSource)?.displayName || fallbackFromSource
    : null;
  const fallbackNotice = autoFallbackApplied && previousSourceName
    ? buildFallbackNotice({
        previousSource: previousSourceName,
        nextSource: activeSourceName,
        previousLanguage: fallbackFromLanguage || lang,
        nextLanguage: lang,
      })
    : null;

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
        language={lang}
        triedSources={triedSources}
        autoFallbackApplied={autoFallbackApplied}
        onAutomaticSourceFallback={handleAutomaticSourceFallback}
        onManualSourceSelection={handleManualSourceSelection}
        onPageChange={handlePageChange}
        fallbackNotice={fallbackNotice}
        onSelectChapter={handleSelectChapter}
        onClose={handleBackToManga}
      />
    </main>
  );
};

export default Reader;
