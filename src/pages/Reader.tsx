import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import UniversalReader from '@/components/UniversalReader';
import { useUniversalMangaChapters, useUniversalMangaDetail } from '@/hooks/useMangaReader';
import type { SourceType } from '@/integrations/sources';

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
        onSelectChapter={handleSelectChapter}
        onClose={handleBackToManga}
      />
    </main>
  );
};

export default Reader;
