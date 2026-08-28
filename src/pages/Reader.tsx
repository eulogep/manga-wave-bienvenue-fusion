import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import UniversalReader from '@/components/UniversalReader';
import { Button } from '@/components/ui/button';
import { useUniversalMangaChapters, useUniversalMangaDetail } from '@/hooks/useMangaReader';
import type { SourceType } from '@/integrations/sources';

const Reader = () => {
  const params = useParams<{
    source: string;
    mangaId: string;
    chapterId: string;
  }>();
  const source = params.source || 'mangadex';
  const mangaId = decodeURIComponent(params.mangaId || '');
  const chapterId = decodeURIComponent(params.chapterId || '');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const lang = searchParams.get('lang') || 'fr';
  const pageParam = parseInt(searchParams.get('page') || '0', 10);
  const initialPage = isNaN(pageParam) ? 0 : pageParam;

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
    <div className="min-h-screen flex flex-col bg-[#080c14] text-white">
      <Header />
      <main className="flex-1 section-padding py-6 md:py-10">
        <div className="container mx-auto max-w-5xl space-y-6">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="text-white/60 hover:text-white hover:bg-white/[0.06] rounded-full"
              onClick={handleBackToManga}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour à la fiche manga
            </Button>
          </div>

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
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Reader;
