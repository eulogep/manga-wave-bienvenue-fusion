import { useState } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Languages,
  LoaderCircle,
  Users,
  Play,
  Shuffle,
} from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MangaCover from '@/components/MangaCover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMangaDexChapters, useMangaDexDetail } from '@/hooks/useMangaDex';
import { useOriginMangaDetail } from '@/hooks/useOriginManga';
import {
  useChapterSourceAlternatives,
  useUniversalMangaDetail,
  useUniversalMangaChapters,
} from '@/hooks/useMangaReader';
import type { MangaDexChapter } from '@/integrations/mangadex/client';
import type { OriginMangaChapter } from '@/integrations/originmanga/client';
import type { SourceChapter, SourceType } from '@/integrations/sources';

const languageOptions = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'es-la', label: 'Español (Latinoamérica)' },
];

const statusLabels: Record<string, string> = {
  ongoing: 'En cours',
  completed: 'Terminé',
  hiatus: 'En pause',
  cancelled: 'Annulé',
  unknown: 'Inconnu',
};

const MangaDetail = () => {
  const { id = '' } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const source = (searchParams.get('source') || 'mangadex') as SourceType;

  const [language, setLanguage] = useState('fr');
  const [chapterOffset, setChapterOffset] = useState(0);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  // MangaDex Queries
  const isMangaDex = source === 'mangadex';
  const {
    data: mangaDexData,
    isLoading: isMangaDexLoading,
    isError: isMangaDexError,
    error: mangaDexError,
    refetch: refetchMangaDex,
  } = useMangaDexDetail(isMangaDex ? id : undefined);

  const {
    data: mangaDexChaptersData,
    isLoading: isMangaDexChaptersLoading,
    isError: isMangaDexChaptersError,
    error: mangaDexChaptersError,
    refetch: refetchMangaDexChapters,
  } = useMangaDexChapters(isMangaDex ? id : undefined, {
    translatedLanguage: language,
    offset: chapterOffset,
    limit: 100,
  });

  // OriginManga Queries
  const isOriginManga = source === 'originmanga';
  const {
    data: originMangaData,
    isLoading: isOriginLoading,
    isError: isOriginError,
    error: originError,
    refetch: refetchOrigin,
  } = useOriginMangaDetail(isOriginManga ? id : undefined);

  // Universal Source Queries (Comick, CrunchyScan, etc.)
  const isUniversal = !isMangaDex && !isOriginManga;
  const {
    data: universalData,
    isLoading: isUniversalLoading,
    isError: isUniversalError,
    error: universalError,
    refetch: refetchUniversal,
  } = useUniversalMangaDetail(isUniversal ? source : '', isUniversal ? id : undefined);

  const {
    data: universalChaptersData,
    isLoading: isUniversalChaptersLoading,
    refetch: refetchUniversalChapters,
  } = useUniversalMangaChapters(isUniversal ? source : '', isUniversal ? id : undefined);

  // Normalized manga object
  const manga = isOriginManga
    ? originMangaData
      ? {
          id: originMangaData.id,
          title: originMangaData.title,
          description: originMangaData.synopsis || '',
          coverImageUrl: originMangaData.coverUrl,
          author: originMangaData.author || 'Auteur non renseigné',
          artist: originMangaData.artist,
          status: originMangaData.status.toLowerCase() || 'ongoing',
          genres: originMangaData.genres,
          themes: [] as string[],
          year: null,
          contentRating: null,
          lastChapter: originMangaData.chapters[0]?.chapterNumber || null,
          updatedAt: null,
          externalUrl: `https://www.originmanga.com/manga.php?id=${id}`,
          sourceName: 'OriginManga (FR)',
        }
      : null
    : isUniversal
    ? universalData
      ? {
          id: universalData.id,
          title: universalData.title,
          description: universalData.synopsis || '',
          coverImageUrl: universalData.coverUrl,
          author: universalData.author || 'Auteur non renseigné',
          artist: universalData.artist,
          status: universalData.status.toLowerCase() || 'ongoing',
          genres: universalData.genres,
          themes: [] as string[],
          year: universalData.year || null,
          contentRating: null,
          lastChapter: universalData.lastChapter || null,
          updatedAt: null,
          externalUrl: universalData.externalUrl || undefined,
          sourceName: source.toUpperCase(),
        }
      : null
    : mangaDexData
    ? {
        ...mangaDexData,
        sourceName: 'MangaDex',
      }
    : null;

  const isLoading = isOriginManga ? isOriginLoading : isUniversal ? isUniversalLoading : isMangaDexLoading;
  const isError = isOriginManga ? isOriginError : isUniversal ? isUniversalError : isMangaDexError;
  const error = isOriginManga ? originError : isUniversal ? (universalError as Error) : mangaDexError;

  const retry = () => {
    if (isOriginManga) {
      void refetchOrigin();
    } else if (isUniversal) {
      void refetchUniversal();
      void refetchUniversalChapters();
    } else {
      void refetchMangaDex();
      void refetchMangaDexChapters();
    }
  };

  const handleStartReadingChapter = (chapter: { id: string; language?: string }) => {
    const readerLanguage = chapter.language || (isOriginManga ? 'fr' : language);
    navigate(
      `/read/${encodeURIComponent(source)}/${encodeURIComponent(id)}/${encodeURIComponent(chapter.id)}?lang=${encodeURIComponent(readerLanguage)}&page=0`,
    );
  };

  // Convert OriginManga chapters to universal list if needed
  const originChaptersList: SourceChapter[] = (originMangaData?.chapters || []).map((ch: OriginMangaChapter) => ({
    id: ch.id,
    source: 'originmanga' as const,
    mangaId: id,
    chapterNumber: ch.chapterNumber,
    title: ch.title,
    date: ch.date,
    externalUrl: ch.url,
    language: 'fr',
  }));

  const universalChaptersList: SourceChapter[] = universalChaptersData || [];

  const mangaDexChaptersList: SourceChapter[] = (mangaDexChaptersData?.chapters || []).map((ch: MangaDexChapter) => ({
    id: ch.id,
    source: 'mangadex' as const,
    mangaId: id,
    chapterNumber: ch.chapter || '',
    volume: ch.volume,
    title: ch.title,
    date: ch.readableAt,
    scanlationGroup: ch.scanlationGroups.join(', ') || null,
    scanlationGroups: ch.scanlationGroups,
    pageCount: ch.pageCount,
    language: ch.translatedLanguage,
    externalUrl: ch.externalUrl || ch.mangaDexUrl,
  }));

  const readableChapters = isOriginManga
    ? originChaptersList
    : isUniversal
      ? universalChaptersList
      : mangaDexChaptersList;
  const firstReadableChapter = readableChapters[readableChapters.length - 1] || readableChapters[0];
  const sourceOptionsQuery = useChapterSourceAlternatives(
    manga?.title,
    firstReadableChapter?.chapterNumber || manga?.lastChapter || undefined,
    source,
    language,
    sourcesOpen && Boolean(manga?.title),
  );

  if (isLoading) {
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

  if (isError || !manga) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 section-padding py-12">
          <div className="container mx-auto max-w-2xl rounded-2xl border border-destructive/40 bg-destructive/10 p-8 text-center">
            <h1 className="text-2xl font-bold mb-3">Fiche manga indisponible</h1>
            <p className="text-muted-foreground mb-6">{error?.message || 'Ce titre ne peut pas être chargé.'}</p>
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

  const formattedUpdatedAt = manga.updatedAt
    ? new Intl.DateTimeFormat('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(manga.updatedAt))
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--mw-background)]">
      <Header />
      <main className="flex-1 section-padding py-10 md:py-14">
        <div className="container mx-auto space-y-10">
          <Link
            to="/search"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à la recherche
          </Link>

          {/* MANGA OVERVIEW SECTION */}
          <section className="grid grid-cols-1 gap-8 border-b border-[var(--mw-border)] pb-12 md:grid-cols-[260px_1fr] lg:grid-cols-[300px_1fr] lg:gap-12">
            <div className="mx-auto md:mx-0 w-full max-w-[300px]">
              <MangaCover
                src={manga.coverImageUrl}
                alt={`Couverture de ${manga.title}`}
                className="aspect-[3/4] w-full border border-[var(--mw-border)] object-cover shadow-2xl"
              />
            </div>

            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge className="bg-manga-purple/30 text-white border-manga-purple/40">
                  {manga.sourceName}
                </Badge>
                <Badge variant="secondary" className="bg-white/10 text-white border-0">
                  {statusLabels[manga.status] || manga.status}
                </Badge>
                {manga.contentRating && (
                  <Badge variant="secondary" className="bg-white/10 text-white border-0">
                    {manga.contentRating}
                  </Badge>
                )}
              </div>

              <h1 className="mb-4 font-editorial text-4xl font-semibold uppercase leading-tight md:text-5xl">{manga.title}</h1>
              <p className="text-lg text-muted-foreground mb-6">
                Par <span className="text-white font-medium">{manga.author}</span>
                {manga.artist && manga.artist !== manga.author && (
                  <> · Illustrations : <span className="text-white font-medium">{manga.artist}</span></>
                )}
              </p>

              <div className="flex flex-wrap gap-2 mb-7">
                {manga.genres.map((genre) => (
                  <Badge key={genre} variant="secondary" className="bg-white/10 text-white/90 border-0">
                    {genre}
                  </Badge>
                ))}
                {manga.themes?.map((theme) => (
                  <Badge key={theme} variant="outline" className="border-manga-cyan/50 text-manga-cyan">
                    {theme}
                  </Badge>
                ))}
              </div>

              <p className="text-muted-foreground leading-7 whitespace-pre-line max-w-4xl mb-8">
                {manga.description || 'Aucun synopsis disponible pour ce titre.'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="border border-[var(--mw-border)] bg-[var(--mw-surface)] p-4">
                  <CalendarDays className="h-5 w-5 text-manga-pink mb-2" />
                  <p className="text-xs text-muted-foreground">Année</p>
                  <p className="font-semibold">{manga.year || 'Non renseignée'}</p>
                </div>
                <div className="border border-[var(--mw-border)] bg-[var(--mw-surface)] p-4">
                  <BookOpen className="h-5 w-5 text-manga-cyan mb-2" />
                  <p className="text-xs text-muted-foreground">Dernier chapitre</p>
                  <p className="font-semibold">
                    {manga.lastChapter ? `Chapitre ${manga.lastChapter}` : 'Non renseigné'}
                  </p>
                </div>
                {formattedUpdatedAt && (
                  <div className="border border-[var(--mw-border)] bg-[var(--mw-surface)] p-4">
                    <CalendarDays className="h-5 w-5 text-manga-gold mb-2" />
                    <p className="text-xs text-muted-foreground">Mis à jour</p>
                    <p className="font-semibold text-sm">{formattedUpdatedAt}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                {/* First chapter fast start button */}
                {firstReadableChapter ? (
                  <Button
                    className="btn-gradient"
                    onClick={() => {
                      handleStartReadingChapter({
                        id: firstReadableChapter.id,
                        language: firstReadableChapter.language,
                      });
                    }}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Commencer la lecture
                  </Button>
                ) : null}

                {manga.externalUrl && (
                  <Button variant="outline" className="border-white/20" asChild>
                    <a href={manga.externalUrl} target="_blank" rel="noreferrer">
                      Voir la source officielle
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                )}

                <Button variant="outline" className="border-white/20" onClick={() => setSourcesOpen((open) => !open)}>
                  <Shuffle className="mr-2 h-4 w-4" />
                  Changer de source
                </Button>
              </div>

              {sourcesOpen && (
                <div className="mt-4 max-w-2xl border border-[var(--mw-border)] bg-[var(--mw-surface)] p-3" aria-live="polite">
                  <div className="mb-2 flex min-h-14 items-center justify-between gap-3 border border-emerald-400/25 bg-emerald-500/10 px-3 py-2">
                    <span>
                      <span className="block text-sm font-semibold">{manga.sourceName}</span>
                      <span className="block text-[11px] text-white/50">Source actuellement affichée</span>
                    </span>
                    <span className="text-[10px] font-bold uppercase text-emerald-300">Active</span>
                  </div>

                  {sourceOptionsQuery.isLoading && (
                    <p className="flex items-center gap-2 px-2 py-4 text-xs text-white/55">
                      <LoaderCircle className="h-4 w-4 animate-spin" /> Recherche des sources disponibles…
                    </p>
                  )}

                  <div className="space-y-2">
                    {(sourceOptionsQuery.data || []).map((alternative) => (
                      <Link
                        key={`${alternative.source}-${alternative.mangaId}`}
                        to={`/manga/${encodeURIComponent(alternative.mangaId)}?source=${encodeURIComponent(alternative.source)}`}
                        className="flex min-h-14 items-center justify-between gap-3 border border-[var(--mw-border)] bg-black/10 px-3 py-2 transition-colors hover:border-white/30"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{alternative.sourceName}</span>
                          <span className="block text-[11px] text-white/50">
                            {alternative.language.toUpperCase()} · {alternative.available ? 'Chapitre disponible' : 'Autres chapitres à consulter'}
                          </span>
                          <span className="block text-[10px] text-white/35">
                            Dernier succès : {alternative.lastSuccessfulRequest
                              ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(alternative.lastSuccessfulRequest))
                              : 'pas encore mesuré'}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-[var(--mw-accent-blue)]">{Math.round(alternative.sourceScore)}/100</span>
                      </Link>
                    ))}
                  </div>

                  {!sourceOptionsQuery.isLoading && sourceOptionsQuery.data?.length === 0 && (
                    <p className="px-2 py-4 text-xs text-white/50">Aucune autre source correspondante n’a été trouvée.</p>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* CHAPTERS LIST SECTION */}
          <section className="pt-10 border-t border-white/10">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-7">
              <div>
                <p className="text-manga-cyan font-medium mb-2">LECTURE EN LIGNE</p>
                <h2 className="font-editorial text-3xl uppercase">Chapitres disponibles</h2>
                <p className="text-muted-foreground mt-2">
                  {isOriginManga
                    ? 'Chapitres extraits directement depuis OriginManga.'
                    : 'Les groupes de scanlation sont crédités pour chaque chapitre.'}
                </p>
              </div>

              {isMangaDex && (
                <div className="w-full md:w-64 space-y-2">
                  <label
                    htmlFor="chapter-language"
                    className="text-sm text-muted-foreground inline-flex items-center gap-2"
                  >
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
                        <SelectItem key={option.code} value={option.code}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* ORIGIN MANGA CHAPTERS LIST */}
            {isOriginManga && (
              <div>
                {originChaptersList.length > 0 ? (
                  <div className="divide-y divide-[var(--mw-border)] overflow-hidden border border-[var(--mw-border)] bg-[var(--mw-surface)]">
                    {originChaptersList.map((chapter) => {
                      return (
                        <article
                          key={chapter.id}
                          className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-4 transition-colors hover:bg-white/5"
                        >
                          <FileText className="h-5 w-5 text-manga-purple shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate">
                              Chapitre {chapter.chapterNumber}
                              {chapter.title ? ` — ${chapter.title}` : ''}
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                              {chapter.date && <span>{chapter.date}</span>}
                              <Badge variant="outline" className="text-[10px] border-white/20">
                                Scan FR
                              </Badge>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              className="border-white/30"
                              variant="outline"
                              onClick={() =>
                                handleStartReadingChapter({
                                  id: chapter.id,
                                  language: 'fr',
                                })
                              }
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Lire le chapitre
                            </Button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 py-14 px-6 text-center">
                    <BookOpen className="h-10 w-10 text-manga-purple mx-auto mb-4" />
                    <h3 className="text-xl font-bold mb-2">Aucun chapitre disponible</h3>
                    <p className="text-muted-foreground">Aucun chapitre n&apos;a été trouvé sur OriginManga pour ce titre.</p>
                  </div>
                )}
              </div>
            )}

            {/* UNIVERSAL SOURCES CHAPTERS LIST (COMICK, CRUNCHYSCAN, ETC.) */}
            {isUniversal && (
              <div>
                {isUniversalChaptersLoading ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 py-14 text-center" aria-busy="true">
                    <LoaderCircle className="h-8 w-8 animate-spin text-manga-purple mx-auto mb-4" />
                    <p className="text-muted-foreground">Chargement des chapitres…</p>
                  </div>
                ) : universalChaptersList.length > 0 ? (
                  <div className="divide-y divide-[var(--mw-border)] overflow-hidden border border-[var(--mw-border)] bg-[var(--mw-surface)]">
                    {universalChaptersList.map((chapter) => {
                      return (
                        <article
                          key={chapter.id}
                          className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-4 transition-colors hover:bg-white/5"
                        >
                          <FileText className="h-5 w-5 text-manga-purple shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate">
                              Chapitre {chapter.chapterNumber}
                              {chapter.title ? ` — ${chapter.title}` : ''}
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                              {chapter.date && <span>{chapter.date}</span>}
                              {chapter.scanlationGroup && (
                                <span className="text-white/70">Par {chapter.scanlationGroup}</span>
                              )}
                              <Badge variant="outline" className="text-[10px] border-white/20">
                                {chapter.language ? chapter.language.toUpperCase() : 'SCAN'}
                              </Badge>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              className="border-white/30"
                              variant="outline"
                              onClick={() =>
                                handleStartReadingChapter({
                                  id: chapter.id,
                                  language: chapter.language,
                                  })
                              }
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Lire le chapitre
                            </Button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 py-14 px-6 text-center">
                    <BookOpen className="h-10 w-10 text-manga-purple mx-auto mb-4" />
                    <h3 className="text-xl font-bold mb-2">Aucun chapitre disponible</h3>
                    <p className="text-muted-foreground">Aucun chapitre n&apos;a été trouvé sur {source.toUpperCase()} pour ce titre.</p>
                  </div>
                )}
              </div>
            )}

            {/* MANGADEX CHAPTERS LIST */}
            {isMangaDex && (
              <>
                {isMangaDexChaptersLoading && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 py-14 text-center" aria-busy="true">
                    <LoaderCircle className="h-8 w-8 animate-spin text-manga-purple mx-auto mb-4" />
                    <p className="text-muted-foreground">Chargement des chapitres…</p>
                  </div>
                )}

                {isMangaDexChaptersError && (
                  <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-8 text-center">
                    <h3 className="text-xl font-bold mb-2">Liste des chapitres indisponible</h3>
                    <p className="text-muted-foreground mb-5">{mangaDexChaptersError.message}</p>
                    <Button className="btn-gradient" onClick={() => refetchMangaDexChapters()}>
                      Réessayer
                    </Button>
                  </div>
                )}

                {!isMangaDexChaptersLoading && !isMangaDexChaptersError && mangaDexChaptersData && (
                  <>
                    <p className="text-sm text-muted-foreground mb-4">
                      Chapitres {mangaDexChaptersData.total === 0 ? 0 : chapterOffset + 1} à{' '}
                      {Math.min(chapterOffset + mangaDexChaptersData.chapters.length, mangaDexChaptersData.total)} sur{' '}
                      {mangaDexChaptersData.total.toLocaleString('fr-FR')} dans cette langue.
                    </p>
                    {mangaDexChaptersData.chapters.length > 0 ? (
                      <div className="divide-y divide-[var(--mw-border)] overflow-hidden border border-[var(--mw-border)] bg-[var(--mw-surface)]">
                        {mangaDexChaptersData.chapters.map((chapter) => {
                          return (
                            <article
                              key={chapter.id}
                              className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-4 transition-colors hover:bg-white/5"
                            >
                              <FileText className="h-5 w-5 text-manga-purple shrink-0" />
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold truncate">
                                  {chapter.volume ? `Tome ${chapter.volume} · ` : ''}Chapitre {chapter.chapter || 'spécial'}
                                  {chapter.title ? ` — ${chapter.title}` : ''}
                                </h3>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                                  <span>
                                    {new Intl.DateTimeFormat('fr-FR', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                    }).format(new Date(chapter.readableAt))}
                                  </span>
                                  <span>
                                    {chapter.pageCount} page{chapter.pageCount > 1 ? 's' : ''}
                                  </span>
                                  {chapter.scanlationGroups.length > 0 && (
                                    <span className="inline-flex items-center gap-1">
                                      <Users className="h-3.5 w-3.5" /> {chapter.scanlationGroups.join(', ')}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <Button
                                  className="border-white/30"
                                  variant="outline"
                                  onClick={() =>
                                    handleStartReadingChapter({
                                      id: chapter.id,
                                      language: chapter.translatedLanguage,
                                    })
                                  }
                                >
                                  <Play className="h-4 w-4 mr-2" />
                                  Lire le chapitre
                                </Button>

                                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white" asChild>
                                  <a
                                    href={chapter.externalUrl || chapter.mangaDexUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Ouvrir sur MangaDex"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </Button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 py-14 px-6 text-center">
                        <BookOpen className="h-10 w-10 text-manga-purple mx-auto mb-4" />
                        <h3 className="text-xl font-bold mb-2">Aucun chapitre dans cette langue</h3>
                        <p className="text-muted-foreground">Essayez une autre langue dans le sélecteur ci-dessus.</p>
                      </div>
                    )}

                    {mangaDexChaptersData.total > 100 && (
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
                          disabled={chapterOffset + 100 >= mangaDexChaptersData.total}
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
              </>
            )}
          </section>

          <p className="text-xs text-muted-foreground text-center mt-12">
            Métadonnées, chapitres et scans fournis par {manga.sourceName}.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default MangaDetail;
