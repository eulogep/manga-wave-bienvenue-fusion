import { Lock, Star } from 'lucide-react';
import MangaCover from '@/components/MangaCover';
import AdultGatedLink from '@/components/AdultGatedLink';
import type { SearchWork } from '@/domain/canonicalSearch';
import { discoveryStatusLabel } from '@/domain/discoveryPresentation';

export default function EditorialMangaCard({ work, gated, priority }: { work: SearchWork; gated: boolean; priority: boolean }) {
  return <article data-type={work.manga_type} className="catalogue-card">
    <AdultGatedLink to={`/manga/${work.id}`} contentRating={work.content_rating} aria-label={`Découvrir ${work.title}`}>
      <div className="catalogue-card-art"><MangaCover src={work.cover_image} alt={gated ? 'Couverture masquée : contenu réservé aux adultes' : ''}
        loading={priority ? 'eager' : 'lazy'} deferProxy className={gated ? 'catalogue-adult-cover' : ''} />
        {gated && <span className="catalogue-adult-label"><Lock size={20} /> Contenu 18+</span>}
      </div>
      <div className="catalogue-card-copy">
        <p className="catalogue-card-type">{work.manga_type}</p><h3>{work.title}</h3>
        <p className="catalogue-card-genres">{work.genre?.slice(0, 2).join(' · ')}</p>
        <p className="catalogue-card-footer"><span>{discoveryStatusLabel(work.status)}</span>
          {work.rating != null && work.rating > 0 && <span className="catalogue-rating"><Star size={13} aria-hidden="true" /> {work.rating.toFixed(1)}</span>}</p>
        <p className="catalogue-list-extra">{work.author || 'Auteur non renseigné'}{work.aliases?.length ? ` · ${work.aliases.slice(0, 2).join(' · ')}` : ''}</p>
      </div>
    </AdultGatedLink>
  </article>;
}
