import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import MangaCover from '@/components/MangaCover';
import type { SearchWork } from '@/domain/canonicalSearch';
import type { EditorialCollection } from '@/domain/collections';

type CollectionTileProps = {
  collection: EditorialCollection;
  count: number;
  covers: SearchWork[];
  headingLevel?: 'h2' | 'h3';
};

export const CollectionTile = ({ collection, count, covers, headingLevel: Heading = 'h2' }: CollectionTileProps) => (
  <Link
    to={`/collections/${collection.slug}`}
    className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0f1520]/80 transition-all hover:border-manga-purple/50 hover:shadow-card-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300"
  >
    <div className="grid h-44 grid-cols-3 gap-px bg-black/40" aria-hidden="true">
      {covers.map((work) => (
        <div key={work.id} className="overflow-hidden">
          <MangaCover src={work.cover_image} alt="" deferProxy className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
        </div>
      ))}
    </div>
    <div className="flex flex-1 flex-col p-5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-manga-cyan">{count} titres</p>
      <Heading className="mt-1 font-outfit text-xl font-bold text-white">{collection.title}</Heading>
      <p className="mt-1 flex-1 text-sm text-white/55">{collection.tagline}</p>
      <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white/80 group-hover:text-white">
        Ouvrir la collection <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </span>
    </div>
  </Link>
);
