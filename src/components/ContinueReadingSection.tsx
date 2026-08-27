import { ArrowRight, BookOpen, Clock3, History, LoaderCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import MangaCover from '@/components/MangaCover';
import { useAuth } from '@/hooks/useAuth';
import { useContinueReading } from '@/hooks/useReadingProgress';

const relativeDate = (value: string) => {
  const delta = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(delta / 60_000));
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return `Il y a ${days} j`;
};

const ContinueReadingSection = () => {
  const { user } = useAuth();
  const { data: items = [], isLoading } = useContinueReading();

  if (!user) return null;

  return (
    <section className="py-12 section-padding" aria-labelledby="continue-reading-title">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-7">
          <div>
            <p className="text-manga-cyan font-medium tracking-widest text-sm mb-2">VOTRE RYTHME</p>
            <h2 id="continue-reading-title" className="text-3xl md:text-4xl font-bold font-japanese"><span className="glow-text">Continuer</span> la lecture</h2>
            <p className="text-muted-foreground mt-2">Retrouvez instantanément le dernier chapitre ouvert pour chaque manga.</p>
          </div>
          <Button variant="outline" className="border-white/30 self-start md:self-auto" asChild>
            <Link to="/library">Voir ma bibliothèque <ArrowRight className="h-4 w-4 ml-2" /></Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 py-10 text-center" aria-busy="true"><LoaderCircle className="h-6 w-6 animate-spin text-manga-purple mx-auto mb-3" /><p className="text-sm text-muted-foreground">Chargement de votre historique…</p></div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-7 md:p-9 flex flex-col md:flex-row md:items-center gap-5">
            <div className="h-12 w-12 shrink-0 rounded-xl bg-manga-purple/15 text-manga-purple grid place-items-center"><History className="h-6 w-6" /></div>
            <div className="flex-1"><h3 className="font-semibold text-lg mb-1">Aucune lecture récente</h3><p className="text-muted-foreground">Ouvrez un chapitre depuis une fiche manga. Il sera sauvegardé ici pour que vous puissiez y revenir rapidement.</p></div>
            <Button className="btn-gradient shrink-0" asChild><Link to="/search">Explorer les mangas</Link></Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {items.map((item, index) => (
              <article key={item.mangaId} className="group rounded-2xl overflow-hidden border border-white/10 bg-card/60 hover:border-manga-purple/50 transition-colors animate-fade-in" style={{ animationDelay: `${index * 0.06}s` }}>
                <div className="flex gap-4 p-4">
                  <MangaCover src={item.coverImage} alt={`Couverture de ${item.mangaTitle}`} className="w-20 h-28 shrink-0 rounded-lg object-cover bg-white/5" />
                  <div className="min-w-0 flex flex-col flex-1">
                    {item.mangaDexId ? <Link to={`/manga/${item.mangaDexId}`} className="font-bold line-clamp-2 hover:text-manga-purple transition-colors">{item.mangaTitle}</Link> : <h3 className="font-bold line-clamp-2">{item.mangaTitle}</h3>}
                    <p className="text-sm text-muted-foreground truncate mt-1">{item.mangaAuthor || 'Auteur inconnu'}</p>
                    <p className="text-sm text-manga-cyan font-medium mt-3">{item.chapterLabel}{item.chapterTitle ? ` — ${item.chapterTitle}` : ''}</p>
                    <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> {relativeDate(item.readAt)}</p>
                    <Button size="sm" className="btn-gradient mt-auto self-start" asChild><a href={`https://mangadex.org/chapter/${item.chapterId}`} target="_blank" rel="noreferrer">Reprendre <BookOpen className="h-3.5 w-3.5 ml-2" /></a></Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default ContinueReadingSection;
