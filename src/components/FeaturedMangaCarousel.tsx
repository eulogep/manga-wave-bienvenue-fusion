import { useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import MangaCover from '@/components/MangaCover';
import { slideOffset, type FeaturedWork } from '@/domain/featuredManga';
import { discoveryStatusLabel } from '@/domain/discoveryPresentation';
import './FeaturedMangaCarousel.css';

type Props = { items: FeaturedWork[]; loading?: boolean; failed?: boolean; onRetry?: () => void };
export default function FeaturedMangaCarousel({ items, loading, failed, onRetry }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const lastSwipe = useRef(-Infinity);
  const activeIndex = Math.max(0, items.findIndex(({ work }) => work.id === selectedId));
  const active = items[activeIndex];
  const move = (step: number) => {
    if (items.length) setSelectedId(items[(activeIndex + step + items.length) % items.length].work.id);
  };
  return <section className="mw-spotlight" aria-labelledby="spotlight-heading" aria-roledescription="carrousel"
    onKeyDown={(event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); move(event.key === 'ArrowRight' ? 1 : -1);
      }
    }}>
    {active && <div className="mw-spotlight-backdrop" aria-hidden="true">
      <MangaCover key={active.work.id} src={active.work.cover_image} alt="" loading="eager" />
    </div>}
    <div className="mw-spotlight-inner">
      <header className="mw-spotlight-heading">
        <p className="mw-spotlight-eyebrow">À l’affiche</p>
        <h1 id="spotlight-heading">Une sélection<br /><span>qui mérite le détour.</span></h1>
        <p>Des mangas, manhwas et manhuas à découvrir,<br className="hidden sm:block" /> à lire et à retrouver.</p>
        <Link to="/search?browse=1&sort=recent" className="mw-spotlight-explore">Explorer le catalogue <ArrowRight size={16} /></Link>
      </header>
      {!active ? <div className="mw-spotlight-empty" role="status" aria-busy={loading}>
        <p>{loading ? 'Préparation de la sélection…' : failed ? 'La sélection est momentanément indisponible.' : 'De nouvelles découvertes arrivent bientôt.'}</p>
        {failed && <button onClick={onRetry}>Réessayer</button>}
      </div> : <>
        <div className="mw-spotlight-stage" data-testid="spotlight-stage"
          onTouchStart={(event) => { const touch = event.touches[0]; start.current = { x: touch.clientX, y: touch.clientY }; }}
          onTouchEnd={(event) => {
            if (!start.current) return;
            const touch = event.changedTouches[0];
            const dx = touch.clientX - start.current.x; const dy = touch.clientY - start.current.y;
            if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) { move(dx < 0 ? 1 : -1); lastSwipe.current = performance.now(); }
            start.current = null;
          }} onTouchCancel={() => { start.current = null; }}
          onClickCapture={(event) => { if (performance.now() - lastSwipe.current < 350) { event.preventDefault(); event.stopPropagation(); } }}>
          {items.map(({ work, badge }, index) => {
            const offset = slideOffset(index, activeIndex, items.length);
            if (Math.abs(offset) > 2) return null;
            const current = offset === 0;
            const style = { '--offset': offset, '--distance': Math.abs(offset), zIndex: 5 - Math.abs(offset) } as CSSProperties;
            return <div key={work.id} className="mw-spotlight-card" data-offset={offset} style={style}>
              <Link to={`/manga/${work.id}`} tabIndex={current ? 0 : -1}
                aria-label={`Voir la fiche de ${work.title}`} aria-current={current ? 'true' : undefined}
                onClick={(event) => { if (!current) { event.preventDefault(); setSelectedId(work.id); } }}>
                <MangaCover src={work.cover_image} alt={current ? `Couverture de ${work.title}` : ''} loading={Math.abs(offset) <= 1 ? 'eager' : 'lazy'} deferProxy className="mw-spotlight-cover" />
                {current ? <span className="mw-spotlight-badge">{badge}</span> : <span className="mw-spotlight-caption">{work.title}</span>}
              </Link>
            </div>;
          })}
          {items.length > 1 && <>
            <button className="mw-spotlight-arrow mw-spotlight-prev" aria-label="Œuvre précédente" onClick={() => move(-1)}><ChevronLeft /></button>
            <button className="mw-spotlight-arrow mw-spotlight-next" aria-label="Œuvre suivante" onClick={() => move(1)}><ChevronRight /></button>
          </>}
        </div>
        <div className="mw-spotlight-details">
          <div className="mw-spotlight-description" aria-live="polite" aria-atomic="true">
            <h2>{active.work.title}</h2>
            <p className="mw-spotlight-meta">{[active.work.manga_type, ...active.work.genre.slice(0, 2), discoveryStatusLabel(active.work.status)].filter(Boolean).join(' · ')}
              {active.work.rating !== null && active.work.rating > 0 && <span className="mw-spotlight-rating"><Star size={16} aria-hidden="true" /> <span aria-label={`Note : ${active.work.rating}`}>{active.work.rating.toFixed(1)}</span></span>}
            </p>
          </div>
          <div className="mw-spotlight-actions">
            <Link className="mw-spotlight-read" to={`/manga/${active.work.id}?read=1`}><BookOpen size={18} /> Lire maintenant</Link>
            <Link className="mw-spotlight-detail" to={`/manga/${active.work.id}`}>Voir la fiche</Link>
          </div>
          {items.length > 1 && <div className="mw-spotlight-dots" aria-label="Choisir une œuvre">
            {items.map(({ work }, index) => <button key={work.id} aria-label={`Afficher ${work.title}`} aria-current={index === activeIndex ? 'true' : undefined} onClick={() => setSelectedId(work.id)}><span /></button>)}
          </div>}
        </div>
      </>}
    </div>
  </section>;
}
