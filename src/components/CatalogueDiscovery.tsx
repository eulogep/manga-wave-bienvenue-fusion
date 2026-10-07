import { Link } from 'react-router-dom';
import { ArrowRight, Compass, Sparkles } from 'lucide-react';
import MangaCover from '@/components/MangaCover';
import type { FeaturedWork } from '@/domain/featuredManga';
import { discoveryStatusLabel } from '@/domain/discoveryPresentation';

export function CatalogueHero({ featured }: { featured?: FeaturedWork }) {
  return <section className="catalogue-hero" aria-labelledby="catalogue-title">
    {featured && <div className="catalogue-hero-art" aria-hidden="true"><MangaCover src={featured.work.cover_image} alt="" loading="eager" /></div>}
    <div className="catalogue-width catalogue-hero-copy">
      <p className="catalogue-eyebrow">Un monde d’histoires vous attend</p>
      <h1 id="catalogue-title">Trouvez votre prochaine <em>obsession</em></h1>
      <p>Mangas, manhwas, manhuas… Explorez, vibrez, découvrez des univers uniques.</p>
    </div>
  </section>;
}

const moodNames: [string, string[]][] = [
  ['Action', ['Action']], ['Romance', ['Romance']], ['Fantastique', ['Fantasy', 'Fantastique']],
  ['Mystère', ['Mystery', 'Mystère']], ['Tranches de vie', ['Slice of Life', 'Tranche de vie']],
  ['Horreur', ['Horror', 'Horreur']],
];
export function MoodRail({ genres, selected, onChange }: { genres: string[]; selected: string; onChange: (genre: string) => void }) {
  const moods = moodNames.flatMap(([label, aliases]) => {
    const value = aliases.find(alias => genres.includes(alias));
    return value ? [{ label, value }] : [];
  });
  return <aside className="catalogue-moods" aria-label="Explorer par ambiance">
    <p className="catalogue-eyebrow">Explorer<br /> par ambiance</p>
    <div className="catalogue-mood-buttons">{moods.map(({ label, value }) => <button key={value} aria-pressed={selected === value}
      title={`Genre : ${value}`} onClick={() => onChange(selected === value ? '' : value)}>
      <Compass size={18} aria-hidden="true" /><span>{label}</span><ArrowRight size={14} aria-hidden="true" />
    </button>)}
    <button onClick={() => { onChange(''); document.getElementById('catalogue-genre')?.focus(); }}><span>Tous les genres</span><ArrowRight size={14} /></button></div>
    <p className="catalogue-mood-note">Chaque histoire<br /> commence par une envie.</p>
  </aside>;
}

export function CatalogueDiscovery({ items, loading }: { items: FeaturedWork[]; loading: boolean }) {
  if (loading) return <div className="catalogue-discovery catalogue-skeleton" aria-label="Chargement des découvertes" aria-busy="true"><div /><div /></div>;
  if (!items.length) return null;
  const featured = items[0].work;
  const remaining = items.slice(1);
  // Stable UTC-day rotation, with no fabricated popularity or personalised claims.
  const offset = remaining.length ? Math.floor(Date.now() / 86_400_000) % remaining.length : 0;
  const daily = [...remaining.slice(offset), ...remaining.slice(0, offset)].slice(0, 3);
  return <div className={`catalogue-discovery ${daily.length ? '' : 'catalogue-discovery-single'}`}>
    <section className="catalogue-featured" aria-label="Série à l’honneur">
      <div className="catalogue-featured-art" aria-hidden="true"><MangaCover src={featured.cover_image} alt="" loading="eager" /></div>
      <div className="catalogue-featured-copy">
        <span className="catalogue-honour"><Sparkles size={14} /> Série à l’honneur</span>
        <p className="catalogue-tags">{[featured.manga_type, ...(featured.genre || []).slice(0, 2)].filter(Boolean).map(tag => <span key={tag}>{tag}</span>)}</p>
        <p className="catalogue-featured-title">{featured.title}</p>
        <p className="catalogue-featured-status">{discoveryStatusLabel(featured.status)}{featured.author ? ` · ${featured.author}` : ''}</p>
        <Link className="catalogue-primary" to={`/manga/${featured.id}`}>Découvrir la série <ArrowRight size={18} /></Link>
      </div>
    </section>
    {daily.length > 0 && <section className="catalogue-daily" aria-labelledby="daily-selection-title">
      <h2 id="daily-selection-title"><Sparkles size={18} /> Sélection du jour</h2>
      {daily.map(({ work }) => <Link key={work.id} to={`/manga/${work.id}`} className="catalogue-daily-row" aria-label={`Sélection du jour : ${work.title}`}>
        <MangaCover src={work.cover_image} alt="" deferProxy />
        <div><p className="catalogue-daily-title">{work.title}</p><p>{[work.manga_type, work.genre?.[0]].filter(Boolean).join(' · ')}</p><span>{discoveryStatusLabel(work.status)}</span></div>
      </Link>)}
    </section>}
  </div>;
}
