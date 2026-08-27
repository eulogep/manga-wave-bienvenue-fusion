import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, CalendarDays, ChevronLeft, ChevronRight, ExternalLink, FileText, Languages, LoaderCircle, Users } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MangaCover from '@/components/MangaCover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMangaDexChapters, useMangaDexDetail } from '@/hooks/useMangaDex';

const languageOptions = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'es-la', label: 'Español (Latinoamérica)' },
];

const statusLabels = {
  ongoing: 'En cours',
  completed: 'Terminé',
  hiatus: 'En pause',
  cancelled: 'Annulé',
};

const MangaDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [language, setLanguage] = useState('fr');
  const [chapterOffset, setChapterOffset] = useState(0);
  const { data: manga, isLoading: isMangaLoading, isError: isMangaError, error: mangaError, refetch: refetchManga } = useMangaDexDetail(id);
  const { data: chapterData, isLoading: isChaptersLoading, isError: isChaptersError, error: chaptersError, refetch: refetchChapters } = useMangaDexChapters(id, {
    translatedLanguage: language,
    offset: chapterOffset,
    limit: 100,
  });

  const retry = () => {
    void refetchManga();
    void refetchChapters();
  };

  if (isMangaLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 section-padding py-12" aria-busy="true">
          <div className="container mx-auto animate-pulse space-y-6">
            <div className="h-5 bg-white/10 rounded w-40" />
            <div className="grid md:grid-cols-[260px_1fr] gap-10">
              <div className="aspect-[3/4] bg-white/10 rounded-2xl" />
              <div className="space-y-5">
                <div className="h-12 bg-white/10 rounded w-3/4" />
                <div className="h-5 bg-white/10 rounded w-1/3" />
                <div className="h-28 bg-white/10 rounded" />
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (isMangaError || !manga) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 section-padding py-12">
          <div className="container mx-auto max-w-2xl rounded-2xl border border-destructive/40 bg-destructive/10 p-8 text-center">
            <h1 className="text-2xl font-bold mb-3">Fiche manga indisponible</h1>
            <p className="text-muted-foreground mb-6">{mangaError?.message || 'Ce titre ne peut pas être chargé.'}</p>
            <div className="flex justify-center gap-4">
              <Button className="btn-gradient" onClick={retry}>Réessayer</Button>
              <Button variant="outline" className="border-white/30" asChild>
                <Link to="/search">Revenir à la recherche</Link>
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const formattedUpdatedAt = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(manga.updatedAt));

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 section-padding py-10 md:py-14">
        <div className="container mx-auto">
          <Link to="/search" className="inline-flex items-center text-sm text-muted-foreground hover:text-white transition-colors mb-8">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à la recherche
          </Link>

          <section className="grid grid-cols-1 md:grid-cols-[260px_1fr] lg:grid-cols-[300px_1fr] gap-8 lg:gap-12">
            <div className="mx-auto md:mx-0 w-full max-w-[300px]">
              <MangaCover
                src={manga.coverImageUrl}
                alt={`Couverture de ${manga.title}`}
                className="w-full aspect-[3/4] object-cover rounded-2xl border border-white/10 shadow-2xl shadow-manga-purple/10"
              />
            </div>

            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge className="bg-manga-purple/30 text-white border-manga-purple/40">MangaDex</Badge>
                <Badge variant="secondary" className="bg-white/10 text-white border-0">{statusLabels[manga.status]}</Badge>
                {manga.contentRating && <Badge variant="secondary" className="bg-white/10 text-white border-0">{manga.contentRating}</Badge>}
              </div>

              <h1 className="text-4xl md:text-5xl font-bold font-japanese leading-tight mb-4">{manga.title}</h1>
              <p className="text-lg text-muted-foreground mb-6">
                Par <span className="text-white font-medium">{manga.author}</span>
                {manga.artist && manga.artist !== manga.author && <> · Illustrations : <span className="text-white font-medium">{manga.artist}</span></>}
              </p>

              <div className="flex flex-wrap gap-2 mb-7">
                {manga.genres.map((genre) => (
                  <Badge key={genre} variant="secondary" className="bg-white/10 text-white/90 border-0">{genre}</Badge>
                ))}
                {manga.themes.map((theme) => (
                  <Badge key={theme} variant="outline" className="border-manga-cyan/50 text-manga-cyan">{theme}</Badge>
                ))}
              </div>

              <p className="text-muted-foreground leading-7 whitespace-pre-line max-w-4xl mb-8">
                {manga.description || 'Aucun synopsis n’est disponible dans la langue sélectionnée.'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <CalendarDays className="h-5 w-5 text-manga-pink mb-2" />
                  <p className="text-xs text-muted-foreground">Année</p>
                  <p className="font-semibold">{manga.year || 'Non renseignée'}</p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <BookOpen className="h-5 w-5 text-manga-cyan mb-2" />
                  <p className="text-xs text-muted-foreground">Dernier chapitre</p>
                  <p className="font-semibold">{manga.lastChapter ? `Chapitre ${manga.lastChapter}` : 'Non renseigné'}</p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <CalendarDays className="h-5 w-5 text-manga-gold mb-2" />
                  <p className="text-xs text-muted-foreground">Mis à jour</p>
                  <p className="font-semibold text-sm">{formattedUpdatedAt}</p>
                </div>
              </div>

              <Button className="btn-gradient" asChild>
                <a href={manga.externalUrl} target="_blank" rel="noreferrer">
                  Voir la fiche sur MangaDex
                  <ExternalLink className="h-4 w-4 ml-2" />
                </a>
              </Button>
            </div>
          </section>

          <section className="mt-16 pt-10 border-t border-white/10">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-7">
              <div>
                <p className="text-manga-cyan font-medium mb-2">LECTURE</p>
                <h2 className="text-3xl font-bold font-japanese">Chapitres disponibles</h2>
                <p className="text-muted-foreground mt-2">Les groupes de scanlation sont crédités pour chaque chapitre.</p>
              </div>
              <div className="w-full md:w-64 space-y-2">
                <label htmlFor="chapter-language" className="text-sm text-muted-foreground inline-flex items-center gap-2">
                  <Languages className="h-4 w-4" /> Langue de lecture
                </label>
                <Select
                  value={language}
                  onValueChange={(nextLanguage) => {
                    setLanguage(nextLanguage);
                    setChapterOffset(0);
                  }}
                >
                  <SelectTrigger id="chapter-language" className="bg-white/10 border-white/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-manga-dark border-white/20">
                    {languageOptions.map((option) => (
                      <SelectItem key={option.code} value={option.code}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isChaptersLoading && (
              <div className="rounded-2xl border border-white/10 bg-white/5 py-14 text-center" aria-busy="true">
                <LoaderCircle className="h-8 w-8 animate-spin text-manga-purple mx-auto mb-4" />
                <p className="text-muted-foreground">Chargement des chapitres…</p>
              </div>
            )}

            {isChaptersError && (
              <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-8 text-center">
                <h3 className="text-xl font-bold mb-2">Liste des chapitres indisponible</h3>
                <p className="text-muted-foreground mb-5">{chaptersError.message}</p>
                <Button className="btn-gradient" onClick={() => refetchChapters()}>Réessayer</Button>
              </div>
            )}

            {!isChaptersLoading && !isChaptersError && chapterData && (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  Chapitres {chapterData.total === 0 ? 0 : chapterOffset + 1} à {Math.min(chapterOffset + chapterData.chapters.length, chapterData.total)} sur {chapterData.total.toLocaleString('fr-FR')} dans cette langue.
                </p>
                {chapterData.chapters.length > 0 ? (
                  <div className="divide-y divide-white/10 rounded-2xl overflow-hidden border border-white/10 bg-card/50">
                    {chapterData.chapters.map((chapter) => (
                      <article key={chapter.id} className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-white/5 transition-colors">
                        <FileText className="h-5 w-5 text-manga-purple shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">
                            {chapter.volume ? `Tome ${chapter.volume} · ` : ''}Chapitre {chapter.chapter || 'spécial'}
                            {chapter.title ? ` — ${chapter.title}` : ''}
                          </h3>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                            <span>{new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(chapter.readableAt))}</span>
                            <span>{chapter.pageCount} page{chapter.pageCount > 1 ? 's' : ''}</span>
                            {chapter.scanlationGroups.length > 0 && (
                              <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {chapter.scanlationGroups.join(', ')}</span>
                            )}
                          </div>
                        </div>
                        <Button variant="outline" className="border-white/30 shrink-0" asChild>
                          <a href={chapter.externalUrl || chapter.mangaDexUrl} target="_blank" rel="noreferrer">
                            Lire sur MangaDex <ExternalLink className="h-4 w-4 ml-2" />
                          </a>
                        </Button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 py-14 px-6 text-center">
                    <BookOpen className="h-10 w-10 text-manga-purple mx-auto mb-4" />
                    <h3 className="text-xl font-bold mb-2">Aucun chapitre dans cette langue</h3>
                    <p className="text-muted-foreground">Essayez une autre langue dans le sélecteur ci-dessus.</p>
                  </div>
                )}

                {chapterData.total > 100 && (
                  <div className="flex items-center justify-center gap-4 mt-8">
                    <Button
                      variant="outline"
                      className="border-white/30"
                      disabled={chapterOffset === 0}
                      onClick={() => {
                        setChapterOffset((offset) => Math.max(0, offset - 100));
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Chapitres précédents
                    </Button>
                    <Button
                      variant="outline"
                      className="border-white/30"
                      disabled={chapterOffset + 100 >= chapterData.total}
                      onClick={() => {
                        setChapterOffset((offset) => offset + 100);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      Chapitres suivants
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </section>

          <p className="text-xs text-muted-foreground text-center mt-12">
            Métadonnées, chapitres et crédits de scanlation fournis par MangaDex.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default MangaDetail;
