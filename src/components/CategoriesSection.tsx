import { ArrowUpRight, Compass, Frown, Heart, Smile, Sparkles, Star, Sword, Users, Wand2 } from 'lucide-react';
import { Link } from 'react-router-dom';

// Genres chosen from the real, live distribution across the canonical
// catalogue (verified against production: Action, Comedy, Romance, Fantasy,
// Drama, Adventure, Slice of Life and Isekai are the best-represented
// non-format tags — format/language tags like "VF", "EN", "Manhwa" are
// mixed into the same genre column by some sources but aren't genres, so
// they're deliberately excluded here). Each link's genre string must match
// a tag exactly as stored (matching is case/accent-insensitive but not
// fuzzy — see filterSearchResults in canonicalSearch.ts), so a category
// added here with a genre nobody uses would silently show zero results.
const CATEGORIES = [
  { name: 'Action', icon: Sword, description: 'Combats, rivalités et quêtes épiques', link: '/search?genre=Action', tone: '#ff4d5a' },
  { name: 'Comédie', icon: Smile, description: 'Situations loufoques et répliques qui détendent', link: '/search?genre=Comedy', tone: '#e8b93a' },
  { name: 'Romance', icon: Heart, description: 'Rencontres, drames et liens intimes', link: '/search?genre=Romance', tone: '#d66b75' },
  { name: 'Fantasy', icon: Sparkles, description: 'Mondes inconnus et légendes anciennes', link: '/search?genre=Fantasy', tone: '#1ea7ff' },
  { name: 'Drame', icon: Frown, description: 'Histoires fortes, tensions et émotions brutes', link: '/search?genre=Drama', tone: '#6b8fb0' },
  { name: 'Aventure', icon: Compass, description: 'Voyages, expéditions et terres inconnues', link: '/search?genre=Adventure', tone: '#3ac17a' },
  { name: 'Tranche de vie', icon: Users, description: 'Récits sensibles du quotidien', link: '/search?genre=Slice+of+Life', tone: '#a78664' },
  { name: 'Isekai', icon: Wand2, description: 'Transportés dans un autre monde', link: '/search?genre=Isekai', tone: '#9b6bff' },
  { name: 'Les incontournables', icon: Star, description: 'Les œuvres plébiscitées par les lecteurs', link: '/search?browse=1&sort=popularity', tone: '#c69b42' },
];

const CategoriesSection = () => (
  <section className="bg-[#08131d] py-14 section-padding" aria-labelledby="genres-title">
    <div className="container mx-auto">
      <div className="mb-8 grid gap-4 md:grid-cols-[1fr_1fr] md:items-end">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--mw-accent-coral)]">Explorer autrement</p>
          <h2 id="genres-title" className="font-editorial text-3xl uppercase text-white md:text-4xl">Territoires de lecture</h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-[var(--mw-text-secondary)] md:justify-self-end">Choisissez une ambiance avant de choisir un titre. Chaque genre ouvre une sélection pensée comme une porte d’entrée, pas comme un simple filtre.</p>
      </div>

      <div className="grid grid-cols-1 border-l border-t border-[var(--mw-border)] sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((category, index) => {
          const Icon = category.icon;
          return (
            <Link key={category.name} to={category.link} className="group relative min-h-40 overflow-hidden border-b border-r border-[var(--mw-border)] bg-[var(--mw-surface)] p-5 transition-colors hover:bg-[var(--mw-elevated)]" aria-label={`Explorer ${category.name}`}>
              <div className="flex items-start justify-between">
                <span className="font-editorial text-4xl leading-none text-white/10">0{index + 1}</span>
                <Icon className="h-5 w-5" style={{ color: category.tone }} />
              </div>
              <h3 className="mt-6 font-editorial text-lg font-semibold uppercase text-white">{category.name}</h3>
              <p className="mt-2 max-w-xs text-xs leading-5 text-[var(--mw-text-secondary)]">{category.description}</p>
              <ArrowUpRight className="absolute bottom-5 right-5 h-4 w-4 text-white/25 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />
              <span className="absolute bottom-0 left-0 h-0.5 w-0 transition-all duration-300 group-hover:w-full" style={{ backgroundColor: category.tone }} />
            </Link>
          );
        })}
      </div>

      <div className="mt-6 text-right">
        <Link to="/search" className="text-xs font-semibold uppercase tracking-wider text-manga-cyan hover:underline">Toutes les catégories →</Link>
      </div>
    </div>
  </section>
);

export default CategoriesSection;
