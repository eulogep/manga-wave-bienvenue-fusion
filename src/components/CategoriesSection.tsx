import { Link } from 'react-router-dom';
import { Sword, Heart, Sparkles, Zap, Users, Star, ArrowRight } from 'lucide-react';

const CATEGORIES = [
  {
    name: 'Action',
    icon: Sword,
    count: '2 547',
    description: 'Combats épiques & aventures',
    from: 'from-red-500/20',
    to: 'to-orange-500/10',
    border: 'border-red-500/20',
    iconColor: 'text-red-400',
    accent: 'bg-red-500/15 text-red-400',
    link: '/search?genre=Action',
  },
  {
    name: 'Romance',
    icon: Heart,
    count: '1 834',
    description: 'Histoires d\'amour touchantes',
    from: 'from-pink-500/20',
    to: 'to-rose-500/10',
    border: 'border-pink-500/20',
    iconColor: 'text-pink-400',
    accent: 'bg-pink-500/15 text-pink-400',
    link: '/search?genre=Romance',
  },
  {
    name: 'Fantasy',
    icon: Sparkles,
    count: '1 923',
    description: 'Mondes magiques & mystérieux',
    from: 'from-purple-500/20',
    to: 'to-indigo-500/10',
    border: 'border-purple-500/20',
    iconColor: 'text-purple-400',
    accent: 'bg-purple-500/15 text-purple-400',
    link: '/search?genre=Fantasy',
  },
  {
    name: 'Supernatural',
    icon: Zap,
    count: '987',
    description: 'Pouvoirs surnaturels',
    from: 'from-cyan-500/20',
    to: 'to-blue-500/10',
    border: 'border-cyan-500/20',
    iconColor: 'text-cyan-400',
    accent: 'bg-cyan-500/15 text-cyan-400',
    link: '/search?genre=Supernatural',
  },
  {
    name: 'Slice of Life',
    icon: Users,
    count: '756',
    description: 'Quotidien & réalisme',
    from: 'from-emerald-500/20',
    to: 'to-green-500/10',
    border: 'border-emerald-500/20',
    iconColor: 'text-emerald-400',
    accent: 'bg-emerald-500/15 text-emerald-400',
    link: '/search?genre=Slice+of+Life',
  },
  {
    name: 'Populaires',
    icon: Star,
    count: '∞',
    description: 'Les titres les plus appréciés',
    from: 'from-amber-500/20',
    to: 'to-yellow-500/10',
    border: 'border-amber-500/20',
    iconColor: 'text-amber-400',
    accent: 'bg-amber-500/15 text-amber-400',
    link: '/search',
  },
];

const CategoriesSection = () => (
  <section className="py-20 section-padding">
    <div className="container mx-auto">

      {/* ── Header ── */}
      <div className="text-center mb-12">
        <p className="text-xs font-semibold text-manga-purple/80 uppercase tracking-widest mb-3">Parcourir</p>
        <h2 className="font-outfit font-bold text-3xl md:text-4xl text-white mb-3">
          Explorer par <span className="glow-text">Genres</span>
        </h2>
        <p className="text-white/40 max-w-xl mx-auto text-sm">
          Plus de 20 catégories pour tous les goûts — de l'action pure aux histoires du quotidien.
        </p>
      </div>

      {/* ── Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CATEGORIES.map((cat, index) => {
          const Icon = cat.icon;
          return (
            <Link
              key={cat.name}
              to={cat.link}
              className={`group relative p-5 rounded-2xl border bg-gradient-to-br ${cat.from} ${cat.to} ${cat.border} transition-all duration-300 hover:scale-[1.02] hover:shadow-card-hover animate-slide-up-fade overflow-hidden`}
              style={{ animationDelay: `${index * 0.08}s`, opacity: 0 }}
              aria-label={`Explorer les mangas ${cat.name}`}
            >
              {/* Background shimmer on hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent)', animation: 'none' }}
              />

              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${cat.accent} transition-transform duration-300 group-hover:scale-110`}>
                  <Icon className={`h-5 w-5 ${cat.iconColor}`} />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="font-outfit font-bold text-base text-white">{cat.name}</h3>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cat.accent}`}>
                      {cat.count}
                    </span>
                  </div>
                  <p className="text-white/45 text-sm leading-snug">{cat.description}</p>
                </div>

                <ArrowRight className="h-4 w-4 text-white/20 group-hover:text-white/60 group-hover:translate-x-1 transition-all duration-200 shrink-0 mt-1" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── All categories CTA ── */}
      <div className="text-center mt-10">
        <Link
          to="/search"
          className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors group"
        >
          Explorer toutes les catégories
          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  </section>
);

export default CategoriesSection;
